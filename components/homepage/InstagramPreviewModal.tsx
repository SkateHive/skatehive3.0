"use client";

/**
 * Moderator-only preview dialog shown before force-posting a snap to
 * the shared @skatehive Instagram. Renders the exact media + caption
 * Meta will receive, then publishes on explicit confirm.
 *
 * Why preview-then-confirm: force-posting is irreversible (a Reel /
 * photo goes live on a shared account) and bypasses the self-serve HP
 * gate. Showing the rendered caption + media first lets moderators
 * catch typos / wrong media / "already on IG" cases before publishing.
 *
 * The caption is built server-side (same code path as the actual post)
 * so the preview can't drift from what Meta receives. The Keychain
 * signature is requested at confirm-time only — the 5-min replay
 * window means signing on modal open would frequently expire before
 * the moderator clicks Confirm.
 */

import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AlertIcon,
  AspectRatio,
  Badge,
  Box,
  Button,
  Center,
  HStack,
  Image as ChakraImage,
  Spinner,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { FaInstagram } from "react-icons/fa";
import SkateModal from "@/components/shared/SkateModal";

interface IgMedia {
  video: string | null;
  image: string | null;
  has: boolean;
}

interface PreviewData {
  caption: string;
  image_url: string | null;
  video_url: string | null;
  media_type: "IMAGE" | "REELS";
  ig_handle: string | null;
  target_account: string;
  moderator: string | null;
  dedupe: { status: string; ig_permalink: string | null } | null;
}

interface InstagramPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussion: Discussion;
  igMedia: IgMedia;
  /** The active SkateHive user (Aioha username or userbase Hive handle) —
   *  used for the Keychain signing message + as a fallback requester
   *  identity when there's no userbase session cookie. */
  moderatorHandle: string | null;
}

