"use client";

/**
 * Shared Instagram cross-post review dialog. Used by BOTH flows:
 *   - mode="self"      : a user cross-posting their own snap   → /api/instagram/post
 *   - mode="moderator" : an admin force-posting any snap       → /api/instagram/force-post
 *
 * It first fetches a server-built preview (default caption + resolved IG
 * handle + media), then lets the user EDIT before publishing:
 *   - the caption (legenda), with a 2200-char counter
 *   - the Collab collaborators (up to 3 IG usernames who get a co-author
 *     invite; the post lands on their feed once accepted)
 *
 * The caption/collaborators are sent back as overrides on confirm. The
 * caption is still built server-side for the default so the preview can't
 * drift from what Meta would otherwise receive. Keychain signing happens at
 * confirm-time only (the signed message has a 5-min replay window, so signing
 * on open would often expire before the user clicks Post).
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  Input,
  Spinner,
  Tag,
  TagCloseButton,
  TagLabel,
  Text,
  Textarea,
  Wrap,
  WrapItem,
  useToast,
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { FaInstagram, FaPlus } from "react-icons/fa";
import SkateModal from "@/components/shared/SkateModal";
import { suggestCaptionCTAs, appendSuggestion } from "@/lib/instagram/captionSuggestions";
import type { CarouselMediaItem } from "@/lib/instagram/extractPostMedia";

const IG_CAPTION_LIMIT = 2200;
const MAX_COLLABORATORS = 3;

/** Normalized snap context — built by each call site from its own data. */
export interface CrossPostContext {
  hiveAuthor: string;
  hivePermlink: string;
  title?: string;
  body: string;
  tags: string[];
  imageUrl: string | null;
  videoUrl: string | null;
  permalinkUrl: string;
  /** Ordered media for a CAROUSEL post (mag posts). 2+ items → carousel. */
  mediaItems?: CarouselMediaItem[];
}

interface PreviewData {
  caption: string;
  image_url: string | null;
  video_url: string | null;
  media_type: "IMAGE" | "REELS";
  ig_handle: string | null;
  default_collaborators?: string[];
  target_account: string;
  moderator?: string | null;
  dedupe: { status: string; ig_permalink: string | null } | null;
}

interface InstagramCrossPostDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "self" | "moderator";
  context: CrossPostContext;
  /** Active SkateHive user (Aioha username / userbase Hive handle) — signing
   *  identity + fallback requester when there's no userbase session cookie. */
  userHandle: string | null;
  /** Whether to sign a Keychain authorization on confirm. False for users
   *  who already have a userbase session cookie (cookie auth is enough), so
   *  they don't get a needless Keychain popup. Defaults to true. */
  requireSignature?: boolean;
  /** Called after a successful publish (e.g. to update the parent UI). */
  onPosted?: (data: { ig_permalink?: string; deduped?: boolean }) => void;
}

/** Strip @, lowercase, keep only legal IG handle chars. */
function sanitizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
}

