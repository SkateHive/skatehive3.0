"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Text,
  Textarea,
  Avatar,
  VStack,
  HStack,
  Progress,
  useToast,
  Spinner,
  Icon,
} from "@chakra-ui/react";
import { FiCamera, FiFileText, FiEdit3, FiCheck, FiArrowRight } from "react-icons/fi";
import Image from "next/image";
import SkateModal from "@/components/shared/SkateModal";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { useTranslations } from "@/lib/i18n/hooks";
import { uploadToIpfs } from "@/lib/markdown/composeUtils";
import { HIVE_CONFIG } from "@/config/app.config";
import type { HiveProfileSummary } from "@/hooks/useHiveProfileSummary";

// Bitmask flags — must match profile PATCH API
export const ONBOARDING_FLAG_PHOTO = 1; // bit 0
export const ONBOARDING_FLAG_BIO   = 2; // bit 1
export const ONBOARDING_FLAG_POST  = 4; // bit 2
export const ONBOARDING_ALL_DONE   = 7;

// Default avatar generated on signup — not a custom upload
export const DICEBEAR_URL_PATTERN = "dicebear.com";
// Avatar bootstrapped for Hive logins. It's a proxy, not an upload: it renders
// a generic placeholder when the Hive account has no profile_image set, so the
// URL alone says nothing about whether the user has a real photo.
const HIVE_PROXY_AVATAR_PATTERN = "images.hive.blog/u/";

/**
 * Whether the stored avatar is a real photo rather than a generated placeholder.
 *
 * `hiveHasProfileImage` comes from the linked Hive account's on-chain profile
 * and is what makes the Hive proxy URL meaningful — without it, every Hive
 * signup would look like it already had a custom avatar and silently skip the
 * photo step.
 */
export function hasCustomAvatar(
  avatarUrl: string | null | undefined,
  hiveHasProfileImage: boolean
): boolean {
  if (!avatarUrl) return false;
  if (avatarUrl.includes(DICEBEAR_URL_PATTERN)) return false;
  if (avatarUrl.includes(HIVE_PROXY_AVATAR_PATTERN)) return hiveHasProfileImage;
  return true;
}

const STEPS = ["photo", "bio", "post"] as const;
type Step = (typeof STEPS)[number];

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Profile data the user's linked Hive account already carries on-chain — each
  // signal skips the matching step. `null` means the check is still resolving.
  hiveProfile?: HiveProfileSummary | null;
}

