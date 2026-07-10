"use client";

/**
 * ProfileSetupToast — a gentle, profile-aware CTA toast.
 *
 * Once per session (desktop only, ~30s after load) it picks ONE still-relevant
 * setup action for the current user and surfaces it as a toast: add an avatar,
 * complete the profile, power up to the next level, or follow SkateHive on
 * Instagram. Only CTAs the user actually needs are eligible, and dismissing one
 * snoozes it for 24h (per handle + CTA, in localStorage). A genuinely completed
 * task stops qualifying via its `isNeeded` check, so it never returns.
 *
 * Replaces the sunset UpvoteSnapToast. Reuses the same recurring-toast infra
 * (usePeriodicTimer + ToastCard + TOAST_CONFIG).
 */

import { ReactElement, useCallback, useMemo, useRef } from "react";
import { useToast, useDisclosure } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import {
  FaUserCircle,
  FaIdCard,
  FaBolt,
  FaInstagram,
} from "react-icons/fa";
import { TOAST_CONFIG } from "@/config/toast.config";
import ToastCard from "@/components/shared/ToastCard";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { usePeriodicTimer } from "@/hooks/usePeriodicTimer";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";
import useHivePower from "@/hooks/useHivePower";
import useHiveAccount from "@/hooks/useHiveAccount";
import useUserbaseProfile from "@/hooks/useUserbaseProfile";
import { useTranslations, type TranslationFunction } from "@/contexts/LocaleContext";
import { getHiveLevel } from "@/lib/utils/hiveLevel";
import { PowerUpModal } from "@/components/wallet/modals";

const SNOOZE_KEY = "sh_cta_snooze_v1";
const SNOOZE_MS = 24 * 60 * 60 * 1000; // 24h
const INSTAGRAM_URL = "https://instagram.com/skatehive";
const DEFAULT_AVATAR_MARKER = "/default/avatar";

type CtaId = "avatar" | "profile" | "hp" | "instagram";

interface CtaContext {
  handle: string;
  hivePower: number | null;
  hasAvatar: boolean;
  hasBio: boolean;
  hasName: boolean;
  canSign: boolean;
}

interface CtaActions {
  goEditProfile: () => void;
  openPowerUp: () => void;
  goWallet: () => void;
  openInstagram: () => void;
}

interface BuiltCta {
  title: string;
  description: string;
  icon: ReactElement;
  colorScheme: string;
  buttonLabel: string;
  onAction: () => void;
}

interface ProfileCta {
  id: CtaId;
  isNeeded: (c: CtaContext) => boolean;
  build: (c: CtaContext, t: TranslationFunction, a: CtaActions) => BuiltCta;
}

/** Replace {token} placeholders in a translated template. */
function fill(tpl: string, vars: Record<string, string | number>): string {
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.split(`{${k}}`).join(String(v)),
    tpl
  );
}

const CTAS: ProfileCta[] = [
  {
    id: "avatar",
    isNeeded: (c) => !c.hasAvatar,
    build: (_c, t, a) => ({
      title: t("cta.avatarTitle"),
      description: t("cta.avatarDesc"),
      icon: <FaUserCircle size={16} />,
      colorScheme: "blue",
      buttonLabel: t("cta.avatarBtn"),
      onAction: a.goEditProfile,
    }),
  },
  {
    id: "profile",
    isNeeded: (c) => !c.hasBio || !c.hasName,
    build: (_c, t, a) => ({
      title: t("cta.profileTitle"),
      description: t("cta.profileDesc"),
      icon: <FaIdCard size={16} />,
      colorScheme: "teal",
      buttonLabel: t("cta.profileBtn"),
      onAction: a.goEditProfile,
    }),
  },
  {
    id: "hp",
    isNeeded: (c) => c.hivePower != null && !getHiveLevel(c.hivePower).isMax,
    build: (c, t, a) => {
      const lvl = getHiveLevel(c.hivePower ?? 0);
      const tpl = lvl.level === 0 ? t("cta.hpStart") : t("cta.hpProgress");
      const description = fill(tpl, {
        name: lvl.name ?? "",
        level: lvl.level,
        hp: lvl.hpToNext ?? 0,
        next: lvl.nextName ?? "",
        nextLevel: lvl.nextLevel ?? "",
      });
      return {
        title: t("cta.hpTitle"),
        description,
        icon: <FaBolt size={16} />,
        colorScheme: "yellow",
        buttonLabel: t("cta.hpBtn"),
        // Powering up needs Keychain/aioha signing; users who can't sign go to
        // the wallet page instead.
        onAction: c.canSign ? a.openPowerUp : a.goWallet,
      };
    },
  },
  {
    id: "instagram",
    // No way to verify a follow — always eligible, gated only by the 24h snooze.
    isNeeded: () => true,
    build: (_c, t, a) => ({
      title: t("cta.instagramTitle"),
      description: t("cta.instagramDesc"),
      icon: <FaInstagram size={16} />,
      colorScheme: "pink",
      buttonLabel: t("cta.instagramBtn"),
      onAction: a.openInstagram,
    }),
  },
];