export default function InstagramCrossPostDialog({
  isOpen,
  onClose,
  mode,
  context,
  userHandle,
  requireSignature = true,
  onPosted,
}: InstagramCrossPostDialogProps) {
  const toast = useToast();
  const { aioha, user: walletUser } = useAioha();

  const endpoint = mode === "moderator" ? "/api/instagram/force-post" : "/api/instagram/post";

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  // Editable fields, hydrated from the preview response.
  const [caption, setCaption] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [collabInput, setCollabInput] = useState("");

  const carouselItems = context.mediaItems ?? [];
  const isCarousel = carouselItems.length >= 2;
  const hasMedia = !!(context.imageUrl || context.videoUrl) || isCarousel;

  const basePayload = useMemo(
    () => ({
      hive_author: context.hiveAuthor,
      hive_permlink: context.hivePermlink,
      title: context.title || "",
      body: context.body,
      tags: context.tags,
      image_url: context.imageUrl,
      video_url: context.videoUrl,
      permalink_url: context.permalinkUrl,
      ...(isCarousel ? { media_items: context.mediaItems } : {}),
    }),
    [context, isCarousel]
  );

  // ── Fetch the server-built preview when the dialog opens ────────────
  useEffect(() => {
    if (!isOpen) {
      setPreview(null);
      setPreviewError(null);
      setIsPosting(false);
      setCaption("");
      setCollaborators([]);
      setCollabInput("");
      return;
    }
    if (!hasMedia) {
      setPreviewError("This snap has no image or video to cross-post.");
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingPreview(true);
      setPreviewError(null);
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...basePayload,
            preview: true,
            // Moderator preview accepts a requester handle (no signature yet).
            ...(mode === "moderator" ? { requester: userHandle || undefined } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data?.success) {
          setPreviewError(data?.error || `Preview failed (HTTP ${res.status})`);
          return;
        }
        const p = data as PreviewData;
        setPreview(p);
        setCaption(p.caption || "");
        setCollaborators(Array.isArray(p.default_collaborators) ? p.default_collaborators : []);
      } catch (err: any) {
        if (!cancelled) setPreviewError(err?.message || "Preview request failed");
      } finally {
        if (!cancelled) setIsLoadingPreview(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, hasMedia, basePayload, endpoint, mode, userHandle]);

  // ── Collaborator chip management ────────────────────────────────────
  const addCollaborator = useCallback(() => {
    const handle = sanitizeHandle(collabInput);
    setCollabInput("");
    if (!handle) return;
    setCollaborators((prev) =>
      prev.includes(handle) || prev.length >= MAX_COLLABORATORS ? prev : [...prev, handle]
    );
  }, [collabInput]);

  const removeCollaborator = useCallback((handle: string) => {
    setCollaborators((prev) => prev.filter((c) => c !== handle));
  }, []);

  // ── Confirm: sign (if needed) + publish for real ────────────────────
  const handleConfirm = useCallback(async () => {
    if (!preview) return;
    setIsPosting(true);
    try {
      const payload: Record<string, unknown> = {
        ...basePayload,
        caption: caption.slice(0, IG_CAPTION_LIMIT),
        collaborators,
      };

      // Sign with the Hive posting key when there's no userbase session to
      // authorize against. Cookie-auth users skip this entirely.
      //   - moderator: bind the signature to moderator + target snap.
      //   - self:      bind it to author + permlink.
      const needsSignature = !!(requireSignature && walletUser && aioha);
      if (needsSignature) {
        const issuedAt = new Date().toISOString();
        const message =
          mode === "moderator"
            ? [
                "Skatehive: FORCE cross-post snap to @skatehive on Instagram.",
                `Moderator: @${walletUser}`,
                `Target: @${context.hiveAuthor}/${context.hivePermlink}`,
                `Issued at: ${issuedAt}`,
              ].join("\n")
            : [
                "Skatehive: cross-post snap to @skatehive on Instagram.",
                `Author: @${context.hiveAuthor}`,
                `Permlink: ${context.hivePermlink}`,
                `Issued at: ${issuedAt}`,
              ].join("\n");
        const signResult = await aioha.signMessage(message, KeyTypes.Posting);
        if (!signResult?.success || !signResult.result || !signResult.publicKey) {
          throw new Error(signResult?.error || "Keychain signature was rejected.");
        }
        payload.requester = walletUser;
        payload.hive_signature = signResult.result;
        payload.hive_public_key = signResult.publicKey;
        payload.signed_at = issuedAt;
      } else if (mode === "moderator" && userHandle) {
        // Cookie-auth moderator: requester is a fallback identity hint.
        payload.requester = userHandle;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && (data?.success || data?.ig_permalink || data?.deduped)) {
        toast({
          title: data.deduped ? "Already on Instagram" : "Posted to @skatehive on Instagram",
          description: data.ig_permalink || undefined,
          status: "success",
          duration: 8000,
          isClosable: true,
        });
        onPosted?.({ ig_permalink: data.ig_permalink, deduped: data.deduped });
        onClose();
      } else {
        toast({
          title: "Instagram cross-post failed",
          description: data?.error || `HTTP ${res.status}`,
          status: "error",
          duration: 9000,
          isClosable: true,
        });
      }
    } catch (err: any) {
      toast({
        title: "Instagram cross-post failed",
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
    basePayload,
    caption,
    collaborators,
    walletUser,
    aioha,
    mode,
    userHandle,
    requireSignature,
    endpoint,
    context.hiveAuthor,
    context.hivePermlink,
    toast,
    onClose,
    onPosted,
  ]);

  const isReel = preview?.media_type === "REELS";
  const mediaUrl = preview?.video_url || preview?.image_url || null;
  const alreadyPublished = preview?.dedupe?.status === "published";
  const captionOver = caption.length > IG_CAPTION_LIMIT;

  // Smart CTA / hashtag suggestions derived from the snap text + current
  // caption (trick names, spot references, evergreen CTAs).
  const suggestions = useMemo(
    () => suggestCaptionCTAs(context.body, caption),
    [context.body, caption]
  );

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={isPosting ? () => {} : onClose}
      title={mode === "moderator" ? "instagram-force-post" : "instagram-cross-post"}
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
              !preview ||
              !!previewError ||
              isLoadingPreview ||
              alreadyPublished ||
              captionOver ||
              !caption.trim()
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
            <VStackLike>
              <Spinner size="md" color="primary" />
              <Text fontFamily="mono" fontSize="xs" color="dim">
                Building preview…
              </Text>
            </VStackLike>
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
          <Box display="flex" flexDirection="column" gap={4}>
            {/* Meta strip */}
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
                  colorScheme={isCarousel ? "green" : isReel ? "purple" : "blue"}
                  fontFamily="mono"
                >
                  {isCarousel ? `Carousel · ${carouselItems.length}` : isReel ? "Reel" : "Photo"}
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

            {/* Media preview */}
            {isCarousel ? (
              // Carousel — horizontal thumbnail strip in publish order.
              <Box
                display="flex"
                gap={2}
                overflowX="auto"
                py={1}
                css={{ scrollSnapType: "x mandatory" }}
              >
                {carouselItems.map((item, i) => (
                  <Box
                    key={`${item.url}-${i}`}
                    position="relative"
                    flex="0 0 auto"
                    w="96px"
                    h="120px"
                    bg="black"
                    border="1px solid"
                    borderColor="border"
                    borderRadius="md"
                    overflow="hidden"
                  >
                    {item.type === "video" ? (
                      <>
                        <video
                          src={item.url}
                          muted
                          playsInline
                          preload="metadata"
                          style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
                        />
                        <Box
                          position="absolute"
                          top="2px"
                          right="3px"
                          fontSize="10px"
                          color="white"
                          textShadow="0 0 3px #000"
                        >
                          ▶
                        </Box>
                      </>
                    ) : (
                      <ChakraImage
                        src={item.url}
                        alt={`item ${i + 1}`}
                        w="100%"
                        h="100%"
                        objectFit="cover"
                      />
                    )}
                    <Box
                      position="absolute"
                      bottom="2px"
                      left="3px"
                      fontFamily="mono"
                      fontSize="9px"
                      color="white"
                      textShadow="0 0 3px #000"
                    >
                      {i + 1}/{carouselItems.length}
                    </Box>
                  </Box>
                ))}
              </Box>
            ) : (
              <Box bg="black" border="1px solid" borderColor="border" borderRadius="md" overflow="hidden">
                {isReel && mediaUrl ? (
                  <AspectRatio ratio={4 / 5}>
                    <video src={mediaUrl} controls playsInline style={{ objectFit: "contain", background: "#000" }} />
                  </AspectRatio>
                ) : mediaUrl ? (
                  <AspectRatio ratio={4 / 5}>
                    <ChakraImage
                      src={mediaUrl}
                      alt={`Cross-post by @${context.hiveAuthor}`}
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
            )}

            {/* Editable caption */}
            <Box>
              <HStack justify="space-between" mb={1}>
                <Text
                  fontFamily="mono"
                  fontSize="2xs"
                  color="dim"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  Caption (legenda)
                </Text>
                <Text fontFamily="mono" fontSize="2xs" color={captionOver ? "red.400" : "dim"}>
                  {caption.length} / {IG_CAPTION_LIMIT}
                </Text>
              </HStack>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={IG_CAPTION_LIMIT + 200}
                minH="160px"
                fontFamily="mono"
                fontSize="sm"
                color="text"
                bg="background"
                borderColor={captionOver ? "red.400" : "border"}
                whiteSpace="pre-wrap"
                placeholder="Write the Instagram caption…"
              />
            </Box>

            {/* Smart suggestions — tap to append to the caption */}
            {suggestions.length > 0 && (
              <Box>
                <Text
                  fontFamily="mono"
                  fontSize="2xs"
                  color="dim"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  mb={1}
                >
                  Suggestions
                </Text>
                <Wrap>
                  {suggestions.map((s) => (
                    <WrapItem key={s.id}>
                      <Button
                        size="xs"
                        variant="outline"
                        colorScheme={s.kind === "trick" || s.kind === "hashtag" ? "blue" : "green"}
                        fontFamily="mono"
                        borderRadius="full"
                        leftIcon={<FaPlus size={9} />}
                        onClick={() =>
                          setCaption((prev) => appendSuggestion(prev, s, IG_CAPTION_LIMIT))
                        }
                        isDisabled={isPosting}
                      >
                        {s.label}
                      </Button>
                    </WrapItem>
                  ))}
                </Wrap>
              </Box>
            )}

            {/* Collaborators */}
            <Box>
              <Text
                fontFamily="mono"
                fontSize="2xs"
                color="dim"
                textTransform="uppercase"
                letterSpacing="wider"
                mb={1}
              >
                Collaborators ({collaborators.length} / {MAX_COLLABORATORS})
              </Text>
              {collaborators.length > 0 && (
                <Wrap mb={2}>
                  {collaborators.map((c) => (
                    <WrapItem key={c}>
                      <Tag size="md" colorScheme="purple" fontFamily="mono" borderRadius="full">
                        <TagLabel>@{c}</TagLabel>
                        <TagCloseButton onClick={() => removeCollaborator(c)} isDisabled={isPosting} />
                      </Tag>
                    </WrapItem>
                  ))}
                </Wrap>
              )}
              {collaborators.length < MAX_COLLABORATORS && (
                <HStack>
                  <Input
                    value={collabInput}
                    onChange={(e) => setCollabInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCollaborator();
                      }
                    }}
                    placeholder="add IG username"
                    size="sm"
                    fontFamily="mono"
                    bg="background"
                    borderColor="border"
                  />
                  <Button
                    size="sm"
                    leftIcon={<FaPlus />}
                    onClick={addCollaborator}
                    isDisabled={!collabInput.trim() || isPosting}
                    fontFamily="mono"
                    variant="outline"
                  >
                    Add
                  </Button>
                </HStack>
              )}
              <Text fontFamily="mono" fontSize="2xs" color="dim" mt={1}>
                Each gets an invite to co-author — the post appears on their feed once they accept.
              </Text>
            </Box>

            {requireSignature && walletUser && aioha ? (
              <Text fontFamily="mono" fontSize="2xs" color="dim">
                Confirming opens Keychain to sign a one-shot authorization (bound to this snap, expires in 5
                minutes).
              </Text>
            ) : null}
          </Box>
        )}
      </Box>
    </SkateModal>
  );
}

/** Tiny vertical stack used only by the loading state. */
function VStackLike({ children }: { children: React.ReactNode }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
      {children}
    </Box>
  );
}
