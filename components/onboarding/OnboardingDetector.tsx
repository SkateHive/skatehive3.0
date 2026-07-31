"use client";

/**
 * OnboardingDetector
 *
 * - Auto-opens the OnboardingModal on first login (once per browser session).
 * - Shows a persistent floating card until all 3 steps are done.
 * - Bitmask: photo=1, bio=2, intro post=4 — all done when onboarding_step === 7.
 */

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Flex,
  Text,
  Icon,
  IconButton,
  VStack,
  HStack,
  Button,
  useTheme,
} from "@chakra-ui/react";
import { FiCamera, FiFileText, FiEdit3, FiCheck, FiX } from "react-icons/fi";
import dynamic from "next/dynamic";
import { useUserbaseAuth, type UserbaseUser } from "@/contexts/UserbaseAuthContext";
import { useTranslations } from "@/lib/i18n/hooks";
import { useHiveProfileSummary, type HiveProfileSummary } from "@/hooks/useHiveProfileSummary";
import {
  ONBOARDING_FLAG_PHOTO,
  ONBOARDING_FLAG_BIO,
  ONBOARDING_FLAG_POST,
  ONBOARDING_ALL_DONE,
  hasCustomAvatar,
} from "./OnboardingModal";

const OnboardingModal = dynamic(() => import("./OnboardingModal"), { ssr: false });

// Onboarding is only for accounts created after the feature reached production.
//
// This is an env var rather than a hardcoded constant because a constant goes
// stale while the PR waits for review: a date picked in April would have let
// ~1.8k accounts that signed up in the meantime through the gate and shown all
// of them the modal on deploy.
//
// Set NEXT_PUBLIC_ONBOARDING_LAUNCH_DATE (ISO date, e.g. "2026-07-29") to the
// production deploy date. It's read at build time, so a change needs a rebuild.
//
// Unset or unparseable => onboarding stays off for everyone. Failing closed
// keeps a missing env var a silent no-op instead of a surprise modal for every
// existing user.
const ONBOARDING_LAUNCH_DATE: Date | null = (() => {
  const raw = process.env.NEXT_PUBLIC_ONBOARDING_LAUNCH_DATE?.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
})();

/**
 * Whether this account is new enough to be offered onboarding.
 *
 * Fails closed on every uncertain input — no configured launch date, or a
 * missing/invalid created_at — so an existing user is never shown the flow by
 * accident.
 */
function isEligibleForOnboarding(user: UserbaseUser): boolean {
  if (!ONBOARDING_LAUNCH_DATE) return false;
  const createdAt = user.created_at ? new Date(user.created_at) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
  return createdAt >= ONBOARDING_LAUNCH_DATE;
}

/**
 * Which steps the user has effectively already done — either through onboarding
 * itself (the server-side bitmask) or by already having the data, whether on
 * their Skatehive profile or on their linked Hive account.
 */
function getStepState(user: UserbaseUser, hiveProfile: HiveProfileSummary) {
  const photoDone = hasCustomAvatar(user.avatar_url, hiveProfile.hasProfileImage);
  // Skatehive never copies the Hive profile's `about` into userbase_users.bio,
  // so without this check a user who already wrote a bio on Hive gets asked
  // for it again.
  const bioDone = !!user.bio?.trim() || hiveProfile.hasAbout;
  const postDone = hiveProfile.hasPosts;
  const effectiveStep =
    (photoDone ? ONBOARDING_FLAG_PHOTO : 0) |
    (bioDone ? ONBOARDING_FLAG_BIO : 0) |
    (postDone ? ONBOARDING_FLAG_POST : 0) |
    (user.onboarding_step ?? 0);
  return { photoDone, bioDone, postDone, effectiveStep };
}

// sessionStorage keys
const SS_SEEN = "onboarding_modal_seen"; // set after first auto-open
const SS_DONE = "onboarding_done";       // set immediately when modal finishes

function isLocallyDone() {
  return typeof window !== "undefined" && sessionStorage.getItem(SS_DONE) === "true";
}

