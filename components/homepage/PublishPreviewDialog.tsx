"use client";

/**
 * Unified "prepare & publish" stepper (typeform-style).
 *
 * Opens on Post when media is attached. Walks the user through one focused step
 * per concern, approve-and-edit style, with a live preview alongside:
 *   1. Trim       — trim the raw clip (video only)
 *   2. Hive       — pick the cover frame + caption (+ Hive preview)
 *   3. Farcaster  — mirrors Hive; AUTO-SKIPPED going forward, reachable via Back
 *   4. Instagram  — caption (seeded from Hive + a default CTA) + collaborators
 *
 * For video, media prep is owned here: the raw clip is held un-uploaded by the
 * composer, trimmed + cover-captured locally (no CORS), then on Publish it is
 * trimmed → cover uploaded → transcoded, and the final URLs + per-network
 * captions/collaborators are handed back to the composer to publish everywhere.
 *
 * Text-only posts never reach this dialog — the composer publishes them directly.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
  AspectRatio,
} from "@chakra-ui/react";
import { FaInstagram, FaHive, FaPlus } from "react-icons/fa";
import { SiFarcaster } from "react-icons/si";
import SkateModal from "@/components/shared/SkateModal";
import VideoTimeline from "./VideoTimeline";
import { InstagramPostPreview } from "./InstagramPreviewModal";
import type { CarouselMediaItem } from "@/lib/instagram/extractPostMedia";
import { createTrimmedVideo, loadFFmpeg } from "@/lib/utils/videoTrim";
import { useTranslations } from "@/contexts/LocaleContext";

export interface PublishImage {
  url: string;
  fileName?: string;
  caption?: string;
}

export interface PublishTargets {
  hive: boolean;
  instagram: boolean;
  farcaster: boolean;
}

export interface PublishResult {
  /** Master caption — used for the Hive post. */
  caption: string;
  /** Farcaster cast text (defaults to the Hive caption). */
  farcasterCaption: string;
  /** Instagram caption (Hive caption + default CTA, editable). */
  igCaption: string;
  /** Instagram collaborator handles (co-author invites). */
  collaborators: string[];
  /** Trim range to apply (null = use the full clip). The composer does the trim. */
  trim: { start: number; end: number } | null;
  /** Captured cover frame to upload as the thumbnail (video posts). */
  coverBlob: Blob | null;
}

interface PublishPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialCaption: string;
  images: PublishImage[];
  videoFile: File | null;
  videoLocalUrl: string | null;
  thumbnailUrl: string | null;
  hiveAuthor: string;
  igHandle: string | null;
  farcasterUsername: string | null;
  targets: PublishTargets;
  maxVideoDuration: number;
  canBypassTrim: boolean;
  onPublish: (result: PublishResult) => void;
}

type StepKey = "trim" | "hive" | "farcaster" | "instagram";

const IG_CAPTION_LIMIT = 2200;
const MAX_COLLABORATORS = 3;
const AUTO_SKIP: Set<StepKey> = new Set(["farcaster"]); // skipped going forward
/** Default Instagram call-to-action appended to the seeded IG caption. */
const DEFAULT_IG_CTA = "\n\n🛹 Tag a friend who'd session this\nFollow @skatehive for more";

const STEP_META: Record<StepKey, { label: string; icon: React.ElementType; color: string }> = {
  trim: { label: "Trim", icon: FaHive, color: "#B3FF00" },
  hive: { label: "Hive", icon: FaHive, color: "#E31337" },
  farcaster: { label: "Farcaster", icon: SiFarcaster, color: "#8A63D2" },
  instagram: { label: "Instagram", icon: FaInstagram, color: "#E1306C" },
};

function sanitizeHandle(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
}