export default function InstagramPreviewModal({
  isOpen,
  onClose,
  discussion,
  igMedia,
  moderatorHandle,
}: InstagramPreviewModalProps) {
  const toast = useToast();
  const { aioha, user: walletUser } = useAioha();

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  // ── Build the payload that's shared between preview + real post ─────
  const buildBasePayload = useCallback(() => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "https://skatehive.app";
    const tags = Array.isArray((discussion as any).json_metadata?.tags)
      ? (discussion as any).json_metadata.tags
      : [];
    return {
      hive_author: discussion.author,
      hive_permlink: discussion.permlink,
      title: (discussion as any).title || "",
      body: discussion.body,
      tags,
      image_url: igMedia.image,
      video_url: igMedia.video,
      permalink_url: `${origin}/post/${discussion.author}/${discussion.permlink}`,
    };
  }, [discussion, igMedia]);

  // ── Fetch preview when modal opens ─────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      // Reset on close so reopening fetches fresh data
      setPreview(null);
      setPreviewError(null);
      setIsPosting(false);
      return;
    }
    if (!igMedia.has) {
      setPreviewError("This snap has no image or video to cross-post.");
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingPreview(true);
      setPreviewError(null);
      try {
        const res = await fetch("/api/instagram/force-post", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildBasePayload(),
            preview: true,
            requester: moderatorHandle || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data?.success) {
          setPreviewError(data?.error || `Preview failed (HTTP ${res.status})`);
          return;
        }
        setPreview(data as PreviewData);
      } catch (err: any) {
        if (!cancelled) setPreviewError(err?.message || "Preview request failed");
      } finally {
        if (!cancelled) setIsLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, igMedia.has, buildBasePayload, moderatorHandle]);

  // ── Confirm: sign (if Keychain-only) + force-post for real ─────────
  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setIsPosting(true);
    try {
      const payload: Record<string, unknown> = { ...buildBasePayload() };

      // Sign at confirm-time so the 5-min replay window starts now.
      // Cookie-auth moderators skip this — the session handles auth.
      if (walletUser && aioha) {
        const issuedAt = new Date().toISOString();
        const message = [
          "Skatehive: FORCE cross-post snap to @skatehive on Instagram.",
          `Moderator: @${walletUser}`,
          `Target: @${discussion.author}/${discussion.permlink}`,
          `Issued at: ${issuedAt}`,
        ].join("\n");
        const signResult = await aioha.signMessage(message, KeyTypes.Posting);
        if (!signResult?.success || !signResult.result || !signResult.publicKey) {
          throw new Error(
            signResult?.error || "Keychain signature was rejected."
          );
        }
        payload.requester = walletUser;
        payload.hive_signature = signResult.result;
        payload.hive_public_key = signResult.publicKey;
        payload.signed_at = issuedAt;
      } else if (moderatorHandle) {
        payload.requester = moderatorHandle;
      }

      const res = await fetch("/api/instagram/force-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.success) {
        toast({
          title: data.deduped
            ? "Already on Instagram"
            : "Posted to @skatehive on Instagram",
          description: data.ig_permalink || undefined,
          status: "success",
          duration: 8000,
          isClosable: true,
        });
        onClose();
      } else {
        toast({
          title: "Instagram force-post failed",
          description: data?.error || `HTTP ${res.status}`,
          status: "error",
          duration: 9000,
          isClosable: true,
        });
      }
    } catch (err: any) {
      toast({
        title: "Instagram force-post failed",
        description: err?.message || "Network or signing error.",
        status: "error",
        duration: 9000,
        isClosable: true,
      });
    } finally {
      setIsPosting(false);
    }
  }, [
    preview,
    buildBasePayload,
    walletUser,
    aioha,
    moderatorHandle,
    discussion.author,
    discussion.permlink,
    toast,
    onClose,
  ]);

  const isReel = preview?.media_type === "REELS";
  const mediaUrl = preview?.video_url || preview?.image_url || null;
  const alreadyPublished = preview?.dedupe?.status === "published";

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={isPosting ? () => {} : onClose}
      title="instagram-force-post"
      size="lg"
      footer={
        <HStack spacing={3} justify="flex-end" w="full">
          <Button
            variant="ghost"
            color="text"
            onClick={onClose}
            isDisabled={isPosting}
            fontFamily="mono"
            size="sm"
          >
            Cancel
          </Button>
          <Button
            bg="primary"
            color="background"
            leftIcon={<FaInstagram />}
            onClick={handleConfirm}
            isLoading={isPosting}
            loadingText={isReel ? "Publishing Reel…" : "Publishing…"}
            isDisabled={
              !preview || !!previewError || isLoadingPreview || alreadyPublished
            }
            fontFamily="mono"
            size="sm"
            _hover={{ opacity: 0.85 }}
          >
            {alreadyPublished
              ? "Already published"
              : `Post to ${preview?.target_account || "Instagram"}`}
          </Button>
        </HStack>
      }
    >
      <Box p={5}>
        {isLoadingPreview && (
          <Center py={10}>
            <VStack spacing={2}>
              <Spinner size="md" color="primary" />
              <Text fontFamily="mono" fontSize="xs" color="dim">
                Building preview…
              </Text>
            </VStack>
          </Center>
        )}

        {previewError && (
          <Alert status="error" mb={3}>
            <AlertIcon />
            <Text fontFamily="mono" fontSize="sm">
              {previewError}
            </Text>
          </Alert>
        )}

        {preview && !isLoadingPreview && (
          <VStack align="stretch" spacing={4}>
            {/* Meta strip — target account, media type, dedupe warning */}
            <HStack justify="space-between" flexWrap="wrap" gap={2}>
              <HStack spacing={2}>
                <FaInstagram color="var(--chakra-colors-primary)" />
                <Text fontFamily="mono" fontSize="sm" color="text">
                  Posting to{" "}
                  <Text as="span" color="primary">
                    {preview.target_account}
                  </Text>
                </Text>
                <Badge
                  colorScheme={isReel ? "purple" : "blue"}
                  fontFamily="mono"
                >
                  {isReel ? "Reel" : "Photo"}
                </Badge>
              </HStack>
              {preview.moderator && (
                <Text fontFamily="mono" fontSize="2xs" color="dim">
                  moderator: @{preview.moderator}
                </Text>
              )}
            </HStack>

            {alreadyPublished && (
              <Alert status="warning">
                <AlertIcon />
                <Box>
                  <Text fontFamily="mono" fontSize="sm">
                    This snap is already published on Instagram.
                  </Text>
                  {preview.dedupe?.ig_permalink && (
                    <Text
                      fontFamily="mono"
                      fontSize="2xs"
                      color="dim"
                      mt={1}
                      wordBreak="break-all"
                    >
                      {preview.dedupe.ig_permalink}
                    </Text>
                  )}
                </Box>
              </Alert>
            )}

            {/* Media preview — render video as <video>, image as <img>.
                Constrained to a 4:5 box, which is closer to the IG feed
                aspect ratio than the raw video dimensions. */}
            <Box
              bg="black"
              border="1px solid"
              borderColor="border"
              borderRadius="md"
              overflow="hidden"
            >
              {isReel && mediaUrl ? (
                <AspectRatio ratio={4 / 5}>
                  <video
                    src={mediaUrl}
                    controls
                    playsInline
                    style={{ objectFit: "contain", background: "#000" }}
                  />
                </AspectRatio>
              ) : mediaUrl ? (
                <AspectRatio ratio={4 / 5}>
                  <ChakraImage
                    src={mediaUrl}
                    alt={`Cross-post by @${discussion.author}`}
                    objectFit="contain"
                    bg="black"
                  />
                </AspectRatio>
              ) : (
                <Center py={10}>
                  <Text fontFamily="mono" fontSize="sm" color="dim">
                    no media
                  </Text>
                </Center>
              )}
            </Box>

            {/* Caption — rendered with the exact whitespace Meta will see */}
            <Box>
              <Text
                fontFamily="mono"
                fontSize="2xs"
                color="dim"
                textTransform="uppercase"
                letterSpacing="wider"
                mb={1}
              >
                Caption ({preview.caption.length} / 2200)
              </Text>
              <Box
                bg="background"
                border="1px solid"
                borderColor="border"
                borderRadius="md"
                p={3}
                maxH="240px"
                overflowY="auto"
              >
                <Text
                  fontFamily="mono"
                  fontSize="sm"
                  color="text"
                  whiteSpace="pre-wrap"
                  wordBreak="break-word"
                >
                  {preview.caption}
                </Text>
              </Box>
              <Text fontFamily="mono" fontSize="2xs" color="dim" mt={1}>
                Credit:{" "}
                {preview.ig_handle
                  ? `@${preview.ig_handle} on SkateHive`
                  : `By ${discussion.author} on SkateHive (no IG handle linked)`}
              </Text>
            </Box>

            {/* Sign-at-confirm warning for Keychain-only mods */}
            {walletUser && !aioha ? null : walletUser && aioha ? (
              <Text fontFamily="mono" fontSize="2xs" color="dim">
                Confirming will open Keychain to sign a one-shot
                authorization. The signature is bound to this snap and
                expires in 5 minutes.
              </Text>
            ) : null}
          </VStack>
        )}
      </Box>
    </SkateModal>
  );
}
