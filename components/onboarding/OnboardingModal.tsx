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
import { uploadToIpfs } from "@/lib/markdown/composeUtils";
import { HIVE_CONFIG } from "@/config/app.config";

// Bitmask flags — must match profile PATCH API
export const ONBOARDING_FLAG_PHOTO = 1; // bit 0
export const ONBOARDING_FLAG_BIO   = 2; // bit 1
export const ONBOARDING_FLAG_POST  = 4; // bit 2
export const ONBOARDING_ALL_DONE   = 7;

// Default avatar generated on signup — not a custom upload
export const DICEBEAR_URL_PATTERN = "dicebear.com";

const STEPS = ["photo", "bio", "post"] as const;
type Step = (typeof STEPS)[number];

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OnboardingModal({ isOpen, onClose }: OnboardingModalProps) {
  const { user, refresh } = useUserbaseAuth();
  const toast = useToast();

  // Freeze pending steps at mount — prevents navigation bugs caused by
  // user.onboarding_step changing mid-flow when refresh() is called.
  // Lazy useState initializer runs once and never re-evaluates (user is
  // guaranteed non-null here because OnboardingDetector guards with
  // `if (!user) return null` before mounting this component).
  const [pendingSteps] = useState<Step[]>(() => {
    if (!user) return [];
    const hasCustomAvatar = !!user.avatar_url && !user.avatar_url.includes(DICEBEAR_URL_PATTERN);
    const hasBio = !!user.bio?.trim();
    return STEPS.filter((s) => {
      if (s === "photo" && hasCustomAvatar) return false;
      if (s === "bio" && hasBio) return false;
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

  // ── Photo state ───────────────────────────────────────────────────────────
  const [avatarPreview, setAvatarPreview] = useState<string>(user?.avatar_url ?? "");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const localBlobRef = useRef<string | null>(null);

  // ── Bio state ─────────────────────────────────────────────────────────────
  const [bio, setBio] = useState("");
  const BIO_MAX = 160;

  // ── Post state ────────────────────────────────────────────────────────────
  const displayName = user?.display_name ?? user?.handle ?? "Skater";
  const [postBody, setPostBody] = useState("");
  const [postTouched, setPostTouched] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [snapContainerPermlink, setSnapContainerPermlink] = useState<string | null>(null);

  // Sync template when displayName resolves (user might load after mount)
  useEffect(() => {
    if (!postTouched) {
      setPostBody(`Hey crew! I'm ${displayName} 🛹\n\n`);
    }
  }, [displayName, postTouched]);

  const [isSaving, setIsSaving] = useState(false);

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Fire-and-forget PATCH — navigation never waits for the server response
  const saveToServer = React.useCallback((payload: Record<string, unknown>, errorLabel?: string) => {
    fetch("/api/userbase/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => {
      if (errorLabel) {
        toast({ title: errorLabel, status: "error", duration: 3000 });
      }
    });
  }, [toast]);

  // Silently sync bitmask flags for data that already exists outside onboarding
  useEffect(() => {
    const currentStep = user?.onboarding_step ?? 0;
    let flagsToSync = 0;
    const hasCustomAvatar = !!user?.avatar_url && !user.avatar_url.includes(DICEBEAR_URL_PATTERN);
    if (!photoFlagSyncedRef.current && hasCustomAvatar && !(currentStep & ONBOARDING_FLAG_PHOTO)) {
      photoFlagSyncedRef.current = true;
      flagsToSync |= ONBOARDING_FLAG_PHOTO;
    }
    const hasBio = !!user?.bio?.trim();
    if (!bioFlagSyncedRef.current && hasBio && !(currentStep & ONBOARDING_FLAG_BIO)) {
      bioFlagSyncedRef.current = true;
      flagsToSync |= ONBOARDING_FLAG_BIO;
    }
    if (flagsToSync) saveToServer({ onboarding_step_flag: flagsToSync });
  }, [user, saveToServer]);

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
      toast({ title: "Upload failed", status: "error", duration: 3000 });
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  }

  async function savePhoto() {
    const hasNewPhoto = avatarPreview && avatarPreview !== user?.avatar_url;
    if (hasNewPhoto) {
      setIsSaving(true);
      try {
        await fetch("/api/userbase/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            avatar_url: avatarPreview,
            onboarding_step_flag: ONBOARDING_FLAG_PHOTO,
          }),
        });
        completedFlagsRef.current |= ONBOARDING_FLAG_PHOTO;
      } catch {
        toast({ title: "Could not save photo", status: "error", duration: 3000 });
      } finally {
        setIsSaving(false);
      }
    }
    advance();
  }

  function saveBio() {
    if (bio.trim()) {
      saveToServer({ bio: bio.trim(), onboarding_step_flag: ONBOARDING_FLAG_BIO }, "Could not save bio");
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
    if (!permlink) throw new Error("Could not find snaps container");
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
          json_metadata: {
            tags: [HIVE_CONFIG.COMMUNITY_TAG, "skatehive", "introduceyourself"],
            app: "Skatehive App 3.0",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Post failed");
      }
      saveToServer({ onboarding_step_flag: ONBOARDING_FLAG_POST });
      completedFlagsRef.current |= ONBOARDING_FLAG_POST;
      toast({ title: "Posted to the feed! Welcome 🛹", status: "success", duration: 4000 });
      advance();
    } catch (e: any) {
      toast({ title: e?.message ?? "Could not post", status: "error", duration: 4000 });
    } finally {
      setIsPosting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (pendingSteps.length === 0) return null;

  const totalSteps = pendingSteps.length;
  const progressValue = (stepIndex / totalSteps) * 100;

  const stepLabels: Record<Step, string> = {
    photo: "Add a profile photo",
    bio:   "Write a short bio",
    post:  "Say hi to the crew",
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
      title={showWelcome ? "welcome.sh" : `onboarding.sh — step ${stepIndex + 1}/${totalSteps}`}
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
              Welcome to Skatehive
            </Text>
            <Text fontSize="xs" color="dim" fontFamily="mono">
              {user?.display_name ?? user?.handle ?? "Skater"}
            </Text>
          </VStack>

          <Text fontSize="sm" color="dim" textAlign="center" maxW="260px">
            Before you start skating the feed, let&apos;s set up your profile and introduce you to the crew. It only takes a minute.
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
            let&apos;s go
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
              step {stepIndex + 1} of {totalSteps}
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
              Skaters want to know who they&apos;re riding with.
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

            <Text fontSize="xs" color="dim">Click the avatar to upload</Text>

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
              nextLabel={avatarPreview && avatarPreview !== user?.avatar_url ? "Save & continue" : "Continue"}
              isLast={stepIndex + 1 === totalSteps}
            />
          </VStack>
        )}

        {/* ── BIO ────────────────────────────────────────────────────────── */}
        {currentStep === "bio" && (
          <VStack px={5} pb={5} spacing={4} align="stretch">
            <Text fontSize="sm" color="dim">
              Where you skate, what style, how long you&apos;ve been rolling.
            </Text>

            <Box position="relative">
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                placeholder="São Paulo street skater, 10 years deep..."
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
              isLoading={false}
              nextLabel="Save & continue"
              isLast={stepIndex + 1 === totalSteps}
            />
          </VStack>
        )}

        {/* ── POST ───────────────────────────────────────────────────────── */}
        {currentStep === "post" && (
          <VStack px={5} pb={5} spacing={4} align="stretch">
            <Text fontSize="sm" color="dim">
              Edit your intro below — it goes live on the feed when you click post.
            </Text>

            <Box position="relative">
              <Textarea
                value={postBody}
                onChange={(e) => { setPostBody(e.target.value); setPostTouched(true); }}
                placeholder="Tell the crew who you are..."
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
                  editable
                </Text>
              )}
            </Box>

            <ActionBar
              onSkip={advance}
              onNext={submitPost}
              isLoading={isPosting}
              nextLabel="Post & finish 🛹"
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
  return (
    <HStack justify="space-between" w="full" pt={1}>
      <Button
        size="sm" variant="ghost" color="dim" fontFamily="mono"
        onClick={onSkip} isDisabled={isLoading}
      >
        skip
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