export default function PublishPreviewDialog({
  isOpen,
  onClose,
  initialCaption,
  images,
  videoFile,
  videoLocalUrl,
  thumbnailUrl,
  hiveAuthor,
  igHandle,
  farcasterUsername,
  targets,
  maxVideoDuration,
  canBypassTrim,
  onPublish,
}: PublishPreviewDialogProps) {
  const t = useTranslations();
  const hasRawVideo = !!videoFile && !!videoLocalUrl;

  // ── Step model ──────────────────────────────────────────────────────
  const steps = useMemo<StepKey[]>(() => {
    const s: StepKey[] = [];
    if (hasRawVideo) s.push("trim");
    if (targets.hive) s.push("hive");
    if (targets.farcaster) s.push("farcaster");
    if (targets.instagram) s.push("instagram");
    // Always need at least one content step to write a caption.
    if (!s.some((k) => k !== "trim")) s.push("hive");
    return s;
  }, [hasRawVideo, targets]);

  const [idx, setIdx] = useState(0);
  const step = steps[Math.min(idx, steps.length - 1)];
  // A forward "Next" exists if any non-skipped step remains after idx.
  const hasForwardNext = steps.slice(idx + 1).some((k) => !AUTO_SKIP.has(k));

  const goNext = useCallback(() => {
    setIdx((cur) => {
      let n = cur + 1;
      while (n < steps.length && AUTO_SKIP.has(steps[n])) n++;
      return Math.min(n, steps.length - 1);
    });
  }, [steps]);

  const goBack = useCallback(() => setIdx((cur) => Math.max(cur - 1, 0)), []);
  const goToStep = useCallback(
    (key: StepKey) => {
      const i = steps.indexOf(key);
      if (i >= 0) setIdx(i);
    },
    [steps]
  );

  // ── Captions (master = Hive; Farcaster + IG seed from it) ────────────
  const [masterCaption, setMasterCaption] = useState(initialCaption);
  const [farcasterCaption, setFarcasterCaption] = useState<string | null>(null);
  const [igCaption, setIgCaption] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState(false);

  // Lazily seed the per-network captions the first time their step is shown,
  // so they pick up edits made to the master caption on the Hive step.
  useEffect(() => {
    if (step === "farcaster" && farcasterCaption === null) setFarcasterCaption(masterCaption);
    if (step === "instagram" && igCaption === null) setIgCaption(masterCaption + DEFAULT_IG_CTA);
  }, [step, farcasterCaption, igCaption, masterCaption]);

  const effFarcaster = farcasterCaption ?? masterCaption;
  const effIg = igCaption ?? masterCaption + DEFAULT_IG_CTA;

  // ── Instagram collaborators ─────────────────────────────────────────
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [collabInput, setCollabInput] = useState("");
  const addCollaborator = useCallback(() => {
    const handle = sanitizeHandle(collabInput);
    setCollabInput("");
    if (!handle) return;
    setCollaborators((prev) => (prev.includes(handle) || prev.length >= MAX_COLLABORATORS ? prev : [...prev, handle]));
  }, [collabInput]);

  // ── Video trim + cover ──────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);
  const [coverUrl, setCoverUrl] = useState<string | null>(thumbnailUrl);
  const coverBlobRef = useRef<Blob | null>(null);
  // Tracks whether the user has dragged a trim handle, so remounting the
  // <video> (e.g. clicking back to the Trim step chip) doesn't reset it.
  const hasUserTrimmedRef = useRef(false);

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    if (!hasUserTrimmedRef.current) {
      setStartTime(0);
      setEndTime(canBypassTrim ? v.duration : Math.min(v.duration, maxVideoDuration));
    }
  }, [canBypassTrim, maxVideoDuration]);

  // Manually-applied trim preview: null until the user clicks TRIM, so the
  // preview shows the full raw clip until then. Cleared whenever the handles
  // move again, since it no longer matches the selected range.
  const [isTrimming, setIsTrimming] = useState(false);
  const [trimmedPreviewUrl, setTrimmedPreviewUrl] = useState<string | null>(null);
  const [trimError, setTrimError] = useState<string | null>(null);

  // Pre-load the FFmpeg WASM engine in the background as soon as the trim UI
  // is needed, so the TRIM button is ready by the time the user reaches it.
  const [ffmpegReady, setFfmpegReady] = useState(false);
  useEffect(() => {
    if (!hasRawVideo) return;
    loadFFmpeg()
      .then(() => setFfmpegReady(true))
      .catch(() => setTrimError(t("compose.trimEngineLoadFailed")));
  }, [hasRawVideo, t]);

  const handleStartTimeChange = useCallback((time: number) => {
    hasUserTrimmedRef.current = true;
    setStartTime(time);
    setTrimmedPreviewUrl(null);
  }, []);

  const handleEndTimeChange = useCallback((time: number) => {
    hasUserTrimmedRef.current = true;
    setEndTime(time);
    setTrimmedPreviewUrl(null);
  }, []);

  // Revoke the trimmed preview blob URL whenever it's replaced or the dialog unmounts.
  useEffect(() => {
    return () => {
      if (trimmedPreviewUrl) URL.revokeObjectURL(trimmedPreviewUrl);
    };
  }, [trimmedPreviewUrl]);

  const seekTo = useCallback((time: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = time;
    setCurrentTime(time);
  }, []);

  const captureCover = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        coverBlobRef.current = blob;
        setCoverUrl((prev) => {
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      },
      "image/jpeg",
      0.9
    );
  }, []);

  const isValidSelection = !hasRawVideo || (endTime > startTime && (canBypassTrim || endTime - startTime <= maxVideoDuration + 0.05));
  const needsTrim = hasRawVideo && (startTime > 0.05 || endTime < duration - 0.05);

  // Manual "TRIM" button on step 1 — re-encodes the selected range so the
  // preview (right panel + steps 2-4) shows the actual trimmed clip and its
  // real duration. Publish-time trimming (runVideoPrep) is independent of
  // this and always re-derives the trim from startTime/endTime.
  const handleTrimClick = useCallback(async () => {
    if (!videoFile) return;
    setIsTrimming(true);
    setTrimError(null);
    try {
      const blob = await createTrimmedVideo(videoFile, startTime, endTime);
      setTrimmedPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      setTrimError(err instanceof Error ? err.message : t("compose.trimFailed"));
    } finally {
      setIsTrimming(false);
    }
  }, [videoFile, startTime, endTime, t]);

  // ── Publish ─────────────────────────────────────────────────────────
  // The dialog only COLLECTS inputs. The composer processes the video and
  // publishes in the background (with a progress toast) so this dialog can
  // close immediately instead of holding a loading state.
  const handlePublish = useCallback(() => {
    if (!masterCaption.trim()) {
      setCaptionError(true);
      goToStep(targets.hive ? "hive" : steps.find((s) => s !== "trim") ?? "hive");
      return;
    }
    onPublish({
      caption: masterCaption,
      farcasterCaption: effFarcaster,
      igCaption: effIg,
      collaborators,
      trim: needsTrim ? { start: startTime, end: endTime } : null,
      coverBlob: coverBlobRef.current,
    });
  }, [masterCaption, effFarcaster, effIg, collaborators, needsTrim, startTime, endTime, onPublish, goToStep, targets.hive, steps]);

  // ── Media shape for preview cards ───────────────────────────────────
  // Once the user applies a trim, every preview (steps 2-4 + right panel)
  // shows the trimmed clip instead of the raw upload.
  const effectiveVideoUrl = trimmedPreviewUrl || videoLocalUrl;
  const carouselItems = useMemo<CarouselMediaItem[]>(() => images.map((img) => ({ url: img.url, type: "image" as const })), [images]);
  const igMediaType: "IMAGE" | "REELS" | "CAROUSEL" = videoLocalUrl ? "REELS" : images.length >= 2 ? "CAROUSEL" : "IMAGE";
  const igMediaUrl = effectiveVideoUrl || images[0]?.url || coverUrl || null;

  const primaryLabel = hasForwardNext ? "Next →" : `Publish to ${steps.filter((s) => s !== "trim" && s !== "farcaster").map((s) => STEP_META[s].label).join(" + ")}${targets.farcaster ? " + Farcaster" : ""}`;

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title="prepare & publish"
      size={{ base: "full", md: "5xl" }}
      footer={
        <HStack spacing={3} justify="space-between" w="full">
          <Button variant="ghost" color="text" onClick={idx === 0 ? onClose : goBack} fontFamily="mono" size="sm">
            {idx === 0 ? "Cancel" : "← Back"}
          </Button>
          <Button
            variant="ghost"
            color="text"
            onClick={hasForwardNext ? goNext : handlePublish}
            isDisabled={!hasForwardNext && !isValidSelection}
            fontFamily="mono"
            size="sm"
          >
            {primaryLabel}
          </Button>
        </HStack>
      }
    >
      <Box p={5}>
        {/* Step progress header */}
        <HStack spacing={2} mb={5} flexWrap="wrap">
          {steps.map((k, i) => {
            const meta = STEP_META[k];
            const isCurrent = i === idx;
            const done = i < idx;
            return (
              <Button
                key={k}
                size="xs"
                variant={isCurrent ? "solid" : "outline"}
                bg={isCurrent ? "primary" : undefined}
                color={isCurrent ? "background" : done ? "primary" : "text"}
                borderColor={done ? "primary" : "border"}
                onClick={() => setIdx(i)}
                fontFamily="mono"
                borderRadius="full"
                leftIcon={<Box as={meta.icon} color={isCurrent ? "background" : meta.color} />}
              >
                {i + 1} · {meta.label}
                {k === "farcaster" ? " (auto)" : ""}
              </Button>
            );
          })}
        </HStack>

        <Box display="flex" flexDirection={{ base: "column", lg: "row" }} gap={6} alignItems="flex-start">
          {/* ── LEFT: current step's editor ─────────────────────────── */}
          <Box flex="1" minW={0} w="full" display="flex" flexDirection="column" gap={4}>
            {step === "trim" && hasRawVideo && (
              <>
                <Text fontFamily="mono" fontSize="sm" color="text" fontWeight="bold">
                  ✂️ Trim your clip
                </Text>
                <Box borderRadius="md" overflow="hidden" bg="black">
                  <video
                    ref={videoRef}
                    src={videoLocalUrl as string}
                    controls
                    playsInline
                    preload="metadata"
                    onLoadedMetadata={onLoadedMetadata}
                    onTimeUpdate={(e) => setCurrentTime((e.target as HTMLVideoElement).currentTime)}
                    style={{ width: "100%", maxHeight: "300px", display: "block", background: "#000" }}
                  />
                </Box>
                <Box display="flex" flexDirection="column" alignItems="center" width="100%" gap={3}>
                  {duration > 0 && (
                    <VideoTimeline
                      duration={duration}
                      currentTime={currentTime}
                      startTime={startTime}
                      endTime={endTime}
                      onSeek={seekTo}
                      onStartTimeChange={handleStartTimeChange}
                      onEndTimeChange={handleEndTimeChange}
                      onDragStart={() => {}}
                      onDragEnd={() => {}}
                    />
                  )}
                  {needsTrim && (
                    <>
                      <Button
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "var(--chakra-colors-primary)",
                          color: "var(--chakra-colors-background)",
                          border: "1px solid transparent",
                          borderRadius: 0,
                          fontWeight: "bold",
                          "&:not([disabled]):hover": {
                            background: "transparent",
                            color: "var(--chakra-colors-primary)",
                            border: "1px solid var(--chakra-colors-primary)",
                          },
                        }}
                        variant="unstyled"
                        px={4}
                        py={2}
                        size="xs"
                        onClick={handleTrimClick}
                        isDisabled={isTrimming || !ffmpegReady}
                        fontFamily="mono"
                      >
                        {t("compose.trimButton")}
                      </Button>
                      {(isTrimming || (!ffmpegReady && !trimError)) && (
                        <HStack spacing={2}>
                          <Spinner size="xs" color="primary" />
                          <Text fontFamily="mono" fontSize="2xs" color="dim">
                            {isTrimming ? t("compose.trimProcessing") : t("compose.trimEngineLoading")}
                          </Text>
                        </HStack>
                      )}
                      {!isTrimming && trimmedPreviewUrl && (
                        <Text fontFamily="mono" fontSize="2xs" color="success">{t("compose.trimApplied")}</Text>
                      )}
                    </>
                  )}
                  {trimError && (
                    <Text fontFamily="mono" fontSize="2xs" color="error">{trimError}</Text>
                  )}
                </Box>
              </>
            )}

            {step === "hive" && (
              <>
                <Text fontFamily="mono" fontSize="sm" color="text" fontWeight="bold">
                  📸 Cover &amp; caption (Hive)
                </Text>
                {hasRawVideo && (
                  <Box>
                    <Box borderRadius="md" overflow="hidden" bg="black" mb={2}>
                      {/* No onLoadedMetadata here — would reset the trim range
                          set on step 1. Cover capture reads videoWidth directly.
                          Src is the trimmed preview once the user hits TRIM on
                          step 1, so this already reflects the selected range. */}
                      <video
                        ref={videoRef}
                        src={effectiveVideoUrl as string}
                        controls
                        playsInline
                        preload="metadata"
                        style={{ width: "100%", maxHeight: "240px", display: "block", background: "#000" }}
                      />
                    </Box>
                    <HStack mb={1}>
                      <Button size="xs" variant="outline" colorScheme="green" onClick={captureCover} fontFamily="mono">
                        📸 Set cover from current frame
                      </Button>
                      {coverUrl && (
                        <Box w="44px" h="44px" borderRadius="md" overflow="hidden" border="1px solid" borderColor="border">
                          <ChakraImage src={coverUrl} alt="cover" w="100%" h="100%" objectFit="cover" />
                        </Box>
                      )}
                    </HStack>
                  </Box>
                )}
                <CaptionField
                  label="Caption"
                  value={masterCaption}
                  onChange={(v) => {
                    setMasterCaption(v);
                    if (v.trim()) setCaptionError(false);
                  }}
                  placeholder="Write your caption…"
                  error={captionError && !masterCaption.trim() ? t("compose.captionRequired") : undefined}
                />
                {targets.farcaster && (
                  <Text fontFamily="mono" fontSize="2xs" color="dim">
                    ✓ Also posting to Farcaster with this caption — step 3 to customize.
                  </Text>
                )}
              </>
            )}

            {step === "farcaster" && (
              <>
                <Text fontFamily="mono" fontSize="sm" color="text" fontWeight="bold">
                  🟪 Farcaster cast
                </Text>
                <Text fontFamily="mono" fontSize="2xs" color="dim">
                  Skipped by default — same as your Hive caption. Edit here to make it different.
                </Text>
                <CaptionField
                  label="Cast text"
                  value={effFarcaster}
                  onChange={setFarcasterCaption}
                  placeholder="Cast text…"
                />
              </>
            )}

            {step === "instagram" && (
              <>
                <Text fontFamily="mono" fontSize="sm" color="text" fontWeight="bold">
                  📷 Instagram post
                </Text>
                <CaptionField
                  label="Caption"
                  value={effIg}
                  onChange={setIgCaption}
                  limit={IG_CAPTION_LIMIT}
                  placeholder="Instagram caption…"
                />
                {/* Collaborators */}
                <Box>
                  <Text fontFamily="mono" fontSize="2xs" color="dim" textTransform="uppercase" letterSpacing="wider" mb={1}>
                    Collaborators ({collaborators.length} / {MAX_COLLABORATORS})
                  </Text>
                  {collaborators.length > 0 && (
                    <Wrap mb={2}>
                      {collaborators.map((c) => (
                        <WrapItem key={c}>
                          <Tag size="md" colorScheme="purple" fontFamily="mono" borderRadius="full">
                            <TagLabel>@{c}</TagLabel>
                            <TagCloseButton onClick={() => setCollaborators((prev) => prev.filter((x) => x !== c))} />
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
                      <Button size="sm" leftIcon={<FaPlus />} onClick={addCollaborator} isDisabled={!collabInput.trim()} fontFamily="mono" variant="outline">
                        Add
                      </Button>
                    </HStack>
                  )}
                  <Text fontFamily="mono" fontSize="2xs" color="dim" mt={1}>
                    Each gets a co-author invite — the post lands on their feed once they accept.
                  </Text>
                </Box>
              </>
            )}

          </Box>

          {/* ── RIGHT: live preview for this step ───────────────────── */}
          <Box w={{ base: "full", lg: "340px" }} flexShrink={0} alignSelf={{ lg: "flex-start" }}>
            <Text fontFamily="mono" fontSize="2xs" color="dim" textTransform="uppercase" letterSpacing="wider" mb={2}>
              Preview
            </Text>
            {step === "instagram" ? (
              <InstagramPostPreview
                targetAccount="@skatehive"
                mediaType={igMediaType}
                mediaUrl={igMediaUrl}
                carouselItems={carouselItems}
                caption={effIg}
                collaborators={collaborators}
              />
            ) : step === "farcaster" ? (
              <FarcasterCastPreview username={farcasterUsername || hiveAuthor} caption={effFarcaster} images={images} videoUrl={effectiveVideoUrl} thumbnailUrl={coverUrl} />
            ) : (
              <HivePostPreview author={hiveAuthor} caption={masterCaption} images={images} videoUrl={effectiveVideoUrl} thumbnailUrl={coverUrl} />
            )}
          </Box>
        </Box>
      </Box>
    </SkateModal>
  );
}

/** Shared caption textarea with a character counter. */
function CaptionField({
  label,
  value,
  onChange,
  disabled,
  limit,
  placeholder,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  limit?: number;
  placeholder?: string;
  error?: string;
}) {
  return (
    <Box>
      <HStack justify="space-between" mb={1}>
        <Text fontFamily="mono" fontSize="2xs" color="dim" textTransform="uppercase" letterSpacing="wider">
          {label}
        </Text>
        <Text fontFamily="mono" fontSize="2xs" color={limit && value.length > limit ? "red.400" : "dim"}>
          {value.length}
          {limit ? ` / ${limit}` : ""}
        </Text>
      </HStack>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minH="150px"
        fontFamily="mono"
        fontSize="sm"
        color="text"
        bg="background"
        borderColor={error ? "error" : "border"}
        borderWidth={error ? "2px" : "1px"}
        whiteSpace="pre-wrap"
        placeholder={placeholder}
        isDisabled={disabled}
        isInvalid={!!error}
      />
      {error && (
        <Text fontFamily="mono" fontSize="2xs" color="error" mt={1}>
          ⚠ {error}
        </Text>
      )}
    </Box>
  );
}

/** Skatehive/Hive feed-style preview card (dark theme). */
function HivePostPreview({
  author,
  caption,
  images,
  videoUrl,
  thumbnailUrl,
}: {
  author: string;
  caption: string;
  images: PublishImage[];
  videoUrl: string | null;
  thumbnailUrl: string | null;
}) {
  return (
    <Box borderRadius="lg" border="1px solid" borderColor="border" bg="panel" overflow="hidden" w="full">
      <HStack px={3} py={2.5} spacing={2.5}>
        <ChakraImage
          src={`https://images.hive.blog/u/${author}/avatar/small`}
          alt={author}
          w="34px"
          h="34px"
          borderRadius="full"
          objectFit="cover"
          flex="0 0 auto"
          fallbackSrc="https://images.hive.blog/u/null/avatar/small"
        />
        <Box minW={0}>
          <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color="text" noOfLines={1}>
            @{author}
          </Text>
          <Text fontFamily="mono" fontSize="2xs" color="dim">
            now · SkateHive
          </Text>
        </Box>
      </HStack>
      <Box px={3} pb={3}>
        <Text fontFamily="mono" fontSize="sm" color="text" whiteSpace="pre-wrap" wordBreak="break-word" mb={images.length || videoUrl ? 3 : 0}>
          {caption || <Text as="span" color="dim">Your post preview…</Text>}
        </Text>
        {videoUrl ? (
          <Box borderRadius="md" overflow="hidden" bg="black">
            <video src={videoUrl} controls playsInline poster={thumbnailUrl || undefined} style={{ width: "100%", display: "block" }} />
          </Box>
        ) : images.length > 0 ? (
          <Box display="grid" gridTemplateColumns={images.length > 1 ? "1fr 1fr" : "1fr"} gap={1} borderRadius="md" overflow="hidden">
            {images.slice(0, 4).map((img, i) => (
              <AspectRatio key={`${img.url}-${i}`} ratio={images.length === 1 ? 4 / 3 : 1}>
                <ChakraImage src={img.url} alt={img.caption || `image ${i + 1}`} objectFit="cover" />
              </AspectRatio>
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

/** Farcaster cast-style preview card. */
function FarcasterCastPreview({
  username,
  caption,
  images,
  videoUrl,
  thumbnailUrl,
}: {
  username: string;
  caption: string;
  images: PublishImage[];
  videoUrl: string | null;
  thumbnailUrl: string | null;
}) {
  const embedUrl = images[0]?.url || thumbnailUrl || null;
  return (
    <Box borderRadius="lg" border="1px solid" borderColor="border" bg="panel" overflow="hidden" w="full">
      <HStack px={3} py={2.5} spacing={2.5} align="flex-start">
        <Center w="34px" h="34px" borderRadius="full" bg="#8A63D2" color="white" fontFamily="mono" fontWeight="bold" fontSize="sm" flex="0 0 auto">
          {username.slice(0, 1).toUpperCase()}
        </Center>
        <Box flex="1" minW={0}>
          <Text fontFamily="mono" fontSize="sm" color="text" noOfLines={1}>
            <Text as="span" fontWeight="bold">{username}</Text>{" "}
            <Text as="span" color="dim">@{username} · now</Text>
          </Text>
          <Text fontFamily="mono" fontSize="sm" color="text" whiteSpace="pre-wrap" wordBreak="break-word" mt={1}>
            {caption || <Text as="span" color="dim">Your cast preview…</Text>}
          </Text>
          {videoUrl ? (
            <Box mt={2} borderRadius="md" overflow="hidden" border="1px solid" borderColor="border" bg="black">
              <video src={videoUrl} controls playsInline poster={thumbnailUrl || undefined} style={{ width: "100%", display: "block" }} />
            </Box>
          ) : embedUrl ? (
            <Box mt={2} borderRadius="md" overflow="hidden" border="1px solid" borderColor="border">
              <AspectRatio ratio={1.91}>
                <ChakraImage src={embedUrl} alt="embed" objectFit="cover" />
              </AspectRatio>
            </Box>
          ) : null}
        </Box>
      </HStack>
    </Box>
  );
}