export default function OnboardingModal({ isOpen, onClose, hiveProfile }: OnboardingModalProps) {
  const { user, refresh } = useUserbaseAuth();
  const toast = useToast();
  const t = useTranslations("onboarding");

  // Freeze pending steps at mount — prevents navigation bugs caused by
  // user.onboarding_step changing mid-flow when refresh() is called.
  // Lazy useState initializer runs once and never re-evaluates (user is
  // guaranteed non-null here because OnboardingDetector guards with
  // `if (!user) return null` before mounting this component).
  const [pendingSteps] = useState<Step[]>(() => {
    if (!user) return [];
    const photoDone = hasCustomAvatar(user.avatar_url, !!hiveProfile?.hasProfileImage);
    // Skatehive never copies the Hive profile's `about` into userbase_users.bio,
    // so without this check a user who already wrote a bio on Hive gets asked
    // for it again.
    const bioDone = !!user.bio?.trim() || !!hiveProfile?.hasAbout;
    return STEPS.filter((s) => {
      if (s === "photo" && photoDone) return false;
      if (s === "bio" && bioDone) return false;
      if (s === "post" && hiveProfile?.hasPosts) return false;
      const flag =
        s === "photo" ? ONBOARDING_FLAG_PHOTO :
        s === "bio"   ? ONBOARDING_FLAG_BIO :
                        ONBOARDING_FLAG_POST;
      return !((user.onboarding_step ?? 0) & flag);
    });
  });

  const [showWelcome, setShowWelcome] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const currentStep: Step = pendingSteps[stepIndex] ?? "post";

  // Tracks which flags were actually completed (not skipped) this session
  const completedFlagsRef = useRef(0);
  const photoFlagSyncedRef = useRef(false);
  const bioFlagSyncedRef = useRef(false);
  const postFlagSyncedRef = useRef(false);

  // ── Photo state ───────────────────────────────────────────────────────────
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatar_url ?? "");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localBlobRef = useRef<string | null>(null);

  // ── Bio state ─────────────────────────────────────────────────────────────
  const [bio, setBio] = useState("");
  const BIO_MAX = 160;

  // ── Post state ────────────────────────────────────────────────────────────
  const displayName = user?.display_name ?? user?.handle ?? t("skater");
  const [postBody, setPostBody] = useState("");
  const [postTouched, setPostTouched] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [snapContainerPermlink, setSnapContainerPermlink] = useState<string | null>(null);

  // Sync template when displayName resolves (user might load after mount)
  useEffect(() => {
    if (!postTouched) {
      setPostBody(t("postTemplate").replace("{name}", displayName));
    }
  }, [displayName, postTouched, t]);

  const [isSaving, setIsSaving] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  // PATCH the profile and report whether the server actually accepted it.
  // A non-2xx response counts as a failure: without this check a rejected save
  // would still mark the step complete client-side and drift from the server.
  const saveToServer = React.useCallback(
    async (payload: Record<string, unknown>, errorLabel?: string): Promise<boolean> => {
      try {
        const res = await fetch("/api/userbase/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`Profile PATCH failed with ${res.status}`);
        return true;
      } catch {
        if (errorLabel) {
          toast({ title: errorLabel, status: "error", duration: 3000 });
        }
        return false;
      }
    },
    [toast]
  );

  // Silently sync bitmask flags for data that already exists outside onboarding
  useEffect(() => {
    const currentStep = user?.onboarding_step ?? 0;
    let flagsToSync = 0;
    const photoDone = hasCustomAvatar(user?.avatar_url, !!hiveProfile?.hasProfileImage);
    if (!photoFlagSyncedRef.current && photoDone && !(currentStep & ONBOARDING_FLAG_PHOTO)) {
      photoFlagSyncedRef.current = true;
      flagsToSync |= ONBOARDING_FLAG_PHOTO;
    }
    const bioDone = !!user?.bio?.trim() || !!hiveProfile?.hasAbout;
    if (!bioFlagSyncedRef.current && bioDone && !(currentStep & ONBOARDING_FLAG_BIO)) {
      bioFlagSyncedRef.current = true;
      flagsToSync |= ONBOARDING_FLAG_BIO;
    }
    if (!postFlagSyncedRef.current && hiveProfile?.hasPosts && !(currentStep & ONBOARDING_FLAG_POST)) {
      postFlagSyncedRef.current = true;
      flagsToSync |= ONBOARDING_FLAG_POST;
    }
    if (!flagsToSync) return;

    // Roll the refs back if the sync fails so a later render retries, instead
    // of leaving the server permanently behind this session's view of things.
    saveToServer({ onboarding_step_flag: flagsToSync }).then((ok) => {
      if (ok) return;
      if (flagsToSync & ONBOARDING_FLAG_PHOTO) photoFlagSyncedRef.current = false;
      if (flagsToSync & ONBOARDING_FLAG_BIO) bioFlagSyncedRef.current = false;
      if (flagsToSync & ONBOARDING_FLAG_POST) postFlagSyncedRef.current = false;
    });
  }, [user, hiveProfile, saveToServer]);

  function advance() {
    if (stepIndex + 1 < pendingSteps.length) {
      setStepIndex((i) => i + 1);
    } else {
      // Only mark as done if every pending step was actually completed
      // (not just skipped). Skips don't set completedFlagsRef.
      if (typeof window !== "undefined") {
        const allPendingFlags = pendingSteps.reduce((acc, s) =>
          acc | (s === "photo" ? ONBOARDING_FLAG_PHOTO :
                 s === "bio"   ? ONBOARDING_FLAG_BIO :
                                 ONBOARDING_FLAG_POST), 0);
        const allCompleted = (completedFlagsRef.current & allPendingFlags) === allPendingFlags;
        if (allCompleted) {
          sessionStorage.setItem("onboarding_done", "true");
        }
      }
      refresh();
      onClose();
    }
  }

  // ── Step actions ──────────────────────────────────────────────────────────

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview via blob URL
    const localUrl = URL.createObjectURL(file);
    if (localBlobRef.current) URL.revokeObjectURL(localBlobRef.current);
    localBlobRef.current = localUrl;
    setAvatarPreview(localUrl);

    setIsUploadingPhoto(true);
    try {
      const ipfsUrl = await uploadToIpfs(file, file.name);
      setAvatarPreview(ipfsUrl);
      if (localBlobRef.current) {
        URL.revokeObjectURL(localBlobRef.current);
        localBlobRef.current = null;
      }
    } catch {
      setAvatarPreview(user?.avatar_url ?? "");
      if (localBlobRef.current) {
        URL.revokeObjectURL(localBlobRef.current);
        localBlobRef.current = null;
      }
      toast({ title: t("uploadFailed"), status: "error", duration: 3000 });
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function savePhoto() {
    const hasNewPhoto = avatarPreview && avatarPreview !== user?.avatar_url;
    if (hasNewPhoto) {
      setIsSaving(true);
      const saved = await saveToServer(
        { avatar_url: avatarPreview, onboarding_step_flag: ONBOARDING_FLAG_PHOTO },
        t("couldNotSavePhoto")
      );
      setIsSaving(false);
      // Stay on the step when the save fails, so the uploaded photo isn't lost
      // and the user can retry. "skip" is still there to move on.
      if (!saved) return;
      completedFlagsRef.current |= ONBOARDING_FLAG_PHOTO;
    }
    advance();
  }

  async function saveBio() {
    if (bio.trim()) {
      setIsSaving(true);
      const saved = await saveToServer(
        { bio: bio.trim(), onboarding_step_flag: ONBOARDING_FLAG_BIO },
        t("couldNotSaveBio")
      );
      setIsSaving(false);
      // Stay on the step when the save fails, so the typed bio isn't lost.
      if (!saved) return;
      completedFlagsRef.current |= ONBOARDING_FLAG_BIO;
    }
    advance();
  }

  async function getSnapContainer(): Promise<string> {
    if (snapContainerPermlink) return snapContainerPermlink;
    const res = await fetch("https://api.hive.blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "condenser_api.get_discussions_by_author_before_date",
        params: [HIVE_CONFIG.THREADS.AUTHOR, "", new Date().toISOString(), 1],
        id: 1,
      }),
    });
    const data = await res.json();
    const permlink: string = data?.result?.[0]?.permlink;
    if (!permlink) throw new Error(t("couldNotFindContainer"));
    setSnapContainerPermlink(permlink);
    return permlink;
  }

  async function submitPost() {
    if (!postBody.trim()) {
      advance();
      return;
    }
    setIsPosting(true);
    try {
      const containerPermlink = await getSnapContainer();
      const res = await fetch("/api/userbase/hive/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_author: HIVE_CONFIG.THREADS.AUTHOR,
          parent_permlink: containerPermlink,
          title: "",
          body: postBody.trim(),
          // type: "snap" ensures the soft_post is recorded as a snap (not a
          // comment), so the intro shows up in the user's profile snaps tab.
          type: "snap",
          json_metadata: {
            tags: [HIVE_CONFIG.COMMUNITY_TAG, HIVE_CONFIG.THREADS.PERMLINK, "introduceyourself"],
            app: "Skatehive App 3.0",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? t("postFailed"));
      }
      // The post is already on-chain, so we advance either way — only the
      // "everything was completed" bookkeeping waits on the server accepting
      // the flag, so a failed sync doesn't hide the still-pending checklist.
      const flagSaved = await saveToServer({ onboarding_step_flag: ONBOARDING_FLAG_POST });
      if (flagSaved) completedFlagsRef.current |= ONBOARDING_FLAG_POST;
      toast({ title: t("postSuccess"), status: "success", duration: 4000 });
      advance();
    } catch (e: any) {
      toast({ title: e?.message ?? t("couldNotPost"), status: "error", duration: 4000 });
    } finally {
      setIsPosting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (pendingSteps.length === 0) return null;

  const totalSteps = pendingSteps.length;
  const progressValue = (stepIndex / totalSteps) * 100;

  const stepLabels: Record<Step, string> = {
    photo: t("stepPhotoLabel"),
    bio:   t("stepBioLabel"),
    post:  t("stepPostLabel"),
  };

  const stepIcons: Record<Step, React.ElementType> = {
    photo: FiCamera,
    bio:   FiFileText,
    post:  FiEdit3,
  };

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title={showWelcome ? t("welcomeTitle") : t("stepTitle").replace("{n}", String(stepIndex + 1)).replace("{total}", String(totalSteps))}
      size="sm"
      closeOnOverlayClick={false}
      windowId="onboarding-modal"
    >
      {/* ── WELCOME SCREEN ───────────────────────────────────────────────── */}
      {showWelcome ? (
        <VStack px={6} py={8} spacing={5} align="center">
          <Image
            src="/logos/SKATE_HIVE_CIRCLE.svg"
            alt="Skatehive"
            width={80}
            height={80}
          />

          <VStack spacing={1} align="center">
            <Text fontWeight="bold" fontSize="lg" fontFamily="mono">
              {t("welcomeHeading")}
            </Text>
            <Text fontSize="xs" color="dim" fontFamily="mono">
              {user?.display_name ?? user?.handle ?? t("skater")}
            </Text>
          </VStack>

          <Text fontSize="sm" color="dim" textAlign="center" maxW="260px">
            {t("welcomeIntro")}
          </Text>

          <VStack spacing={1} align="start" w="full" px={2}>
            {pendingSteps.map((s) => (
              <HStack key={s} spacing={2}>
                <Icon as={stepIcons[s]} boxSize={3.5} color="dim" />
                <Text fontSize="xs" color="dim" fontFamily="mono">{stepLabels[s]}</Text>
              </HStack>
            ))}
          </VStack>

          <Button
            colorScheme="green"
            fontFamily="mono"
            size="sm"
            w="full"
            rightIcon={<Icon as={FiArrowRight} />}
            onClick={() => setShowWelcome(false)}
          >
            {t("letsGo")}
          </Button>
        </VStack>
      ) : (
        <>
          <Progress value={progressValue} size="xs" colorScheme="green" borderRadius={0} />

      <VStack spacing={0} align="stretch">
        {/* Step header */}
        <Flex align="center" gap={3} px={5} pt={5} pb={3}>
          <Flex
            align="center" justify="center"
            w={9} h={9} borderRadius="full"
            border="1px solid" borderColor="border" flexShrink={0}
          >
            <Icon as={stepIcons[currentStep]} boxSize={4} color="text" />
          </Flex>
          <Box>
            <Text fontSize="xs" color="dim" fontFamily="mono">
              {t("stepProgress").replace("{n}", String(stepIndex + 1)).replace("{total}", String(totalSteps))}
            </Text>
            <Text fontWeight="semibold" fontSize="sm">
              {stepLabels[currentStep]}
            </Text>
          </Box>
        </Flex>

        {/* ── PHOTO ──────────────────────────────────────────────────────── */}
        {currentStep === "photo" && (
          <VStack px={5} pb={5} spacing={4} align="center">
            <Text fontSize="sm" color="dim" textAlign="center">
              {t("photoDescription")}
            </Text>

            <Box position="relative" cursor="pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar
                src={avatarPreview}
                name={displayName}
                size="2xl"
                border="2px solid"
                borderColor="border"
              />
              <Flex
                position="absolute" inset={0}
                align="center" justify="center"
                borderRadius="full" bg="blackAlpha.500"
                opacity={isUploadingPhoto ? 1 : 0}
                _hover={{ opacity: 1 }}
                transition="opacity 0.15s"
              >
                {isUploadingPhoto
                  ? <Spinner size="sm" color="white" />
                  : <Icon as={FiCamera} color="white" boxSize={6} />
                }
              </Flex>
            </Box>

            <Text fontSize="xs" color="dim">{t("photoUploadHint")}</Text>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handlePhotoSelect}
            />

            <ActionBar
              onSkip={advance}
              onNext={savePhoto}
              isLoading={isSaving || isUploadingPhoto}
              nextLabel={avatarPreview && avatarPreview !== user?.avatar_url ? t("saveContinue") : t("continue")}
              isLast={stepIndex + 1 === totalSteps}
            />
          </VStack>
        )}

        {/* ── BIO ────────────────────────────────────────────────────────── */}
        {currentStep === "bio" && (
          <VStack px={5} pb={5} spacing={4} align="stretch">
            <Text fontSize="sm" color="dim">
              {t("bioDescription")}
            </Text>

            <Box position="relative">
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                placeholder={t("bioPlaceholder")}
                rows={4} resize="none" fontSize="sm" fontFamily="mono"
              />
              <Text
                position="absolute" bottom={2} right={3}
                fontSize="2xs" userSelect="none"
                color={bio.length >= BIO_MAX ? "red.400" : "dim"}
              >
                {bio.length}/{BIO_MAX}
              </Text>
            </Box>

            <ActionBar
              onSkip={advance}
              onNext={saveBio}
              isLoading={isSaving}
              nextLabel={t("saveContinue")}
              isLast={stepIndex + 1 === totalSteps}
            />
          </VStack>
        )}

        {/* ── POST ───────────────────────────────────────────────────────── */}
        {currentStep === "post" && (
          <VStack px={5} pb={5} spacing={4} align="stretch">
            <Text fontSize="sm" color="dim">
              {t("postDescription")}
            </Text>

            <Box position="relative">
              <Textarea
                value={postBody}
                onChange={(e) => { setPostBody(e.target.value); setPostTouched(true); }}
                placeholder={t("postPlaceholder")}
                rows={6} resize="none" fontSize="sm" fontFamily="mono"
                autoFocus
                border="1px solid" borderColor="green.500"
                _focus={{ borderColor: "green.400", boxShadow: "0 0 0 1px var(--chakra-colors-green-400)" }}
              />
              {!postTouched && (
                <Text
                  position="absolute" top={2} right={3}
                  fontSize="2xs" color="green.500" fontFamily="mono" userSelect="none"
                >
                  {t("postEditable")}
                </Text>
              )}
            </Box>

            <ActionBar
              onSkip={advance}
              onNext={submitPost}
              isLoading={isPosting}
              nextLabel={t("postFinish")}
              isLast={true}
            />
          </VStack>
        )}
      </VStack>
        </>
      )}
    </SkateModal>
  );
}

// ── Shared footer bar ──────────────────────────────────────────────────────

function ActionBar({
  onSkip,
  onNext,
  isLoading,
  nextLabel,
  isLast,
}: {
  onSkip: () => void;
  onNext: () => void;
  isLoading: boolean;
  nextLabel: string;
  isLast: boolean;
}) {
  const t = useTranslations("onboarding");
  return (
    <HStack justify="space-between" w="full" pt={1}>
      <Button
        size="sm" variant="ghost" color="dim" fontFamily="mono"
        onClick={onSkip} isDisabled={isLoading}
      >
        {t("skip")}
      </Button>
      <Button
        size="sm" colorScheme="green" fontFamily="mono"
        onClick={onNext} isLoading={isLoading}
        leftIcon={isLast ? <Icon as={FiCheck} /> : undefined}
      >
        {nextLabel}
      </Button>
    </HStack>
  );
}