export default function OnboardingDetector() {
  const { user } = useUserbaseAuth();
  const theme = useTheme();
  const t = useTranslations("onboarding");

  // Profile data the linked Hive account already carries on-chain — each signal
  // skips the matching step. `null` while still resolving, so onboarding stays
  // hidden until it settles.
  const hiveProfile = useHiveProfileSummary();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCardDismissed, setIsCardDismissed] = useState(false);
  const hasAutoOpened = useRef(false);

  // ── Auto-open once per browser session for new users ─────────────────────
  useEffect(() => {
    if (!user) return;
    if (hasAutoOpened.current) return;
    // Checked here as well as at render so an existing user never has the
    // open timer scheduled or SS_SEEN written on their behalf.
    if (!isEligibleForOnboarding(user)) return;
    // Wait for the Hive profile check before deciding — avoids opening the
    // modal on a step the user has already covered on their Hive account.
    if (hiveProfile === null) return;

    const { effectiveStep } = getStepState(user, hiveProfile);
    const isDone = (effectiveStep & ONBOARDING_ALL_DONE) === ONBOARDING_ALL_DONE || isLocallyDone();
    if (isDone) return;

    const alreadySeen = typeof window !== "undefined"
      ? sessionStorage.getItem(SS_SEEN) === "true"
      : false;

    if (!alreadySeen) {
      const timeout = setTimeout(() => {
        setIsModalOpen(true);
        sessionStorage.setItem(SS_SEEN, "true");
        hasAutoOpened.current = true;
      }, 1200);
      return () => clearTimeout(timeout);
    }

    hasAutoOpened.current = true;
  }, [user, hiveProfile]);

  // ── Clean up SS_DONE once the server confirms onboarding_step === 7 ───────
  useEffect(() => {
    if (!user) return;
    if (((user.onboarding_step ?? 0) & ONBOARDING_ALL_DONE) === ONBOARDING_ALL_DONE) {
      sessionStorage.removeItem(SS_DONE);
    }
  }, [user]);

  // ── Reset on logout ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) {
      hasAutoOpened.current = false;
      setIsCardDismissed(false);
      sessionStorage.removeItem(SS_SEEN);
      sessionStorage.removeItem(SS_DONE);
    }
  }, [user]);

  // ── Nothing to show ───────────────────────────────────────────────────────
  // isLoading intentionally excluded: background refreshes (focus/visibility
  // events) set isLoading=true while user stays non-null, which would unmount
  // the modal mid-flow and reset its state.
  if (!user) return null;

  // Wait for the Hive profile check to settle before rendering anything, so the
  // card/modal never flashes a step the user has already covered on Hive.
  if (hiveProfile === null) return null;

  // Only accounts created after the feature reached production. Existing users
  // are excluded without any database migration.
  if (!isEligibleForOnboarding(user)) return null;

  const { photoDone, bioDone, postDone, effectiveStep } = getStepState(user, hiveProfile);
  const isDone = (effectiveStep & ONBOARDING_ALL_DONE) === ONBOARDING_ALL_DONE || isLocallyDone();
  if (isDone) return null;

  const items = [
    ...(!photoDone ? [{ flag: ONBOARDING_FLAG_PHOTO, icon: FiCamera, label: t("cardPhoto") }] : []),
    ...(!bioDone ? [{ flag: ONBOARDING_FLAG_BIO, icon: FiFileText, label: t("cardBio") }] : []),
    ...(!postDone ? [{ flag: ONBOARDING_FLAG_POST, icon: FiEdit3, label: t("cardPost") }] : []),
  ];

  const pendingItems = items.filter(({ flag }) => !(effectiveStep & flag));
  const ctaLabel = pendingItems.length === 1 ? pendingItems[0].label : t("cardFinishSetup");

  const bgColor = theme.colors.panel || theme.colors.background;
  const borderColor = theme.colors.border;
  const dimColor = theme.colors.dim;

  return (
    <>
      {/* Modal */}
      <OnboardingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        hiveProfile={hiveProfile}
      />

      {/* Floating card — hidden when dismissed for session OR when modal is open */}
      {!isCardDismissed && !isModalOpen && (
        <Box
          position="fixed"
          bottom={{ base: "70px", md: "24px" }}
          right="16px"
          zIndex={1400}
          bg={bgColor}
          border="1px solid"
          borderColor={borderColor}
          borderRadius="md"
          boxShadow="lg"
          w="200px"
          overflow="hidden"
        >
          {/* Header */}
          <Flex
            align="center"
            justify="space-between"
            px={3}
            py={1.5}
            bg={bgColor}
            borderBottom="1px solid"
            borderColor={borderColor}
          >
            <Text fontSize="2xs" color={dimColor} fontFamily="mono">
              {t("cardTitle")}
            </Text>
            <IconButton
              aria-label={t("cardDismiss")}
              icon={<Icon as={FiX} boxSize={3} />}
              size="xs"
              variant="ghost"
              minW="auto"
              h="auto"
              p={0}
              color={dimColor}
              onClick={() => setIsCardDismissed(true)}
            />
          </Flex>

          {/* Steps checklist */}
          <VStack align="stretch" spacing={0} px={3} py={2}>
            {items.map(({ flag, icon, label }) => {
              const done = Boolean(effectiveStep & flag);
              return (
                <HStack key={flag} spacing={2} py={1}>
                  <Icon
                    as={done ? FiCheck : icon}
                    boxSize={3.5}
                    color={done ? "green.400" : "orange.400"}
                    flexShrink={0}
                  />
                  <Text
                    fontSize="xs"
                    fontFamily="mono"
                    color={done ? "green.400" : "text"}
                    textDecoration={done ? "line-through" : "none"}
                    opacity={done ? 0.6 : 1}
                  >
                    {label}
                  </Text>
                  {!done && (
                    <Text fontSize="2xs" color="orange.400" fontFamily="mono" ml="auto">
                      {t("cardPending")}
                    </Text>
                  )}
                </HStack>
              );
            })}
          </VStack>

          {/* CTA */}
          <Box px={3} pb={3}>
            <Button
              size="xs"
              w="full"
              colorScheme="orange"
              fontFamily="mono"
              onClick={() => setIsModalOpen(true)}
            >
              {ctaLabel}
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
}
