"use client";

import React, { useState, useRef, useMemo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "@/contexts/LocaleContext";
import { useSkateDialog } from "@/hooks/useSkateDialog";
import {
  Box,
  Textarea,
  HStack,
  Button,
  ButtonGroup,
  Image,
  IconButton,
  Wrap,
  Progress,
  Input,
  Tooltip,
  Text,
  Icon,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuOptionGroup,
  MenuItemOption,
  MenuDivider,
  Checkbox,
  Link as ChakraLink,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  FormControl,
  FormLabel,
  InputGroup,
  InputLeftAddon,
  useToast,
  useBreakpointValue,
} from "@chakra-ui/react";
import NextLink from "next/link";
import { ChevronDownIcon } from "@chakra-ui/icons";
import { SiFarcaster } from "react-icons/si";
import { useAioha } from "@aioha/react-ui";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";
import GiphySelector from "./GiphySelector";
import VideoUploader, {
  VideoUploaderRef,
  ErrorDemoPanel,
} from "./VideoUploader";
import { type TrimmedVideoFile } from "./VideoTrimModal";

// Lazy load heavy modals
const VideoTrimModal = dynamic(() => import("./VideoTrimModal"), { ssr: false });
const InstagramModal = dynamic(() => import("./InstagramModal"), { ssr: false });
// Outbound IG cross-post review/edit dialog (caption + collaborators).
const InstagramCrossPostDialog = dynamic(() => import("./InstagramPreviewModal"), { ssr: false });
import type { CrossPostContext } from "./InstagramPreviewModal";
// Unified pre-publish review dialog (caption + Hive/Instagram/Farcaster previews).
const PublishPreviewDialog = dynamic(() => import("./PublishPreviewDialog"), { ssr: false });
import { publishSnapToInstagram } from "@/lib/instagram/publishSnap";
import { createTrimmedVideo } from "@/lib/utils/videoTrim";
import { uploadThumbnail } from "@/lib/utils/videoThumbnailUtils";
import { processVideoOnServer } from "@/lib/utils/videoProcessing";
import { IGif } from "@giphy/js-types";
import { FaImage } from "react-icons/fa";
import { FaInstagram } from "react-icons/fa";
import { Discussion } from "@hiveio/dhive";
import {
  getFileSignature,
  getLastSnapsContainer,
  uploadImage,
} from "@/lib/hive/client-functions";
import HiveClient from "@/lib/hive/hiveclient";
import { waitForHivePost } from "@/lib/hive/waitForPost";
import { APP_CONFIG, HIVE_CONFIG } from "@/config/app.config";
import { extractIPFSHash } from "@/lib/utils/ipfsMetadata";
import {
  generateThumbnail,
} from "@/lib/utils/videoThumbnailUtils";
import { generateVideoIframeMarkdown, uploadToIpfs } from "@/lib/markdown/composeUtils";
import { FaVideo } from "react-icons/fa6";
import { FaTimes } from "react-icons/fa";
import ImageCompressor from "@/lib/utils/ImageCompressor";
import { ImageCompressorRef } from "@/lib/utils/ImageCompressor";
import imageCompression from "browser-image-compression";
import { isHeicFile, convertHeicIfNeeded } from "@/lib/utils/heicToJpeg";

import type { GIFMakerRef as GIFMakerWithSelectorRef } from "./GIFMakerWithSelector";
// FFmpeg (loaded inside this component) touches browser-only globals at
// module init, which crashes SSR if bundled into the server render.
const GIFMakerWithSelector = dynamic(() => import("./GIFMakerWithSelector"), { ssr: false });
import useHivePower from "@/hooks/useHivePower";
import { useInstagramHealth } from "@/hooks/useInstagramHealth";
import { TbGif } from "react-icons/tb";
import MatrixOverlay from "@/components/graphics/MatrixOverlay";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { buildSnapCastText, buildSnapCastEmbeds } from "@/lib/crosspost/snapCast";
import { getSnapDraft, saveSnapDraft, clearSnapDraft } from "@/lib/compose/snapDraft";

// Channels enabled for Farcaster cross-posting. Mirrors the server-side
// whitelist in /api/farcaster/cast/route.ts — keep them in sync.
const FARCASTER_CHANNELS = [
  { id: "skateboard", label: "/skateboard" },
  { id: "gnars", label: "/gnars" },
  { id: "higher", label: "/higher" },
] as const;

// Check for demo mode via localStorage
const SHOW_ERROR_DEMO =
  typeof window !== "undefined" &&
  localStorage.getItem("SKATEHIVE_ERROR_DEMO") === "true";

interface SnapComposerProps {
  pa: string;
  pp: string;
  onNewComment: (newComment: Partial<Discussion>) => void;
  post?: boolean;
  onClose: () => void;
  submitLabel?: string;
  buttonSize?: "sm" | "md" | "lg";
  /** When true, renders the reply-specific media button styles
   *  (plain buttons, no hover effects). DestinationMenu renders in both modes.
   *  Only the Snap.tsx inline reply composer opts into this. */
  isReply?: boolean;
}

/** Rich progress toast for background video publishing: cover thumb + bar. */
function PublishProgressToast({
  cover,
  title,
  stage,
  progress,
  tone = "loading",
}: {
  cover: string | null;
  title: string;
  stage: string;
  progress: number;
  tone?: "loading" | "success" | "error";
}) {
  const accent = tone === "error" ? "red.400" : tone === "success" ? "green.400" : "primary";
  return (
    <Box
      bg="background"
      border="1px solid"
      borderColor={accent}
      borderRadius="md"
      p={3}
      boxShadow="lg"
      minW="300px"
      maxW="360px"
    >
      <HStack spacing={3} align="center">
        {cover ? (
          <Image src={cover} alt="" boxSize="46px" borderRadius="md" objectFit="cover" flexShrink={0} />
        ) : (
          <Box boxSize="46px" borderRadius="md" bg="muted" flexShrink={0} />
        )}
        <Box flex="1" minW={0}>
          <Text fontFamily="mono" fontSize="sm" color="text" fontWeight="bold" noOfLines={1}>
            {title}
          </Text>
          <Text fontFamily="mono" fontSize="2xs" color="dim" noOfLines={1}>
            {stage}
          </Text>
          <Progress
            value={progress}
            size="xs"
            colorScheme={tone === "error" ? "red" : "green"}
            borderRadius="full"
            mt={2}
            hasStripe={tone === "loading"}
            isAnimated={tone === "loading"}
          />
        </Box>
      </HStack>
    </Box>
  );
}

const SnapComposer = React.memo(function SnapComposer({
  pa,
  pp,
  onNewComment,
  post = false,
  onClose,
  submitLabel,
  buttonSize = "lg",
  isReply = false,
}: SnapComposerProps) {
  const { user, aioha } = useAioha();
  const { handle: effectiveUser, canUseAppFeatures } = useEffectiveHiveUser();
  const { hiveIdentity: userbaseHiveIdentity, connections } = useLinkedIdentities();
  const { user: userbaseUser } = useUserbaseAuth();
  const { profile: farcasterProfile } = useFarcasterSession();
  const linkedHiveHandle = userbaseHiveIdentity?.handle || null;

  // Farcaster cross-post eligibility: linked Farcaster identity on the
  // userbase account. Signer approval gates the Farcaster/Both choices.
  const farcasterIdentity = connections.farcaster.identities[0] || null;
  const farcasterEligible = !!farcasterIdentity;
  const farcasterSignerApproved =
    (farcasterIdentity?.metadata as Record<string, unknown> | undefined)?.signer_status ===
    "approved";
  const farcasterLinkage = useMemo(() => {
    const fidRaw = farcasterIdentity?.external_id;
    const fid = fidRaw ? Number(fidRaw) : farcasterProfile?.fid;
    const username = farcasterIdentity?.handle || farcasterProfile?.username || null;
    if (!fid || !username) return null;
    return { fid, username };
  }, [farcasterIdentity, farcasterProfile]);
  // Default: opt-in to every linked platform. DestinationMenu filters the
  // rendered checkboxes by actual eligibility (e.g. won't surface
  // Farcaster as checked if the signer isn't approved), and handleComment
  // re-checks `farcasterLinkage` before firing the cast — so defaulting
  // these to true is safe even when Farcaster isn't actually usable.
  const [postToHive, setPostToHive] = useState(true);
  const [postToFarcaster, setPostToFarcaster] = useState(true);
  // Default Farcaster channel: /skateboard. Most cross-posts belong in
  // the community channel — pick "no channel (your feed)" or one of the
  // other allowed channels via the dropdown if you want different.
  const [farcasterChannel, setFarcasterChannel] = useState<string | null>(
    "skateboard"
  );
  const toast = useToast();
  // Publishing progress shows as a top banner on mobile (Instagram-style pinned
  // row) and a bottom-right toast on desktop.
  const publishToastPosition = useBreakpointValue<"top" | "bottom-right">({
    base: "top",
    md: "bottom-right",
  });
  const t = useTranslations();
  const { prompt, SkateDialogComponent } = useSkateDialog();
  const postBodyRef = useRef<HTMLTextAreaElement>(null);
  const [selectedGif, setSelectedGif] = useState<IGif | null>(null);
  const [isGiphyModalOpen, setGiphyModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  // Thumbnail captured from the local video file (canvas → IPFS) so the
  // snap's OG image / Farcaster frame can render a real preview instead
  // of the SkateHive fallback. Generated in parallel with the transcode
  // so it almost always finishes before the user posts.
  const [videoThumbnailUrl, setVideoThumbnailUrl] = useState<string | null>(null);
  const ffmpegRef = useRef<any>(null);
  const [videoProcessingError, setVideoProcessingError] = useState<
    string | null
  >(null);
  const videoUploaderRef = useRef<VideoUploaderRef>(null);
  const imageCompressorRef = useRef<ImageCompressorRef>(null);
  const [compressedImages, setCompressedImages] = useState<
    { url: string; fileName: string; caption: string }[]
  >([]);

  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const snapDraftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // GIF maker state and refs (direct integration)
  const [isGifMakerOpen, setGifMakerOpen] = useState(false);
  const gifMakerWithSelectorRef = useRef<GIFMakerWithSelectorRef>(null);
  const [isProcessingGif, setIsProcessingGif] = useState(false);

  // Instagram modal state (for importing IG content into a snap)
  const [isInstagramModalOpen, setInstagramModalOpen] = useState(false);

  // Instagram cross-post (outbound) state. Only meaningful for main-feed
  // snaps (parent permlink === THREADS.PERMLINK) with attached media.
  // Default is true so eligible users (100+ HP, main feed, media attached)
  // get IG cross-posting auto-checked alongside SkateHive + Farcaster.
  // The DestinationMenu disables the row when there's no media yet, so
  // text-only drafts can't accidentally send to IG.
  const [instagramCrossPost, setInstagramCrossPost] = useState(true);

  // When a snap with IG cross-post enabled is published, we open a review
  // dialog (edit caption + collaborators) instead of firing IG immediately.
  const [igDialog, setIgDialog] = useState<CrossPostContext | null>(null);
  const isMainFeedSnap = pp === HIVE_CONFIG.THREADS.PERMLINK;
  const hasCrossPostMedia = compressedImages.length > 0 || !!videoUrl;

  // Pre-publish review dialog: on Post with media, preview every destination
  // before publishing. The ref lets the dialog re-invoke handleComment to
  // actually publish without re-opening the dialog.
  const publishConfirmedRef = useRef(false);
  const [showPublishPreview, setShowPublishPreview] = useState(false);
  // Set true after the dialog processes media + sets final URLs; an effect then
  // runs handleComment on the next render so it reads the fresh state.
  const [pendingPublish, setPendingPublish] = useState(false);
  // True while a publish is processing in the background (video prep + posting).
  // The composer hides its attached media while this is on, so the post "leaves"
  // the composer and lives in the progress toast instead.
  const [isPublishing, setIsPublishing] = useState(false);
  // Per-network content the publish dialog collected (IG caption + collaborators,
  // Farcaster caption). Read by handleComment when it fires the cross-posts.
  const igPublishRef = useRef<{ igCaption: string; collaborators: string[]; farcasterCaption: string } | null>(null);

  // Cached IG handle status. 'unknown' until first lookup; 'present' means
  // the server already has a tag-able value (DB or Hive metadata); 'absent'
  // means we should prompt the user when they enable cross-post.
  const [igHandleStatus, setIgHandleStatus] = useState<
    "unknown" | "present" | "absent"
  >("unknown");
  const [igHandleValue, setIgHandleValue] = useState<string | null>(null);
  // Dialog state for the inline "what's your IG?" prompt that fires when the
  // user flips the cross-post switch ON without a stored handle.
  const [igPromptOpen, setIgPromptOpen] = useState(false);
  const [igPromptInput, setIgPromptInput] = useState("");
  const [igPromptSubmitting, setIgPromptSubmitting] = useState(false);

  // Error demo panel state
  const [showErrorDemo, setShowErrorDemo] = useState(SHOW_ERROR_DEMO);

  // Instagram server health check - only check when modal is open
  const instagramHealth = useInstagramHealth(isInstagramModalOpen, 120000);

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadCount, setUploadCount] = useState(0);
  const isUploadingMedia = uploadCount > 0;

  // Video duration error handling
  const [videoDurationError, setVideoDurationError] = useState<string | null>(
    null
  );

  // Video trimming modal state
  const [isTrimModalOpen, setIsTrimModalOpen] = useState(false);
  const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);

  // Get user's Hive Power to determine if they can bypass the 15s limit
  const { hivePower } = useHivePower(effectiveUser || "");
  const canBypassLimit = useMemo(
    () => hivePower !== null && hivePower >= 100,
    [hivePower]
  );

  // Lazy-load IG handle status once cross-post is potentially relevant.
  // Single API call that checks DB + Hive metadata, so we know whether to
  // prompt when the user flips the cross-post switch on.
  React.useEffect(() => {
    if (!isMainFeedSnap || !canBypassLimit || igHandleStatus !== "unknown") {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/userbase/profile/instagram", {
          credentials: "include",
        });
        if (!res.ok) {
          if (!cancelled) setIgHandleStatus("absent");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data?.handle) {
          setIgHandleValue(data.handle);
          setIgHandleStatus("present");
        } else {
          setIgHandleStatus("absent");
        }
      } catch {
        if (!cancelled) setIgHandleStatus("absent");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isMainFeedSnap, canBypassLimit, igHandleStatus]);

  // Restore snap draft on mount — main feed instance only (silent, no indicator)
  useEffect(() => {
    if (!isMainFeedSnap) return;
    const draft = getSnapDraft();
    if (!draft) return;
    if (draft.body && postBodyRef.current) {
      postBodyRef.current.value = draft.body;
    }
    if (draft.images.length > 0) {
      setCompressedImages(
        draft.images.map(({ url, caption }) => ({
          url,
          fileName: url.split("/").pop()?.split("?")[0] || "image",
          caption,
        }))
      );
    }
    if (draft.videoUrl) {
      setVideoUrl(draft.videoUrl);
    }
    // gifUrl: not restored — selectedGif requires a full IGif object and Giphy
    // GIFs are preview-only (they don't make it into post bodies), so nothing is lost
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave: debounced save after body/image/gif/video changes — main feed only
  const doSaveSnapDraft = useCallback(() => {
    if (!isMainFeedSnap) return;
    const body = postBodyRef.current?.value || "";
    const images = compressedImages.map((img) => ({ url: img.url, caption: img.caption }));
    const gifUrl = selectedGif?.images?.downsized_medium?.url ?? null;
    // blob: URLs are session-only local previews; only persist hosted URLs
    const persistedVideoUrl = videoUrl?.startsWith("blob:") ? null : videoUrl;
    if (!body.trim() && images.length === 0 && !gifUrl && !persistedVideoUrl) {
      clearSnapDraft();
      return;
    }
    saveSnapDraft({ body, images, gifUrl, videoUrl: persistedVideoUrl });
  }, [isMainFeedSnap, compressedImages, selectedGif, videoUrl]);

  const cancelSnapDraftSave = useCallback(() => {
    if (snapDraftTimerRef.current) {
      clearTimeout(snapDraftTimerRef.current);
      snapDraftTimerRef.current = null;
    }
  }, []);

  const scheduleSnapDraftSave = useCallback(() => {
    if (!isMainFeedSnap) return;
    cancelSnapDraftSave();
    snapDraftTimerRef.current = setTimeout(doSaveSnapDraft, 1000);
  }, [isMainFeedSnap, cancelSnapDraftSave, doSaveSnapDraft]);

  // Fire debounced save when media state changes (main feed only)
  useEffect(() => {
    if (!isMainFeedSnap) return;
    scheduleSnapDraftSave();
  }, [isMainFeedSnap, scheduleSnapDraftSave]);

  const buttonText = useMemo(
    () => submitLabel || (post ? "Reply" : "Post"),
    [submitLabel, post]
  );

  // Function to extract hashtags from text - memoized
  const extractHashtags = useCallback((text: string): string[] => {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex) || [];
    return matches.map((hashtag) => hashtag.slice(1)); // Remove the '#' symbol
  }, []);

  // Helper functions to manage upload count - memoized
  const startUpload = useCallback(() => setUploadCount((c) => c + 1), []);
  const finishUpload = useCallback(
    () => setUploadCount((c) => Math.max(0, c - 1)),
    []
  );

  // Helper function to insert image URL into textarea
  const insertImageUrlIntoTextarea = useCallback((url: string, fileName: string) => {
    if (!postBodyRef.current) return;
    
    const textarea = postBodyRef.current;
    const currentValue = textarea.value;
    const cursorPosition = textarea.selectionStart;
    
    // Create markdown image syntax
    const imageMarkdown = `\n![${fileName}](${url})\n`;
    
    // Insert at cursor position or at end
    const newValue = currentValue.slice(0, cursorPosition) + 
                     imageMarkdown + 
                     currentValue.slice(cursorPosition);
    
    // Update textarea value
    textarea.value = newValue;
    
    // Set cursor position after the inserted image
    const newCursorPosition = cursorPosition + imageMarkdown.length;
    textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    
    // Focus the textarea
    textarea.focus();
  }, []);

  // Helper function to get video duration
  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        resolve(video.duration);
        URL.revokeObjectURL(video.src);
      };
      video.onerror = () => {
        reject(new Error("Failed to load video"));
        URL.revokeObjectURL(video.src);
      };
      video.src = URL.createObjectURL(file);
    });
  };

  // Handle video file selection. We DON'T trim/upload here anymore — the raw
  // clip is held un-uploaded and a local preview is shown. Trim + cover + the
  // transcoder upload all happen in the "prepare & publish" dialog when the
  // user posts (so everything is edited in one place before publishing).
  const handleVideoFile = async (file: File) => {
    try {
      // Revoke any previous local preview URL to avoid leaks.
      if (videoUrl && videoUrl.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
      setVideoThumbnailUrl(null);
      const localUrl = URL.createObjectURL(file);
      setPendingVideoFile(file); // raw file → handed to the publish dialog
      setVideoUrl(localUrl); // local preview; replaced with the hosted URL on publish
    } catch (error) {
      console.error("Error preparing video:", error);
      alert(
        t('compose.videoProcessFailed') + ": " +
        (error instanceof Error ? error.message : String(error))
      );
    }
  };

  // Handle trim modal completion
  const handleTrimComplete = async (result: TrimmedVideoFile) => {
    if (videoUploaderRef.current) {
      // Let VideoUploader handle its own upload state
      await videoUploaderRef.current.handleFile(result);
    }
    setPendingVideoFile(null);
    // Trim modal already generated a thumbnail blob URL during preview.
    // Upload it to IPFS in the background so it has a durable URL we
    // can persist in json_metadata.thumbnail.
    if (result.thumbnailUrl) {
      (async () => {
        try {
          const blob = await fetch(result.thumbnailUrl!).then((r) => r.blob());
          const { uploadThumbnail } = await import(
            "@/lib/utils/videoThumbnailUtils"
          );
          const uploaded = await uploadThumbnail(blob, effectiveUser || undefined);
          if (uploaded) setVideoThumbnailUrl(uploaded);
        } catch (err) {
          console.warn(
            "[SnapComposer] Trimmed-video thumbnail upload failed, falling back:",
            err
          );
          // Fall back to generating + uploading from the trimmed file
          generateThumbnail(result.file, ffmpegRef, effectiveUser || undefined)
            .then((thumbUrl) => {
              if (thumbUrl) setVideoThumbnailUrl(thumbUrl);
            })
            .catch(() => {});
        }
      })();
    } else {
      generateThumbnail(result.file, ffmpegRef, effectiveUser || undefined)
        .then((thumbUrl) => {
          if (thumbUrl) setVideoThumbnailUrl(thumbUrl);
        })
        .catch(() => {});
    }
  };

  // Handle trim modal close
  const handleTrimModalClose = () => {
    setIsTrimModalOpen(false);
    // Don't immediately clear pendingVideoFile to prevent blob URL errors
    // It will be cleared when upload completes or new file is selected
  };

  // Upload image to Hive first, fall back to IPFS if Hive fails
  const uploadImageWithFallback = async (
    file: File,
    index: number,
    progressSetter: React.Dispatch<React.SetStateAction<number[]>>
  ): Promise<string> => {
    try {
      const signature = await getFileSignature(file);
      const url = await uploadImage(file, signature, index, progressSetter);
      if (url) return url;
      throw new Error('Hive upload returned empty URL');
    } catch (hiveError) {
      console.warn('⚠️ [SnapComposer] Hive image upload failed, trying IPFS fallback...', hiveError);
      try {
        const ipfsUrl = await uploadToIpfs(file, file.name);
        console.log('✅ [SnapComposer] IPFS fallback succeeded:', ipfsUrl);
        return ipfsUrl;
      } catch (ipfsError) {
        console.error('❌ [SnapComposer] Both Hive and IPFS uploads failed');
        throw new Error(
          `Upload failed. Hive: ${hiveError instanceof Error ? hiveError.message : String(hiveError)}. IPFS: ${ipfsError instanceof Error ? ipfsError.message : String(ipfsError)}`
        );
      }
    }
  };

  // Handler for compressed image upload
  const handleCompressedImageUpload = useCallback(async (
    url: string | null,
    fileName?: string
  ) => {
    if (!url) return;
    console.log('🖼️ [SnapComposer] handleCompressedImageUpload called with:', fileName);
    startUpload();
    setIsLoading(true);
    try {
      console.log('🖼️ [SnapComposer] Fetching blob from URL...');
      const blob = await fetch(url).then((res) => res.blob());
      const file = new File([blob], fileName || "compressed.jpg", {
        type: blob.type,
      });
      console.log('🖼️ [SnapComposer] Created file:', file.name, 'type:', file.type, 'size:', file.size);

      // SEO: Prompt user for image description
      const userDescription = await prompt(
        'Describe this image (for SEO & accessibility):',
        {
          tip: 'Tip: Be specific! Example: "Kickflip at Venice Skatepark"',
          placeholder: 'Type your description here...',
          confirmText: 'OK',
          confirmColor: 'limegreen',
        }
      );

      // Generate alt text (caption)
      let caption = '';
      if (userDescription && userDescription.trim()) {
        caption = userDescription.trim();
      } else {
        // Fallback to cleaned filename
        caption = (fileName || 'Skateboarding photo')
          .replace(/\.[^.]+$/, '') // Remove extension
          .replace(/[-_]/g, ' ')   // Dashes to spaces
          .replace(/\d{8,}/g, '')  // Remove timestamps
          .trim() || 'Skateboarding photo';
      }

      // Ensure meaningful caption (min 10 chars)
      if (caption.length < 10) {
        caption = 'Skateboarding photo';
      }

      console.log('🖼️ [SnapComposer] Uploading image (Hive → IPFS fallback)...');

      const uploadUrl = await uploadImageWithFallback(
        file,
        compressedImages.length,
        setUploadProgress
      );
      console.log('🖼️ [SnapComposer] Upload complete, URL:', uploadUrl);

      if (uploadUrl) {
        setCompressedImages((prev) => [
          ...prev,
          { url: uploadUrl, fileName: file.name, caption },
        ]);
        console.log('✅ [SnapComposer] Image added with caption:', caption);
      }
    } catch (error) {
      console.error("❌ [SnapComposer] Error uploading compressed image:", error);
      alert(t('compose.imageUploadFailed') + ": " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
      finishUpload();
    }
  }, [startUpload, finishUpload, prompt, compressedImages.length, t]);

  const handleGifWebpUpload = useCallback(async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    console.log('🎨 [handleGifWebpUpload] File selected:', file?.name, 'type:', file?.type);
    if (!file) return;
    // Check file type
    if (!(file.type === "image/gif" || file.type === "image/webp")) {
      alert(t('compose.onlyGifWebp'));
      return;
    }
    // Check file size (limit to 15MB for GIF/WEBP)
    if (file.size > 15 * 1024 * 1024) {
      alert(t('compose.gifSizeLimit'));
      return;
    }
    startUpload();
    setIsLoading(true);
    try {
      const uploadUrl = await uploadImageWithFallback(
        file,
        compressedImages.length,
        setUploadProgress
      );
      if (uploadUrl) {
        // Generate caption for GIF/WEBP (no prompt, just clean filename)
        const caption = file.name
          .replace(/\.[^.]+$/, '') // Remove extension
          .replace(/[-_]/g, ' ')   // Dashes to spaces
          .trim() || 'Skateboarding GIF';

        setCompressedImages((prev) => [
          ...prev,
          { url: uploadUrl, fileName: file.name, caption },
        ]);
      }
    } catch (error) {
      console.error("Error uploading GIF/WEBP:", error);
      toast({
        title: t('compose.imageUploadFailed') || "Upload failed",
        description: error instanceof Error ? error.message : String(error),
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
      finishUpload();
      e.target.value = ""; // Reset input
    }
  }, [startUpload, finishUpload, toast, t, compressedImages.length]);

  // Simple video upload handler for ref-based input
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleVideoFile(file);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  // Direct GIF creation handler
  const handleGifCreated = async (gifBlob: Blob, fileName: string) => {
    try {
      startUpload();
      const file = new File([gifBlob], fileName, { type: "image/gif" });
      const uploadUrl = await uploadImageWithFallback(
        file,
        compressedImages.length,
        setUploadProgress
      );
      if (uploadUrl) {
        // Generate caption for GIF maker output
        const caption = file.name
          .replace(/\.[^.]+$/, '')
          .replace(/[-_]/g, ' ')
          .trim() || 'Skateboarding GIF';
        
        setCompressedImages((prev) => [
          ...prev,
          { url: uploadUrl, fileName: file.name, caption },
        ]);
      }
      setGifMakerOpen(false); // Close the GIF maker
    } catch (error) {
      console.error("Error uploading created GIF:", error);
      alert(t('compose.gifUploadFailed'));
    } finally {
      finishUpload();
    }
  };

  // Unified image upload handler (now includes GIF uploads)
  const handleUnifiedImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    console.log('📁 [SnapComposer] handleUnifiedImageUpload called with', files.length, 'files');
    if (files.length > 0) startUpload();
    for (const file of files) {
      console.log('📁 [SnapComposer] Processing file:', file.name, 'type:', file.type, 'size:', file.size);
      
      // Check file size limit (15MB for GIF/WEBP, 10MB for others)
      const maxSize = (file.type === "image/gif" || file.type === "image/webp") ? 15 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        const maxSizeMB = maxSize / (1024 * 1024);
        toast({
          title: t('compose.fileTooLarge') || "File too large",
          description: `${file.name} is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum: ${maxSizeMB}MB`,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        continue; // Skip this file
      }
      
      if (file.type === "image/gif" || file.type === "image/webp") {
        // Use GIF/WEBP logic (bypasses compression)
        const fakeEvent = {
          target: { files: [file] },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        await handleGifWebpUpload(fakeEvent);
      } else if (file.type.startsWith("image/")) {
        // Use image compression logic for regular images
        try {
          const options = {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          const compressedFile = await imageCompression(file, options);
          const url = URL.createObjectURL(compressedFile);
          await handleCompressedImageUpload(url, compressedFile.name);
          URL.revokeObjectURL(url);
        } catch (err) {
          toast({
            title: t('compose.compressionError') || "Compression error",
            description: err instanceof Error ? err.message : String(err),
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      } else {
        toast({
          title: "Unsupported file type",
          description: file.type,
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
      }
    }
    finishUpload();
    e.target.value = ""; // Reset input
  };

  // Function to check if the content is a duplicate of the user's recent comments to the same parent
  const checkForDuplicatePost = useCallback(async (
    content: string
  ): Promise<boolean> => {
    if (!effectiveUser) return false;

    const TIMEOUT_MS = 3000; // 3 second timeout

    try {
      let parentAuthor = pa;
      let parentPermlink = pp;

      if (parentPermlink === HIVE_CONFIG.THREADS.PERMLINK) {
        const latestSnapsContainer = await getLastSnapsContainer();
        parentAuthor = latestSnapsContainer.author;
        parentPermlink = latestSnapsContainer.permlink;
      }

      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Duplicate check timeout'));
        }, TIMEOUT_MS);
        // Store timeout ID for potential cleanup (though Promise.race handles this)
        return () => clearTimeout(timeoutId);
      });

      // Create the API call promise
      const fetchPromise = HiveClient.database.call('get_content_replies', [
        parentAuthor,
        parentPermlink,
      ]) as Promise<Discussion[]>;

      // Race the API call against the timeout
      const replies = await Promise.race([fetchPromise, timeoutPromise]);

      if (replies && replies.length > 0) {
        // Filter to only this user's recent comments (last 5)
        const userReplies = replies
          .filter((reply) => reply.author === effectiveUser)
          .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())
          .slice(0, 5);

        const newContent = content.trim().toLowerCase();

        // Check if any of the recent comments match exactly
        for (const reply of userReplies) {
          const existingContent = (reply.body?.trim() || '').toLowerCase();
          if (existingContent === newContent) {
            if (process.env.NODE_ENV === "development") {
              console.log('🚫 Duplicate post detected:', {
                existing: reply.permlink,
                content: newContent.substring(0, 50) + '...'
              });
            }
            return true; // Duplicate detected
          }
        }
      }

      return false; // Not a duplicate
    } catch (error) {
      if (error instanceof Error && error.message === 'Duplicate check timeout') {
        console.warn('⏱️ Duplicate check timed out after', TIMEOUT_MS, 'ms - allowing post');
        return false; // Fail-open: allow posting if timeout occurs
      }
      console.error('Error checking for duplicate post:', error);
      return false; // Fail-open: allow posting if check fails
    }
  }, [effectiveUser, pa, pp]);

  const handleComment = useCallback(async () => {
    // Pre-publish review — open the unified prepare/preview dialog FIRST (before
    // the empty-caption guard) ONLY when it actually adds value: there's a raw
    // video to trim/process, OR a genuinely-eligible cross-post target. A plain
    // Hive image/text post (no eligible cross-post) skips straight to publishing.
    const igEligibleNow =
      instagramCrossPost && isMainFeedSnap && canBypassLimit && hasCrossPostMedia;
    const fcEligibleNow = postToFarcaster && farcasterEligible && !!farcasterLinkage;
    const needsPrepareDialog = !!videoUrl || igEligibleNow || fcEligibleNow;
    if (needsPrepareDialog && !publishConfirmedRef.current) {
      setShowPublishPreview(true);
      return;
    }
    publishConfirmedRef.current = false;

    const commentBody = postBodyRef.current?.value?.trim() ?? "";
    if (!commentBody) {
      alert(t('compose.emptyComment'));
      return;
    }

    const wantsSkatehive = postToHive;
    const wantsFarcaster = postToFarcaster;
    // Farcaster-only main-feed snaps still create a masked @skateuser Hive
    // soft-post (overlaid with the user's identity) so there's always a
    // SkateHive post page for the cast / Mini App to open. Replies (non-main-
    // feed) keep the cast-only behavior in the branch below.
    //
    // The @skateuser soft-post is created via the userbase route, which REQUIRES
    // a userbase session. A Keychain/aioha-only user (no userbase session) would
    // get a 401 there and be unable to publish — so only force it when a
    // userbase session exists; otherwise fall back to the cast-only branch.
    // Only force the masked @skateuser soft-post when the user can ACTUALLY
    // publish to Farcaster (eligible + linked). Otherwise a non-eligible FC-only
    // user would create an orphan masked Hive post they can't back with a cast —
    // instead they fall through to the branch below that prompts them to link.
    const forceSkateuser =
      !wantsSkatehive &&
      wantsFarcaster &&
      isMainFeedSnap &&
      !!userbaseUser &&
      farcasterEligible &&
      !!farcasterLinkage;

    if (!wantsSkatehive && !wantsFarcaster) {
      toast({
        title: "Pick at least one destination",
        status: "warning",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Farcaster-only WITHOUT a masked Hive post (replies / non-main-feed):
    // publish a cast directly. Main-feed FC-only snaps fall through to the Hive
    // flow below to create the @skateuser soft-post (forceSkateuser).
    if (!wantsSkatehive && wantsFarcaster && !forceSkateuser) {
      if (!farcasterEligible || !farcasterLinkage) {
        toast({
          title: "Link your Farcaster account first.",
          status: "error",
          duration: 4000,
          isClosable: true,
        });
        return;
      }
      setIsLoading(true);
      try {
        // A reply/comment links the RELATED post being discussed, not itself.
        // A top-level snap has no Hive URL in this Farcaster-only branch, so
        // it falls back to the site origin.
        const fcUrl = isMainFeedSnap
          ? APP_CONFIG.ORIGIN
          : `${APP_CONFIG.ORIGIN.replace(/\/$/, "")}/post/${pa}/${pp}`;
        const castText = buildSnapCastText(igPublishRef.current?.farcasterCaption || commentBody, fcUrl);
        // Snap → embed media directly (images first, else video). Reply →
        // embed the related post so it doesn't read as a standalone post.
        let embeds: { url: string }[] = [];
        if (!isMainFeedSnap) {
          embeds = [{ url: fcUrl }];
        } else if (compressedImages.length > 0) {
          embeds = compressedImages.slice(0, 2).map((img) => ({ url: img.url }));
        } else if (videoUrl) {
          // Farcaster can't inline-play an IPFS video → embed the SkateHive URL
          // (Mini App) instead of the raw video, which only shows a broken card.
          embeds = [{ url: fcUrl }];
        }
        const res = await fetch("/api/farcaster/cast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: castText,
            embeds: embeds.length > 0 ? embeds : undefined,
            channel_id: farcasterChannel || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data?.needsSigner) {
            toast({
              title: "Authorize Farcaster posting first",
              description:
                "Open Settings → Farcaster to approve the signer, then try again.",
              status: "warning",
              duration: 6000,
              isClosable: true,
            });
          } else {
            toast({
              title: "Failed to post to Farcaster.",
              description: data?.error || "Unknown error.",
              status: "error",
              duration: 5000,
              isClosable: true,
            });
          }
          return;
        }
        toast({
          title: "Posted to Farcaster!",
          status: "success",
          duration: 3000,
          isClosable: true,
        });
        if (isMainFeedSnap) {
          cancelSnapDraftSave();
          clearSnapDraft();
        }
        postBodyRef.current!.value = "";
        setCompressedImages([]);
        setSelectedGif(null);
        setVideoUrl(null);
        setVideoThumbnailUrl(null);
        setPendingVideoFile(null);
        setIsPublishing(false);
        onClose();
      } catch (err: any) {
        toast({
          title: "Failed to post to Farcaster.",
          description: err?.message || "Network error.",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!canUseAppFeatures) {
      toast({
        title: t('compose.loginRequired'),
        description: t('compose.loginToComment'),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    // Check for duplicate post
    const isDuplicate = await checkForDuplicatePost(commentBody);
    if (isDuplicate) {
      toast({
        title: t('compose.duplicateTitle'),
        description: t('compose.duplicateDescription'),
        status: "warning",
        duration: 8000,
        isClosable: true,
        position: "top",
        variant: "solid",
      });
      return;
    }

    setIsLoading(true);

    if (commentBody) {
      let snapsTags: string[] = [];
      try {
        let postPermlink = pp;

        // Add existing `snaps` tag logic
        if (postPermlink === HIVE_CONFIG.THREADS.PERMLINK) {
          postPermlink = (await getLastSnapsContainer()).permlink;
          snapsTags = [
            HIVE_CONFIG.COMMUNITY_TAG,
            HIVE_CONFIG.THREADS.PERMLINK,
          ];
        }

        // Extract hashtags from the comment body and add to `snapsTags`
        const hashtags = extractHashtags(commentBody);
        snapsTags = [...new Set([...snapsTags, ...hashtags])]; // Add hashtags without duplicates

        const validUrls = compressedImages.map((image) => image.url);

        // Build metadata object
        const metadata: any = {
          app: "Skatehive App 3.0",
          tags: snapsTags,
          images: validUrls,
        };

        // For video snaps, persist the locally-captured thumbnail (canvas
        // frame uploaded to IPFS) in json_metadata.thumbnail. The
        // /api/og/post/... route reads thumbnail[0] when building the
        // Farcaster frame image, so this is what makes the cross-post
        // embed show the video's first frame instead of a placeholder.
        if (videoUrl && videoThumbnailUrl) {
          metadata.thumbnail = [videoThumbnailUrl];
        }

        // Cross-post linkage: store the Farcaster fid + username on the Hive
        // snap so the connection is durable and queryable later. The cast
        // hash isn't known yet (cast is fired after Hive succeeds).
        if (wantsFarcaster && farcasterLinkage) {
          metadata.crosspost = {
            farcaster: {
              fid: farcasterLinkage.fid,
              username: farcasterLinkage.username,
            },
          };
        }

        // Build the final comment body with images and video appended
        let finalCommentBody = commentBody;
        
        // Append image markdown for all uploaded images with proper alt text
        if (compressedImages.length > 0) {
          const imageMarkdown = compressedImages
            .map(img => {
              // Use caption (user description or cleaned filename) as alt text
              const altText = img.caption || img.fileName || 'Skateboarding photo';
              // Also add title attribute for hover tooltip
              return `\n![${altText}](${img.url} "${altText}")`;
            })
            .join('');
          finalCommentBody = finalCommentBody + imageMarkdown;
        }
        
        // Append video iframe if video was uploaded. Derive the SEO title
        // from the snap text (first non-empty line, stripped of urls/markdown)
        // instead of firing a blocking window.prompt — passing a title skips
        // the prompt inside generateVideoIframeMarkdown.
        if (videoUrl) {
          const seoTitle =
            commentBody
              .replace(/https?:\/\/\S+/g, "")
              .replace(/[#>*_`~\[\]()!]/g, "")
              .split("\n")
              .map((l) => l.trim())
              .find((l) => l.length > 0)
              ?.slice(0, 80) || "Skatehive skateboarding video";
          finalCommentBody =
            finalCommentBody + generateVideoIframeMarkdown(videoUrl, seoTitle);
        }

        const permlink = crypto.randomUUID();
        let commentResponse: any = null;

        if (user && !forceSkateuser) {
          commentResponse = await aioha.comment(
            pa,
            postPermlink,
            permlink,
            "",
            finalCommentBody,
            metadata
          );
        } else {
          // forceSkateuser (Farcaster-only) → always post via the shared
          // @skateuser account, even if the user has their own Hive identity.
          const response = await fetch("/api/userbase/hive/comment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              parent_author: pa,
              parent_permlink: postPermlink,
              permlink,
              title: "",
              body: finalCommentBody,
              json_metadata: metadata,
              type: "snap",
              force_soft_post: forceSkateuser,
            }),
          });
          const data = await response.json();
          if (!response.ok) {
            if (
              data?.code === "POSTING_KEY_NOT_STORED" &&
              linkedHiveHandle
            ) {
              throw new Error(
                `Connect your Hive wallet (@${linkedHiveHandle}) or add a posting key to post.`
              );
            }
            throw new Error(data?.error || "Failed to post");
          }
          commentResponse = { success: true, author: data?.author || effectiveUser };
        }

        if (commentResponse.success) {
          const commentAuthor = commentResponse?.author || effectiveUser;
          if (!commentAuthor) {
            throw new Error("Unable to determine comment author");
          }

          if (isMainFeedSnap) {
            cancelSnapDraftSave();
            clearSnapDraft();
          }
          postBodyRef.current!.value = "";
          setCompressedImages([]);
          setSelectedGif(null);
          setVideoUrl(null);
          setVideoThumbnailUrl(null);
          setPendingVideoFile(null);
          setIsPublishing(false);

          setIsProcessingGif(false);

          // Set created to "just now" for optimistic update
          // Use finalCommentBody so images and video are included in the preview
          const newComment: Partial<Discussion> = {
            author: commentAuthor,
            permlink: permlink,
            body: finalCommentBody,
            created: "just now", // use "just now" as the created value for new replies
            pending_payout_value: "0.000 HBD",
          };

          onNewComment(newComment);

          // Snap URL is shared by all cross-posts. Use the /post route —
          // /user/{username}/snap/... redirects to the profile for non-bot
          // UAs, which breaks embeds.
          const snapUrl = `${APP_CONFIG.ORIGIN.replace(/\/$/, "")}/post/${commentAuthor}/${permlink}`;
          const willFarcaster = wantsFarcaster && !!farcasterLinkage;
          const willInstagram =
            instagramCrossPost &&
            isMainFeedSnap &&
            canBypassLimit &&
            (!!compressedImages[0]?.url || !!videoUrl);

          // Instagram cross-post is published INLINE here (no second dialog) —
          // the prepare & publish stepper already collected the IG caption +
          // collaborators. Keychain signing happens inside publishSnapToInstagram.
          if (willInstagram) {
            const igData = igPublishRef.current;
            const igProgressId = "ig-crosspost-progress";
            toast({
              id: igProgressId,
              title: "Posting to Instagram…",
              status: "loading",
              duration: null,
              isClosable: false,
            });
            publishSnapToInstagram({
              aioha,
              walletUser: user,
              requireSignature: !userbaseUser && !!user,
              hiveAuthor: commentAuthor,
              hivePermlink: permlink,
              body: finalCommentBody,
              tags: snapsTags,
              imageUrl: compressedImages[0]?.url || (videoUrl ? videoThumbnailUrl : null),
              videoUrl: videoUrl || null,
              permalinkUrl: snapUrl,
              caption: igData?.igCaption || finalCommentBody,
              collaborators: igData?.collaborators || [],
            })
              .then((igResult) => {
                toast.update(igProgressId, {
                  title: igResult.success
                    ? igResult.deduped
                      ? "Already on Instagram"
                      : "Posted to @skatehive on Instagram"
                    : "Instagram cross-post failed",
                  description: igResult.ig_permalink || igResult.error || undefined,
                  status: igResult.success ? "success" : "error",
                  duration: 8000,
                  isClosable: true,
                });
              })
              .catch((err) => {
                toast.update(igProgressId, {
                  title: "Instagram cross-post failed",
                  description: err instanceof Error ? err.message : "Network or signing error.",
                  status: "error",
                  duration: 9000,
                  isClosable: true,
                });
              });
          }

          onClose();

          // ── Farcaster cross-post orchestration ───────────────────────
          // Wait for the snap to be indexable on Hive BEFORE firing the
          // Farcaster cast. Otherwise Warpcast / scrapers can hit
          // /post/{author}/{permlink} during the ~3s block confirmation
          // window, get "Snap not found" metadata back, and cache that
          // empty response — breaking the embed preview permanently.
          if (willFarcaster) {
            const progressId = "snap-share-progress";
            // Custom render (no default Chakra chrome) so the toast paints its
            // content on the first frame — a default status toast briefly shows
            // an empty frame before its title/description lay out.
            const shareCover = videoThumbnailUrl || compressedImages[0]?.url || null;
            toast({
              id: progressId,
              duration: null,
              isClosable: false,
              position: publishToastPosition,
              render: () => (
                <PublishProgressToast
                  cover={shareCover}
                  title={t('compose.progress.title')}
                  stage={t('compose.progress.confirmingHive')}
                  progress={92}
                  tone="loading"
                />
              ),
            });

            const confirmed = await waitForHivePost(commentAuthor, permlink, {
              timeoutMs: 5000,
            });
            if (!confirmed) {
              console.warn(
                `[snap-share] Hive confirm timed out for @${commentAuthor}/${permlink} — cross-posting anyway`
              );
            }

            toast.update(progressId, {
              render: () => (
                <PublishProgressToast
                  cover={shareCover}
                  title={t('compose.progress.title')}
                  stage={t('compose.progress.postingFarcaster')}
                  progress={96}
                  tone="loading"
                />
              ),
            });

            // Farcaster (awaited so the progress toast closes when done)
            const farcasterTask: Promise<void> = (async () => {
              if (!willFarcaster) return;
              // A top-level main-feed snap IS the content → link the snap and
              // embed its media. A reply/comment (feed reply, or a comment on
              // a blog/mag post) should link the RELATED post being discussed
              // rather than presenting the comment as its own Farcaster post.
              const farcasterUrl = isMainFeedSnap
                ? snapUrl
                : `${APP_CONFIG.ORIGIN.replace(/\/$/, "")}/post/${pa}/${pp}`;
              const castText = buildSnapCastText(igPublishRef.current?.farcasterCaption || commentBody, farcasterUrl);
              // Embed selection:
              //   - snap images → embed up to 2 image URLs directly (Warpcast
              //     renders inline image previews — best UX).
              //   - snap video  → snapUrl FIRST (frame renders the SkateHive
              //     thumbnail), videoUrl SECOND for inline-video clients.
              //   - snap text   → snapUrl alone (frame card).
              //   - reply       → the related post alone (frame card), so the
              //     cast points at what's being discussed, not the comment.
              const embeds = isMainFeedSnap
                ? buildSnapCastEmbeds({
                    snapUrl: farcasterUrl,
                    imageUrls: compressedImages.map((img) => img.url),
                    videoUrl: videoUrl || null,
                  })
                : [{ url: farcasterUrl }];
              try {
                const res = await fetch("/api/farcaster/cast", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    text: castText,
                    embeds,
                    channel_id: farcasterChannel || undefined,
                  }),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  if (data?.needsSigner) {
                    toast({
                      title: "Farcaster needs signer approval",
                      description:
                        "Approve the Farcaster signer in Settings → App Account.",
                      status: "warning",
                      duration: 7000,
                      isClosable: true,
                    });
                  } else {
                    toast({
                      title: "Farcaster cross-post failed",
                      description: data?.error || "Try again later.",
                      status: "warning",
                      duration: 6000,
                      isClosable: true,
                    });
                  }
                }
              } catch (err: any) {
                toast({
                  title: "Farcaster cross-post failed",
                  description: err?.message || "Network error.",
                  status: "warning",
                  duration: 6000,
                  isClosable: true,
                });
              }
            })();

            // Wait for Farcaster (IG is handled by the dialog opened above).
            await farcasterTask;

            // Close progress toast and show the final "shared" badge.
            toast.close(progressId);
            toast({
              title: "Snap shared 🛹",
              status: "success",
              duration: 3000,
              isClosable: true,
            });
          } else if (willInstagram) {
            // No Farcaster orchestration ran, but the snap was posted and the
            // IG dialog is already open — still confirm the snap shared.
            toast({
              title: "Snap shared 🛹",
              status: "success",
              duration: 3000,
              isClosable: true,
            });
          }
        }
      } catch (error: any) {
        toast({
          title: t("compose.postFailed"),
          description:
            error?.message || t("compose.postFailedDescription"),
          status: "error",
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setIsLoading(false);
        setUploadProgress([]);
      }
    }
  }, [
    compressedImages,
    videoUrl,
    videoThumbnailUrl,
    pa,
    pp,
    extractHashtags,
    aioha,
    user,
    effectiveUser,
    onNewComment,
    onClose,
    checkForDuplicatePost,
    toast,
    t,
    canUseAppFeatures,
    linkedHiveHandle,
    userbaseUser,
    instagramCrossPost,
    isMainFeedSnap,
    postToHive,
    postToFarcaster,
    farcasterChannel,
    farcasterEligible,
    farcasterLinkage,
    publishToastPosition,
  ]);

  // After the publish dialog hands back processed media + caption, the relevant
  // state has been set; run the real publish now that it's fresh.
  useEffect(() => {
    if (!pendingPublish) return;
    setPendingPublish(false);
    publishConfirmedRef.current = true;
    // Whatever happens (success, failure, early-return), stop hiding the
    // composer media so a failed post's video reappears for retry.
    Promise.resolve(handleComment()).finally(() => setIsPublishing(false));
  }, [pendingPublish, handleComment]);

  // Background video prep for the publish dialog: trim → cover → transcode,
  // shown as a progress toast (top banner on mobile, bottom-right on desktop)
  // so the dialog can close immediately instead of blocking. On success it sets
  // the final media URLs and hands off to handleComment for the actual posting.
  const runVideoPrep = useCallback(
    async (result: { trim: { start: number; end: number } | null; coverBlob: Blob | null }) => {
      const raw = pendingVideoFile;
      if (!raw) {
        setPendingPublish(true);
        return;
      }
      const id = "publish-prep";
      // Cover thumbnail for the toast — prefer the freshly captured frame.
      const coverThumb = result.coverBlob
        ? URL.createObjectURL(result.coverBlob)
        : videoThumbnailUrl;

      // Drive a fake-but-smooth progress bar; real transcode % overrides it.
      let progress = 0;
      let stage = "Trimming clip…";
      let tone: "loading" | "success" | "error" = "loading";
      let title = "Publishing your snap";
      const paint = () =>
        toast.update(id, {
          render: () => (
            <PublishProgressToast cover={coverThumb} title={title} stage={stage} progress={progress} tone={tone} />
          ),
        });
      toast({
        id,
        duration: null,
        isClosable: false,
        position: publishToastPosition,
        render: () => (
          <PublishProgressToast cover={coverThumb} title={title} stage={stage} progress={progress} tone={tone} />
        ),
      });
      const creep = setInterval(() => {
        if (progress < 90) {
          progress = Math.min(90, progress + 4);
          paint();
        }
      }, 450);

      const cleanup = () => {
        clearInterval(creep);
        if (coverThumb && coverThumb.startsWith("blob:")) URL.revokeObjectURL(coverThumb);
      };

      try {
        const blob = result.trim
          ? await createTrimmedVideo(raw, result.trim.start, result.trim.end)
          : raw;
        const uploadFile =
          blob instanceof File ? blob : new File([blob], "clip.mp4", { type: "video/mp4" });

        let cover = videoThumbnailUrl;
        if (result.coverBlob) {
          stage = "Uploading cover…";
          progress = Math.max(progress, 20);
          paint();
          try {
            const url = await uploadThumbnail(result.coverBlob, effectiveUser || undefined);
            if (url) cover = url;
          } catch (err) {
            console.warn("[SnapComposer] cover upload failed:", err);
          }
        }

        stage = "Uploading & transcoding video…";
        paint();
        const res = await processVideoOnServer(uploadFile, effectiveUser || "anonymous", {
          userHP: hivePower ?? undefined,
          onProgress: (p: number, s?: string) => {
            progress = Math.max(progress, 30 + Math.round((p / 100) * 60));
            if (s) stage = s;
            paint();
          },
        });
        if (!res.success || !res.url) throw new Error(res.error || "Video upload failed");

        setVideoUrl(res.url);
        setVideoThumbnailUrl(cover);
        setPendingVideoFile(null);
        cleanup();
        progress = 100;
        tone = "success";
        title = "Video ready — publishing…";
        stage = "Posting to your networks";
        paint();
        toast.update(id, { duration: 2500, isClosable: true });
        setPendingPublish(true);
      } catch (err) {
        cleanup();
        tone = "error";
        title = "Couldn't prepare the video";
        stage = err instanceof Error ? err.message : String(err);
        paint();
        toast.update(id, { duration: 9000, isClosable: true });
        // Restore the composer's media so the user can retry.
        setIsPublishing(false);
      }
    },
    [pendingVideoFile, videoThumbnailUrl, effectiveUser, hivePower, toast, publishToastPosition]
  );

  // Detect Ctrl+Enter or Command+Enter and submit - memoized
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        handleComment();
      }
    },
    [handleComment]
  );

  // Drag and drop handlers - memoized
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  // Paste image handler (Ctrl+V / Cmd+V)
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return; // Let normal text paste through
    e.preventDefault();

    startUpload();
    for (const file of imageFiles) {
      // Check file size
      const maxSize = (file.type === "image/gif" || file.type === "image/webp") ? 15 * 1024 * 1024 : 10 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: t('compose.fileTooLarge') || "File too large",
          description: `${file.name} is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum: ${maxSize / (1024 * 1024)}MB`,
          status: "error",
          duration: 5000,
          isClosable: true,
        });
        continue;
      }

      if (file.type === "image/gif" || file.type === "image/webp") {
        const fakeEvent = {
          target: { files: [file] },
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        await handleGifWebpUpload(fakeEvent);
      } else {
        try {
          const options = {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          };
          const compressedFile = await imageCompression(file, options);
          const url = URL.createObjectURL(compressedFile);
          await handleCompressedImageUpload(url, compressedFile.name);
          URL.revokeObjectURL(url);
        } catch (err) {
          toast({
            title: t('compose.compressionError') || "Compression error",
            description: err instanceof Error ? err.message : String(err),
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      }
    }
    finishUpload();
  }, [startUpload, finishUpload, toast, t, handleGifWebpUpload, handleCompressedImageUpload]);

  // Video upload logic in handleDrop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) startUpload();
    for (const file of files) {
      // Check file size limit
      if (file.type.startsWith("image/")) {
        const maxSize = (file.type === "image/gif" || file.type === "image/webp") ? 15 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
          const maxSizeMB = maxSize / (1024 * 1024);
          toast({
            title: t('compose.fileTooLarge') || "File too large",
            description: `${file.name} is ${(file.size / (1024 * 1024)).toFixed(2)}MB. Maximum: ${maxSizeMB}MB`,
            status: "error",
            duration: 5000,
            isClosable: true,
          });
          continue;
        }
      }
      
      if (file.type.startsWith("image/") || isHeicFile(file)) {
        // Convert HEIC/HEIF → JPEG first
        let imageFile = file;
        if (isHeicFile(file)) {
          try {
            imageFile = await convertHeicIfNeeded(file);
          } catch (err) {
            toast({
              title: "HEIC conversion failed",
              description: err instanceof Error ? err.message : String(err),
              status: "error",
              duration: 5000,
              isClosable: true,
            });
            return;
          }
        }

        // If GIF or WEBP, use GIF/WEBP upload logic
        if (imageFile.type === "image/gif" || imageFile.type === "image/webp") {
          // Simulate input event for GIF/WEBP
          const fakeEvent = {
            target: { files: [imageFile] },
          } as unknown as React.ChangeEvent<HTMLInputElement>;
          await handleGifWebpUpload(fakeEvent);
        } else {
          // For other images, resize and compress before upload
          try {
            const options = {
              maxSizeMB: 2,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            };
            const compressedFile = await imageCompression(imageFile, options);
            const url = URL.createObjectURL(compressedFile);
            await handleCompressedImageUpload(url, compressedFile.name);
            URL.revokeObjectURL(url);
          } catch (err) {
            toast({
              title: t('compose.compressionError') || "Compression error",
              description: err instanceof Error ? err.message : String(err),
              status: "error",
              duration: 5000,
              isClosable: true,
            });
          }
        }
      } else if (file.type.startsWith("video/")) {
        // For video, use our new video handling logic with trimming
        try {
          await handleVideoFile(file);
        } catch (error) {
          console.error("Error uploading video:", error);
          toast({
            title: "Video upload failed",
            description: error instanceof Error ? error.message : String(error),
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      } else {
        toast({
          title: "Unsupported file type",
          description: file.type,
          status: "warning",
          duration: 3000,
          isClosable: true,
        });
      }
    }
    finishUpload();
  };

  // Video upload state integration - memoized
  const handleVideoUploadStart = useCallback(() => {
    setVideoProcessingError(null); // Clear any previous errors
    startUpload();
  }, [startUpload]);

  const handleVideoUploadFinish = useCallback(
    () => finishUpload(),
    [finishUpload]
  );

  const handleVideoError = useCallback((error: string) => {
    setVideoProcessingError(error);
  }, []);

  // Instagram handler - memoized
  const handleInstagramMediaDownloaded = useCallback(
    (url: string, filename: string, isVideo: boolean) => {
      if (isVideo) {
        setVideoUrl(url);
      } else {
        // Add to compressed images array for images
        setCompressedImages((prev) => [
          ...prev,
          {
            url: url,
            fileName: filename,
            caption: filename.replace(/\.[^/.]+$/, ""), // Remove file extension for caption
          },
        ]);
        // Insert URL into textarea
        insertImageUrlIntoTextarea(url, filename);
      }
    },
    [insertImageUrlIntoTextarea]
  );

  // Only render the composer if user is logged in
  if (!canUseAppFeatures) return null;

  return (
    <Box position="relative">
      {/* Matrix Overlay during media processing */}
      {isUploadingMedia && (
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          zIndex={0}
          pointerEvents="none"
          borderRadius="base"
          overflow="hidden"
        >
          <MatrixOverlay />
        </Box>
      )}

      {/* Snap Composer UI, blurred and unclickable if not logged in */}
      <Box
        position="relative"
        zIndex={1}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragOver
            ? "2px dashed var(--chakra-colors-primary)"
            : undefined,
          background: isDragOver ? "rgba(0,0,0,0.04)" : undefined,
          transition: "border 0.2s, background 0.2s",
        }}
      >
        {/* Optionally, overlay a message when dragging */}
        {isDragOver && (
          <Box
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            zIndex={10}
            display="flex"
            alignItems="center"
            justifyContent="center"
            borderRadius="base"
            pointerEvents="none"
          >
            <Box color="primary" fontWeight="bold" fontSize="xl">
              {t('compose.dropFiles')}
            </Box>
          </Box>
        )}
        <Box
          p={4}
          mb={1}
          borderRadius="base"
          borderBottom={isReply ? "none" : "1px"}
          borderColor="muted"
        >
          <Textarea
            id="snap-composer-textarea"
            data-testid="snap-composer-textarea"
            placeholder={isReply ? t('compose.replyPlaceholder') : t('compose.placeholder')}
            bg="background"
            borderRadius={"base"}
            mb={3}
            minH={"100px"}
            ref={postBodyRef}
            _placeholder={{ color: "text" }}
            isDisabled={isLoading}
            onKeyDown={handleKeyDown} // Attach the keydown handler
            onPaste={handlePaste}
            onChange={() => scheduleSnapDraftSave()}
            onBlur={() => doSaveSnapDraft()}
            _focusVisible={{ border: "tb1" }}
          />

          {/* Media Preview Section - Videos and images side by side */}
          {!isPublishing && (compressedImages.length > 0 || selectedGif || videoUrl) && (
            <HStack spacing={3} mb={3} align="stretch" width="100%">
              {/* Video preview - equal width distribution */}
              {videoUrl && (
                <Box position="relative" flex="1">
                  <Box
                    position="relative"
                    width="100%"
                    overflow="hidden"
                    borderRadius="md"
                    bg="black"
                  >
                    <video
                      src={videoUrl}
                      controls
                      controlsList="nodownload"
                      playsInline
                      preload="metadata"
                      style={{
                        width: "100%",
                        height: "auto",
                        maxHeight: "300px",
                        borderRadius: "8px",
                        display: "block",
                      }}
                    />
                  </Box>
                  <IconButton
                    id="snap-composer-remove-video"
                    data-testid="snap-composer-remove-video"
                    aria-label="Remove video"
                    icon={<FaTimes />}
                    size="sm"
                    position="absolute"
                    top="8px"
                    right="8px"
                    onClick={() => {
                      setVideoUrl(null);
                      setVideoThumbnailUrl(null);
                    }}
                    isDisabled={isLoading}
                    bg="blackAlpha.800"
                    color="white"
                    _hover={{ bg: "blackAlpha.900" }}
                    zIndex={2}
                  />
                </Box>
              )}

              {/* Images - equal width distribution */}
              {compressedImages.map((img, index) => (
                <Box key={index} position="relative" flex="1">
                  <Image
                    alt={img.fileName}
                    src={img.url}
                    width="100%"
                    height="auto"
                    maxH="300px"
                    objectFit="contain"
                    borderRadius="base"
                  />
                  <Input
                    mt={2}
                    placeholder={t('compose.enterCaption')}
                    value={img.caption}
                    onChange={(e) => {
                      const newImages = [...compressedImages];
                      newImages[index].caption = e.target.value;
                      setCompressedImages(newImages);
                    }}
                    size="sm"
                    isDisabled={isLoading}
                  />
                  <IconButton
                    id={`snap-composer-remove-image-${index}`}
                    data-testid={`snap-composer-remove-image-${index}`}
                    aria-label="Remove image"
                    icon={<FaTimes />}
                    size="xs"
                    position="absolute"
                    top="0"
                    right="0"
                    onClick={() =>
                      setCompressedImages((prevImages) =>
                        prevImages.filter((_, i) => i !== index)
                      )
                    }
                    isDisabled={isLoading}
                  />
                  <Progress
                    value={uploadProgress[index]}
                    size="xs"
                    colorScheme="green"
                    mt={2}
                  />
                </Box>
              ))}
              {selectedGif && (
                <Box key={selectedGif.id} position="relative" flex="1">
                  <Image
                    alt=""
                    src={selectedGif.images.downsized_medium.url}
                    width="100%"
                    height="auto"
                    maxH="300px"
                    objectFit="contain"
                    borderRadius="base"
                  />
                  <IconButton
                    id="snap-composer-remove-gif"
                    data-testid="snap-composer-remove-gif"
                    aria-label="Remove GIF"
                    icon={<FaTimes />}
                    size="xs"
                    position="absolute"
                    top="0"
                    right="0"
                    onClick={() => setSelectedGif(null)}
                    isDisabled={isLoading}
                  />
                </Box>
              )}
            </HStack>
          )}

          <HStack justify="space-between" mb={0}>
            <HStack spacing={3} align="center" wrap="nowrap">
              {/* Media Upload Button */}
              <Box position="relative">
                {isReply ? (
                  <IconButton
                    id="snap-composer-media-upload-btn"
                    data-testid="snap-composer-media-upload"
                    aria-label={t('compose.uploadMedia')}
                    icon={
                      <FaImage color="var(--chakra-colors-primary)" size={22} />
                    }
                    isDisabled={isLoading}
                    background="none"
                    border="none"
                    color="primary"
                    height="48px"
                    width="48px"
                    p={0}
                    mr={0}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    _hover={{ opacity: 0.7 }}
                    onClick={() => imageUploadInputRef.current?.click()}
                  />
                ) : (
                  <IconButton
                    id="snap-composer-media-upload-btn"
                    data-testid="snap-composer-media-upload"
                    aria-label={t('compose.uploadMedia')}
                    icon={
                      <FaImage color="var(--chakra-colors-primary)" size={22} />
                    }
                    variant="ghost"
                    isDisabled={isLoading}
                    border="2px solid transparent"
                    borderRadius="full"
                    height="48px"
                    width="48px"
                    p={0}
                    mr={0}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    _hover={{
                      borderColor: "primary",
                      boxShadow: "0 0 0 2px var(--chakra-colors-primary)",
                    }}
                    _active={{ borderColor: "accent" }}
                    onClick={() => imageUploadInputRef.current?.click()}
                  />
                )}
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.heic,.gif,.webp,video/*"
                  style={{ display: "none" }}
                  ref={imageUploadInputRef}
                  onChange={(event) => {
                    console.log('📸 [SnapComposer] Image upload input onChange triggered');
                    const file = event.target.files?.[0];
                    if (!file) {
                      console.log('📸 [SnapComposer] No file selected');
                      return;
                    }
                    console.log('📸 [SnapComposer] File selected:', file.name, 'type:', file.type);
                    if (file.type.startsWith("video/")) {
                      console.log('📸 [SnapComposer] Handling as video');
                      handleVideoUpload(event);
                    } else {
                      console.log('📸 [SnapComposer] Handling as image');
                      handleUnifiedImageUpload(event);
                    }
                  }}
                  multiple
                />
              </Box>
              {/* Giphy Button (only in reply modal) */}
              {post && (
                isReply ? (
                  <IconButton
                    id="snap-composer-giphy-btn"
                    data-testid="snap-composer-giphy"
                    aria-label={t('compose.addGif')}
                    icon={
                      <TbGif size={22} color="var(--chakra-colors-primary)" />
                    }
                    isDisabled={isLoading}
                    background="none"
                    border="none"
                    boxShadow="none"
                    outline="none"
                    color="primary"
                    height="48px"
                    width="48px"
                    p={0}
                    mr={0}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    _hover={{ opacity: 0.7 }}
                    _active={{ background: "none", boxShadow: "none" }}
                    _focus={{ boxShadow: "none" }}
                    onClick={() => setGiphyModalOpen((open) => !open)}
                  />
                ) : (
                  <IconButton
                    id="snap-composer-giphy-btn"
                    data-testid="snap-composer-giphy"
                    aria-label={t('compose.addGif')}
                    icon={
                      <TbGif size={22} color="var(--chakra-colors-primary)" />
                    }
                    variant="ghost"
                    isDisabled={isLoading}
                    border="2px solid transparent"
                    borderRadius="full"
                    height="48px"
                    width="48px"
                    p={0}
                    mr={0}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    _hover={{
                      borderColor: "primary",
                      boxShadow: "0 0 0 2px var(--chakra-colors-primary)",
                    }}
                    _active={{ borderColor: "accent" }}
                    onClick={() => setGiphyModalOpen((open) => !open)}
                  />
                )
              )}
              <Box display="none">
                <ImageCompressor
                  ref={imageCompressorRef}
                  onUpload={handleCompressedImageUpload}
                  isProcessing={isLoading}
                />
              </Box>
              {/* GIF Maker Button — in reply mode it lives inside the Giphy panel instead */}
              {!isReply && (
                <IconButton
                  id="snap-composer-gif-maker-btn"
                  data-testid="snap-composer-gif-maker"
                  aria-label={t('compose.gifMaker')}
                  icon={<TbGif color="var(--chakra-colors-primary)" size={22} />}
                  variant="ghost"
                  isDisabled={isLoading}
                  border="2px solid transparent"
                  borderRadius="full"
                  height="48px"
                  width="48px"
                  p={0}
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  _hover={{
                    borderColor: "primary",
                    boxShadow: "0 0 0 2px var(--chakra-colors-primary)",
                  }}
                  _active={{ borderColor: "accent" }}
                  onClick={() => {
                    // Reset the GIF maker before opening
                    gifMakerWithSelectorRef.current?.reset();
                    setGifMakerOpen(true);
                  }}
                />
              )}
              {/* Instagram Button - Always show, health check happens in modal */}
              <Tooltip label={t('compose.importFromInstagram')} placement="top">
                {isReply ? (
                  <IconButton
                    id="snap-composer-instagram-btn"
                    data-testid="snap-composer-instagram"
                    aria-label={t('compose.importFromInstagram')}
                    icon={
                      <FaInstagram
                        color="var(--chakra-colors-primary)"
                        size={22}
                      />
                    }
                    isDisabled={isLoading}
                    background="none"
                    border="none"
                    color="primary"
                    height="48px"
                    width="48px"
                    p={0}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    _hover={{ opacity: 0.7 }}
                    onClick={() => setInstagramModalOpen(true)}
                  />
                ) : (
                  <IconButton
                    id="snap-composer-instagram-btn"
                    data-testid="snap-composer-instagram"
                    aria-label={t('compose.importFromInstagram')}
                    icon={
                      <FaInstagram
                        color="var(--chakra-colors-primary)"
                        size={22}
                      />
                    }
                    variant="ghost"
                    isDisabled={isLoading}
                    border="2px solid transparent"
                    borderRadius="full"
                    height="48px"
                    width="48px"
                    p={0}
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    _hover={{
                      borderColor: "primary",
                      boxShadow: "0 0 0 2px var(--chakra-colors-primary)",
                    }}
                    _active={{ borderColor: "accent" }}
                    onClick={() => setInstagramModalOpen(true)}
                  />
                )}
              </Tooltip>
            </HStack>
            <Box display={buttonSize === "sm" ? "inline-block" : undefined}>
              <ButtonGroup isAttached>
                <Button
                  id="snap-composer-submit-btn"
                  data-testid="snap-composer-submit"
                  bg="primary"
                  color="background"
                  _hover={{ bg: "muted", color: "text", border: "tb1" }}
                  isLoading={isLoading}
                  isDisabled={isLoading || isUploadingMedia || (!postToHive && !postToFarcaster)}
                  onClick={handleComment}
                  borderRadius={"none"}
                  fontWeight="bold"
                  px={buttonSize === "sm" ? 1 : 8}
                  mt={2}
                  mb={1}
                  minWidth={buttonSize === "sm" ? undefined : "120px"}
                  width={buttonSize === "sm" ? undefined : undefined}
                  fontSize={buttonSize === "sm" ? "xs" : "lg"}
                  lineHeight={buttonSize === "sm" ? "1" : undefined}
                  flex={buttonSize === "sm" ? "none" : undefined}
                  alignSelf={buttonSize === "sm" ? "flex-start" : undefined}
                  display={buttonSize === "sm" ? "inline-flex" : undefined}
                  maxH={"2rem"}
                >
                  {buttonText}
                </Button>
                <DestinationMenu
                  postToHive={postToHive}
                  postToFarcaster={postToFarcaster}
                  postToInstagram={instagramCrossPost}
                  setPostToHive={setPostToHive}
                  setPostToFarcaster={setPostToFarcaster}
                  setPostToInstagram={(v: boolean) => {
                    // If the user is enabling IG cross-post for the first time
                    // and we don't have a stored handle, prompt them so the
                    // caption can @-tag instead of falling back to plain text.
                    if (v && igHandleStatus === "absent") {
                      setIgPromptInput("");
                      setIgPromptOpen(true);
                      return;
                    }
                    setInstagramCrossPost(v);
                  }}
                  farcasterChannel={farcasterChannel}
                  setFarcasterChannel={setFarcasterChannel}
                  farcasterEligible={farcasterEligible}
                  farcasterSignerApproved={farcasterSignerApproved}
                  farcasterUsername={farcasterLinkage?.username || null}
                  instagramEligible={isMainFeedSnap && canBypassLimit}
                  instagramHasMedia={hasCrossPostMedia}
                  isLoading={isLoading}
                  buttonSize={buttonSize}
                />
              </ButtonGroup>
            </Box>
          </HStack>
          <Box width="100%">
            {videoDurationError && (
              <Box color="error" p={2} mb={2} fontSize="sm" textAlign="center">
                {videoDurationError}
              </Box>
            )}
            <VideoUploader
              ref={videoUploaderRef}
              onUpload={(result) => {
                if (result?.url) {
                  // Store video URL for preview - iframe will be added at submission time
                  setVideoUrl(result.url);
                }
              }}
              username={effectiveUser || undefined}
              onUploadStart={handleVideoUploadStart}
              onUploadFinish={handleVideoUploadFinish}
              onError={handleVideoError}
              renderTerminal={(terminal) => <Box mt={2}>{terminal}</Box>}
            />
          </Box>

          {/* Error Demo Panel - toggle via localStorage.setItem('SKATEHIVE_ERROR_DEMO', 'true') */}
          {showErrorDemo && (
            <ErrorDemoPanel
              onClose={() => {
                setShowErrorDemo(false);
                localStorage.removeItem("SKATEHIVE_ERROR_DEMO");
              }}
            />
          )}
          {isGiphyModalOpen && (
            <Box position="relative">
                <GiphySelector
                  apiKey={APP_CONFIG.GIPHY_API_KEY}

                onSelect={(gif, e) => {
                  e.preventDefault();
                  setSelectedGif(gif);
                  setGiphyModalOpen(false); // Close modal after selecting a GIF
                }}
                onCreateGif={
                  isReply
                    ? () => {
                        setGiphyModalOpen(false);
                        // Reset the GIF maker before opening
                        gifMakerWithSelectorRef.current?.reset();
                        setGifMakerOpen(true);
                      }
                    : undefined
                }
              />
            </Box>
          )}
        </Box>
      </Box>
      {/* Direct GIF Maker */}
      <GIFMakerWithSelector
        ref={gifMakerWithSelectorRef}
        isOpen={isGifMakerOpen}
        onClose={() => setGifMakerOpen(false)}
        asModal={true}
        onGifCreated={handleGifCreated}
        onUpload={() => { }} // Not used with onGifCreated
        isProcessing={isProcessingGif}
      />
      {/* Video Trim Modal */}
      {isTrimModalOpen && (
        <VideoTrimModal
          isOpen={isTrimModalOpen}
          onClose={handleTrimModalClose}
          videoFile={pendingVideoFile}
          onTrimComplete={handleTrimComplete}
          maxDuration={15}
          canBypass={canBypassLimit}
        />
      )}

      {/* Instagram Modal */}
      <InstagramModal
        isOpen={isInstagramModalOpen}
        onClose={() => setInstagramModalOpen(false)}
        onMediaDownloaded={handleInstagramMediaDownloaded}
        healthStatus={instagramHealth}
      />

      {/* Outbound IG cross-post review dialog — opens after a snap with
          Instagram enabled is published. User edits caption + collaborators
          then publishes to @skatehive. */}
      {igDialog && (
        <InstagramCrossPostDialog
          isOpen={!!igDialog}
          onClose={() => setIgDialog(null)}
          mode="self"
          context={igDialog}
          userHandle={user || effectiveUser || null}
          requireSignature={!userbaseUser && !!user}
        />
      )}

      {/* Unified pre-publish review — opens on Post when media is attached.
          Edit the caption once and preview Hive / Instagram / Farcaster, then
          publish. Confirming re-invokes handleComment to run the real flow. */}
      {showPublishPreview && (
        <PublishPreviewDialog
          isOpen
          onClose={() => setShowPublishPreview(false)}
          initialCaption={postBodyRef.current?.value ?? ""}
          images={compressedImages}
          videoFile={pendingVideoFile}
          videoLocalUrl={pendingVideoFile ? videoUrl : null}
          thumbnailUrl={videoThumbnailUrl}
          hiveAuthor={user || effectiveUser || "skatehive"}
          igHandle={igHandleValue}
          farcasterUsername={farcasterLinkage?.username || null}
          targets={{
            hive: postToHive,
            instagram:
              instagramCrossPost && isMainFeedSnap && canBypassLimit && hasCrossPostMedia,
            farcaster: postToFarcaster && farcasterEligible && !!farcasterLinkage,
          }}
          maxVideoDuration={15}
          canBypassTrim={canBypassLimit}
          onPublish={(result) => {
            // The Hive post body is the master caption. For Farcaster-only
            // posts the user may only have typed in the Farcaster (or IG) step,
            // so fall back to those to avoid an empty-body post.
            const hiveBody =
              result.caption ||
              result.farcasterCaption ||
              result.igCaption ||
              "";
            if (postBodyRef.current) postBodyRef.current.value = hiveBody;
            igPublishRef.current = {
              igCaption: result.igCaption,
              collaborators: result.collaborators,
              farcasterCaption: result.farcasterCaption,
            };
            setShowPublishPreview(false);
            // Video: process in the background (progress toast), then publish.
            // Image/text: publish immediately (dialog already closed).
            if (pendingVideoFile) {
              setIsPublishing(true); // hide the video in the composer; toast owns it now
              void runVideoPrep({ trim: result.trim, coverBlob: result.coverBlob });
            } else {
              setPendingPublish(true);
            }
          }}
        />
      )}

      {/* IG-handle prompt — opens when the user enables cross-post without
          a stored handle. Three exits: save+enable, skip+enable, cancel. */}
      <Modal
        isOpen={igPromptOpen}
        onClose={() => setIgPromptOpen(false)}
        isCentered
      >
        <ModalOverlay />
        <ModalContent bg="background" borderColor="primary" borderWidth="1px">
          <ModalHeader fontFamily="mono" fontSize="md" color="text">
            Tag your Instagram?
          </ModalHeader>
          <ModalBody>
            <Text fontSize="sm" color="dim" mb={3}>
              We&apos;ll @-mention this handle in @skatehive&apos;s Instagram
              caption. Leave blank to post without a tag — the caption will
              fall back to your Hive username as plain text.
            </Text>
            <FormControl>
              <FormLabel fontSize="xs" color="dim" fontFamily="mono">
                Instagram username
              </FormLabel>
              <InputGroup size="md">
                <InputLeftAddon>@</InputLeftAddon>
                <Input
                  value={igPromptInput}
                  onChange={(e) => setIgPromptInput(e.target.value)}
                  placeholder="yourighandle"
                  autoFocus
                  isDisabled={igPromptSubmitting}
                />
              </InputGroup>
            </FormControl>
          </ModalBody>
          <ModalFooter gap={2}>
            <Button
              variant="ghost"
              onClick={() => setIgPromptOpen(false)}
              isDisabled={igPromptSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Skip — enable cross-post anyway, caption uses plain Hive name.
                // Flip status to 'present' so subsequent off→on toggles in
                // this composer instance don't re-prompt.
                setIgPromptOpen(false);
                setIgHandleStatus("present");
                setInstagramCrossPost(true);
              }}
              isDisabled={igPromptSubmitting}
            >
              Skip
            </Button>
            <Button
              bg="primary"
              color="background"
              _hover={{ bg: "muted", color: "text" }}
              isLoading={igPromptSubmitting}
              onClick={async () => {
                const trimmed = igPromptInput.trim().replace(/^@/, "");
                if (!trimmed) {
                  // Treat empty as Skip — be forgiving.
                  setIgPromptOpen(false);
                  setInstagramCrossPost(true);
                  return;
                }
                setIgPromptSubmitting(true);
                try {
                  const res = await fetch("/api/userbase/profile/instagram", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      handle: trimmed,
                      source: "crosspost_prompt",
                    }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    toast({
                      title: "Couldn't save Instagram handle",
                      description: data?.error || "Try again.",
                      status: "warning",
                      duration: 5000,
                      isClosable: true,
                    });
                    return;
                  }
                  const saved = data?.handle || trimmed;
                  setIgHandleValue(saved);
                  setIgHandleStatus("present");
                  setIgPromptOpen(false);
                  setInstagramCrossPost(true);
                  toast({
                    title: `Saved @${saved}`,
                    description:
                      "Update it any time in Edit Profile to sync to Hive.",
                    status: "success",
                    duration: 3000,
                    isClosable: true,
                  });
                } catch (err: any) {
                  toast({
                    title: "Network error",
                    description: err?.message || "Try again.",
                    status: "error",
                    duration: 4000,
                    isClosable: true,
                  });
                } finally {
                  setIgPromptSubmitting(false);
                }
              }}
            >
              Save &amp; enable
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* SkateDialog Component */}
      <SkateDialogComponent />

      {/* Matrix Overlay and login prompt if not logged in */}
      {!effectiveUser && <></>}
    </Box>
  );
});

export default SnapComposer;

function DestinationMenu({
  postToHive,
  postToFarcaster,
  postToInstagram,
  setPostToHive,
  setPostToFarcaster,
  setPostToInstagram,
  farcasterChannel,
  setFarcasterChannel,
  farcasterEligible,
  farcasterSignerApproved,
  farcasterUsername,
  instagramEligible,
  instagramHasMedia,
  isLoading,
  buttonSize,
}: {
  postToHive: boolean;
  postToFarcaster: boolean;
  postToInstagram: boolean;
  setPostToHive: (v: boolean) => void;
  setPostToFarcaster: (v: boolean) => void;
  setPostToInstagram: (v: boolean) => void;
  farcasterChannel: string | null;
  setFarcasterChannel: (v: string | null) => void;
  farcasterEligible: boolean;
  farcasterSignerApproved: boolean;
  farcasterUsername: string | null;
  /** Whether the Instagram cross-post option should appear at all
   *  (main-feed snap + 100+ HP). Below the threshold the row is hidden
   *  to match the server-side trusted-user check. */
  instagramEligible: boolean;
  /** Whether the snap currently has media (image or video) — IG can't
   *  publish text-only, so without media the option is disabled with a
   *  tooltip prompting the user to attach something. */
  instagramHasMedia: boolean;
  isLoading: boolean;
  buttonSize: "sm" | "md" | "lg";
}) {
  const farcasterUsable = farcasterEligible && farcasterSignerApproved;

  const farcasterTooltip = !farcasterEligible
    ? "Link your Farcaster account in Settings to enable cross-posting"
    : !farcasterSignerApproved
    ? "Authorize Farcaster posting in Settings first"
    : "";

  return (
    <Menu placement="top-end" closeOnSelect={false}>
      <MenuButton
        as={Button}
        aria-label="Choose destinations"
        bg="primary"
        color="background"
        borderRadius="none"
        borderLeft="1px solid"
        borderLeftColor="background"
        _hover={{ bg: "muted", color: "text" }}
        _active={{ bg: "muted" }}
        isDisabled={isLoading}
        mt={2}
        mb={1}
        maxH="2rem"
        minW="36px"
        px={2}
      >
        <ChevronDownIcon boxSize={5} />
      </MenuButton>
      <MenuList bg="background" borderColor="primary" minW="260px" py={1}>
        <Box px={3} py={2}>
          <Text fontFamily="mono" fontSize="2xs" color="dim" letterSpacing="wider" textTransform="uppercase">
            Post to
          </Text>
        </Box>

        <PlatformToggleRow
          checked={postToHive}
          onToggle={() => setPostToHive(!postToHive)}
          icon={
            <Image
              src="/logos/SKATE_HIVE_CIRCLE.svg"
              alt="SkateHive"
              boxSize="16px"
            />
          }
          label="SkateHive"
        />

        <PlatformToggleRow
          checked={postToFarcaster}
          onToggle={() => setPostToFarcaster(!postToFarcaster)}
          disabled={!farcasterUsable}
          disabledHint={farcasterTooltip}
          icon={<Icon as={SiFarcaster} color="primary" boxSize={4} />}
          label="Farcaster"
          subLabel={farcasterUsername ? `@${farcasterUsername}` : undefined}
          trailing={
            !farcasterUsable ? (
              <ChakraLink
                as={NextLink}
                href="/settings"
                fontSize="2xs"
                fontFamily="mono"
                color="primary"
                _hover={{ textDecoration: "underline" }}
                onClick={(e) => e.stopPropagation()}
              >
                {farcasterEligible ? "authorize" : "link"} →
              </ChakraLink>
            ) : null
          }
        />

        {instagramEligible && (
          <PlatformToggleRow
            checked={postToInstagram}
            onToggle={() => setPostToInstagram(!postToInstagram)}
            disabled={!instagramHasMedia}
            disabledHint="Add a photo or video to enable Instagram cross-post"
            icon={<Icon as={FaInstagram} color="primary" boxSize={4} />}
            label="Instagram"
            subLabel="@skatehive"
          />
        )}

        {/* Channel selector — only meaningful when Farcaster is checked.
            We keep the MenuOptionGroup radio pattern here since this is a
            true single-select (the checkbox-style toggle UI above is for
            multi-select platform opt-in). */}
        {postToFarcaster && farcasterUsable && (
          <>
            <MenuDivider borderColor="border" my={1} />
            <MenuOptionGroup
              type="radio"
              value={farcasterChannel ?? "__none__"}
              onChange={(value) => {
                const v = Array.isArray(value) ? value[0] : value;
                setFarcasterChannel(v === "__none__" ? null : v);
              }}
              title="Farcaster channel"
              fontSize="2xs"
              fontFamily="mono"
              color="dim"
              textTransform="uppercase"
            >
              <MenuItemOption value="__none__" bg="background" _hover={{ bg: "subtle" }}>
                <Text fontFamily="mono" fontSize="sm" color="text">
                  no channel
                  <Text as="span" color="dim" fontSize="xs" ml={1}>
                    (your feed)
                  </Text>
                </Text>
              </MenuItemOption>
              {FARCASTER_CHANNELS.map((ch) => (
                <MenuItemOption
                  key={ch.id}
                  value={ch.id}
                  bg="background"
                  _hover={{ bg: "subtle" }}
                >
                  <Text fontFamily="mono" fontSize="sm" color="text">
                    {ch.label}
                  </Text>
                </MenuItemOption>
              ))}
            </MenuOptionGroup>
          </>
        )}
      </MenuList>
    </Menu>
  );
}

/**
 * Single row in the "Post to" platform picker. Clicking anywhere on the
 * row flips the checkbox — much more obvious than the previous tick-
 * in-the-left-margin pattern, where users couldn't tell that the tick
 * meant "will post here".
 */
function PlatformToggleRow({
  checked,
  onToggle,
  icon,
  label,
  subLabel,
  trailing,
  disabled,
  disabledHint,
}: {
  checked: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  subLabel?: string;
  trailing?: React.ReactNode;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const row = (
    <MenuItem
      closeOnSelect={false}
      isDisabled={disabled}
      bg="background"
      _hover={{ bg: disabled ? "background" : "subtle" }}
      onClick={() => {
        if (!disabled) onToggle();
      }}
      px={3}
      py={2}
    >
      <HStack spacing={3} w="full">
        {/* pointerEvents="none" lets clicks fall through to the parent
            MenuItem, so clicking the checkbox OR the row label toggles
            once instead of double-firing. */}
        <Checkbox
          isChecked={checked}
          isDisabled={disabled}
          pointerEvents="none"
          colorScheme="green"
          size="md"
        />
        <Box flexShrink={0}>{icon}</Box>
        <Box flex="1" minW={0}>
          <Text fontFamily="mono" fontSize="sm" color="text" noOfLines={1}>
            {label}
            {subLabel && (
              <Text as="span" color="dim" fontSize="xs" ml={1}>
                {subLabel}
              </Text>
            )}
          </Text>
        </Box>
        {trailing}
      </HStack>
    </MenuItem>
  );
  if (disabled && disabledHint) {
    return (
      <Tooltip label={disabledHint} hasArrow placement="left">
        <Box>{row}</Box>
      </Tooltip>
    );
  }
  return row;
}