// ── Snooze persistence (localStorage) ──────────────────────────────────────
type SnoozeMap = Record<string, Record<string, number>>;

function readSnooze(): SnoozeMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(SNOOZE_KEY) || "{}");
  } catch {
    return {};
  }
}

function isSnoozed(handle: string, id: CtaId): boolean {
  const map = readSnooze();
  const expiry = map[handle]?.[id];
  return typeof expiry === "number" && expiry > Date.now();
}

function snooze(handle: string, id: CtaId): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const map = readSnooze();
  // Prune expired entries while we're here.
  for (const h of Object.keys(map)) {
    for (const k of Object.keys(map[h])) {
      if (map[h][k] <= now) delete map[h][k];
    }
    if (Object.keys(map[h]).length === 0) delete map[h];
  }
  map[handle] = { ...(map[handle] || {}), [id]: now + SNOOZE_MS };
  try {
    window.localStorage.setItem(SNOOZE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable (private mode / quota) — non-fatal.
  }
}

export default function ProfileSetupToast() {
  const t = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const { isDesktop, isMounted } = useIsDesktop();

  const { handle, isWalletConnected } = useEffectiveHiveUser();
  const { hivePower } = useHivePower(handle || "");
  const { hiveAccount } = useHiveAccount(handle || "");
  // The app (userbase) profile is what ProfilePage renders first, so CTA
  // eligibility must read from the same merged source — otherwise a user with a
  // complete app profile but sparse Hive metadata gets false "add avatar /
  // complete profile" nudges. See ctx build in show().
  const { profile: userbaseProfile } = useUserbaseProfile(handle || "");
  const userbaseUser = userbaseProfile?.user ?? null;

  const {
    isOpen: isPowerUpOpen,
    onOpen: onPowerUpOpen,
    onClose: onPowerUpClose,
  } = useDisclosure();

  const shownRef = useRef(false);

  const hiveBalance = useMemo(() => {
    const b = (hiveAccount as { balance?: unknown } | null)?.balance;
    return typeof b === "string" ? b : b ? String(b) : "0.000 HIVE";
  }, [hiveAccount]);

  const show = useCallback(() => {
    if (
      !isMounted ||
      !isDesktop ||
      !handle ||
      shownRef.current ||
      !hiveAccount // wait until profile data is available
    ) {
      return;
    }

    const hiveProfile =
      (hiveAccount as { metadata?: { profile?: Record<string, string> } })
        ?.metadata?.profile || {};
    // Merge app profile over Hive metadata, mirroring ProfilePage's precedence.
    const avatar = userbaseUser?.avatar_url || hiveProfile.profile_image || "";
    const bio = (userbaseUser?.bio ?? hiveProfile.about ?? "").trim();
    const name = (userbaseUser?.display_name ?? hiveProfile.name ?? "").trim();

    const ctx: CtaContext = {
      handle,
      hivePower,
      hasAvatar: !!avatar && !avatar.includes(DEFAULT_AVATAR_MARKER),
      hasBio: bio.length > 0,
      hasName: name.length > 0,
      canSign: isWalletConnected,
    };

    const candidates = CTAS.filter(
      (c) => c.isNeeded(ctx) && !isSnoozed(handle, c.id)
    );
    if (candidates.length === 0) return;

    // Pick one at random.
    const cta = candidates[Math.floor(Math.random() * candidates.length)];
    shownRef.current = true;

    const actions: CtaActions = {
      goEditProfile: () => router.push(`/user/${handle}?edit=1`),
      openPowerUp: () => onPowerUpOpen(),
      goWallet: () => router.push("/wallet"),
      openInstagram: () =>
        window.open(INSTAGRAM_URL, "_blank", "noopener,noreferrer"),
    };

    const built = cta.build(ctx, t, actions);

    toast({
      id: `profile-cta-${cta.id}`,
      duration: TOAST_CONFIG.DISPLAY_DURATION,
      isClosable: true,
      position: "bottom-right",
      render: ({ onClose }) => (
        <ToastCard
          title={built.title}
          description={built.description}
          icon={built.icon}
          primaryButton={{
            label: built.buttonLabel,
            icon: built.icon,
            colorScheme: built.colorScheme,
            onClick: () => {
              snooze(handle, cta.id);
              built.onAction();
              onClose();
            },
          }}
          onClose={() => {
            snooze(handle, cta.id);
            onClose();
          }}
        />
      ),
    });
  }, [
    isMounted,
    isDesktop,
    handle,
    hiveAccount,
    userbaseUser,
    hivePower,
    isWalletConnected,
    onPowerUpOpen,
    router,
    t,
    toast,
  ]);

  usePeriodicTimer(show, {
    initialDelay: 30_000,
    interval: SNOOZE_MS, // far out; shownRef makes any later tick a no-op
    enabled: isMounted && isDesktop && !!handle,
  });

  return (
    <PowerUpModal
      isOpen={isPowerUpOpen}
      onClose={onPowerUpClose}
      balance={hiveBalance}
    />
  );
}
