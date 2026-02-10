import React, { useState, useRef, useMemo, useCallback } from "react";
import { useTranslations } from "@/contexts/LocaleContext";
import {
  Box,
  Textarea,
  HStack,
  Button,
  Image,
  IconButton,
  Wrap,
  Progress,
  Input,
  Tooltip,
  useToast,
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";
import GiphySelector from "./GiphySelector";
import VideoUploader, {
  VideoUploaderRef,
  ErrorDemoPanel,
} from "./VideoUploader";
import VideoTrimModal, { type TrimmedVideoFile } from "./VideoTrimModal";
import InstagramModal from "./InstagramModal";
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
import { APP_CONFIG, HIVE_CONFIG } from "@/config/app.config";
import { extractIPFSHash } from "@/lib/utils/ipfsMetadata";
import {
  generateThumbnailWithCanvas,
  uploadThumbnail,
} from "@/lib/utils/videoThumbnailUtils";
import { generateVideoIframeMarkdown } from "@/lib/markdown/composeUtils";
import { FaVideo } from "react-icons/fa6";
import { FaTimes } from "react-icons/fa";
import ImageCompressor from "@/lib/utils/ImageCompressor";
import { ImageCompressorRef } from "@/lib/utils/ImageCompressor";
import imageCompression from "browser-image-compression";

import GIFMakerWithSelector, {
  GIFMakerRef as GIFMakerWithSelectorRef,
} from "./GIFMakerWithSelector";
import useHivePower from "@/hooks/useHivePower";
import { useInstagramHealth } from "@/hooks/useInstagramHealth";
import { TbGif } from "react-icons/tb";
import MatrixOverlay from "@/components/graphics/MatrixOverlay";
import useUserbaseHiveIdentity from "@/hooks/useUserbaseHiveIdentity";

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
}

const SnapComposer = React.memo(function SnapComposer({
  pa,
  pp,
  onNewComment,
  post = false,
  onClose,
  submitLabel,
  buttonSize = "lg",
}: SnapComposerProps) {
  const { user, aioha } = useAioha();
  const { handle: effectiveUser, canUseAppFeatures } = useEffectiveHiveUser();
  const { identity: userbaseHiveIdentity } = useUserbaseHiveIdentity();
  const linkedHiveHandle = userbaseHiveIdentity?.handle || null;
  const toast = useToast();
  const t = useTranslations();
  const postBodyRef = useRef<HTMLTextAreaElement>(null);
  const [selectedGif, setSelectedGif] = useState<IGif | null>(null);
  const [isGiphyModalOpen, setGiphyModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoProcessingError, setVideoProcessingError] = useState<
    string | null
  >(null);
  const videoUploaderRef = useRef<VideoUploaderRef>(null);
  const imageCompressorRef = useRef<ImageCompressorRef>(null);
  const [compressedImages, setCompressedImages] = useState<
    { url: string; fileName: string; caption: string }[]
  >([]);

  const imageUploadInputRef = useRef<HTMLInputElement>(null);

  // GIF maker state and refs (direct integration)
  const [isGifMakerOpen, setGifMakerOpen] = useState(false);
  const gifMakerWithSelectorRef = useRef<GIFMakerWithSelectorRef>(null);
  const [isProcessingGif, setIsProcessingGif] = useState(false);

  // Instagram modal state
  const [isInstagramModalOpen, setInstagramModalOpen] = useState(false);

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

  // Handle video file selection (with duration check for SnapComposer)
  const handleVideoFile = async (file: File) => {
    try {
      // Clear any previous pending video file to prevent memory leaks
      if (pendingVideoFile) {
        setPendingVideoFile(null);
      }

      const duration = await getVideoDuration(file);

      // Always open trim modal for video editing options
      // Users with >100HP can choose to use original or trim
      // Users with <100HP must trim if over 15s
      if (duration > 15 || canBypassLimit) {
        setPendingVideoFile(file);
        setIsTrimModalOpen(true);
        return;
      }

      // Only for videos under 15s and users without bypass - upload directly
      if (videoUploaderRef.current) {
        startUpload();
        await videoUploaderRef.current.handleFile(file);
        finishUpload();
      }
    } catch (error) {
      console.error("Error checking video duration:", error);
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
  };

  // Handle trim modal close
  const handleTrimModalClose = () => {
    setIsTrimModalOpen(false);
    // Don't immediately clear pendingVideoFile to prevent blob URL errors
    // It will be cleared when upload completes or new file is selected
  };

  // Handler for compressed image upload
  const handleCompressedImageUpload = async (
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
      
      console.log('🖼️ [SnapComposer] Getting file signature...');
      const signature = await getFileSignature(file);
      console.log('🖼️ [SnapComposer] Got signature, uploading image...');
      
      const uploadUrl = await uploadImage(
        file,
        signature,
        compressedImages.length,
        setUploadProgress
      );
      console.log('🖼️ [SnapComposer] Upload complete, URL:', uploadUrl);
      
      if (uploadUrl) {
        setCompressedImages((prev) => [
          ...prev,
          { url: uploadUrl, fileName: file.name, caption: "" },
        ]);
        console.log('✅ [SnapComposer] Image added to compressedImages array');
      }
    } catch (error) {
      console.error("❌ [SnapComposer] Error uploading compressed image:", error);
      alert(t('compose.imageUploadFailed') + ": " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
      finishUpload();
    }
  };

  const handleGifWebpUpload = async (
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
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert(t('compose.gifSizeLimit'));
      return;
    }
    startUpload();
    setIsLoading(true);
    try {
      const signature = await getFileSignature(file);
      const uploadUrl = await uploadImage(
        file,
        signature,
        compressedImages.length,
        setUploadProgress
      );
      if (uploadUrl) {
        setCompressedImages((prev) => [
          ...prev,
          { url: uploadUrl, fileName: file.name, caption: "" },
        ]);
      }
    } catch (error) {
      console.error("Error uploading GIF/WEBP:", error);
    } finally {
      setIsLoading(false);
      finishUpload();
      e.target.value = ""; // Reset input
    }
  };

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
      const signature = await getFileSignature(file);
      const uploadUrl = await uploadImage(
        file,
        signature,
        compressedImages.length,
        setUploadProgress
      );
      if (uploadUrl) {
        setCompressedImages((prev) => [
          ...prev,
          { url: uploadUrl, fileName: file.name, caption: "" },
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
      console.log('📁 [SnapComposer] Processing file:', file.name, 'type:', file.type);
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
          alert(
            t('compose.compressionError') + ": " +
            (err instanceof Error ? err.message : err)
          );
        }
      } else {
        alert("Unsupported file type: " + file.type);
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
        pa,
        pp,
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
    const commentBody = postBodyRef.current?.value?.trim() ?? "";
    if (!commentBody) {
      alert(t('compose.emptyComment'));
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

        // Prepare metadata with proper thumbnail handling for video-only posts
        const hasRegularImages = compressedImages.length > 0;
        const hasVideoThumbnails = validUrls.length > compressedImages.length; // validUrls includes video thumbnails

        // Build metadata object
        const metadata: any = {
          app: "Skatehive App 3.0",
          tags: snapsTags,
          images: validUrls,
        };

        // For video-only posts (no regular images), add video thumbnails to thumbnail field for better Farcaster frame support
        if (!hasRegularImages && hasVideoThumbnails) {
          const videoThumbnails = validUrls.slice(compressedImages.length); // Get only the video thumbnails
          metadata.thumbnail = videoThumbnails;
          console.log(
            "🎬 Video-only post detected, added thumbnails to metadata.thumbnail:",
            videoThumbnails
          );
        }

        // Build the final comment body with images and video appended
        let finalCommentBody = commentBody;
        
        // Append image markdown for all uploaded images
        if (compressedImages.length > 0) {
          const imageMarkdown = compressedImages
            .map(img => `\n![${img.fileName}](${img.url})`)
            .join('');
          finalCommentBody = finalCommentBody + imageMarkdown;
        }
        
        // Append video iframe if video was uploaded
        if (videoUrl) {
          finalCommentBody = finalCommentBody + generateVideoIframeMarkdown(videoUrl);
        }

        const permlink = crypto.randomUUID();
        let commentResponse: any = null;

        if (user) {
          commentResponse = await aioha.comment(
            pa,
            postPermlink,
            permlink,
            "",
            finalCommentBody,
            metadata
          );
        } else {
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

          postBodyRef.current!.value = "";
          setCompressedImages([]);
          setSelectedGif(null);
          setVideoUrl(null);

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
          onClose();
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
  ]);

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

  // Video upload logic in handleDrop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) startUpload();
    for (const file of files) {
      if (file.type.startsWith("image/")) {
        // If GIF or WEBP, use GIF/WEBP upload logic
        if (file.type === "image/gif" || file.type === "image/webp") {
          // Simulate input event for GIF/WEBP
          const fakeEvent = {
            target: { files: [file] },
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
            const compressedFile = await imageCompression(file, options);
            const url = URL.createObjectURL(compressedFile);
            await handleCompressedImageUpload(url, compressedFile.name);
            URL.revokeObjectURL(url);
          } catch (err) {
            alert(
              "Error compressing image: " +
              (err instanceof Error ? err.message : err)
            );
          }
        }
      } else if (file.type.startsWith("video/")) {
        // For video, use our new video handling logic with trimming
        try {
          await handleVideoFile(file);
        } catch (error) {
          console.error("Error uploading video:", error);
          alert("Failed to upload video");
        }
      } else {
        alert("Unsupported file type: " + file.type);
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
          borderBottom={"1px"}
          borderColor="muted"
        >
          <Textarea
            id="snap-composer-textarea"
            data-testid="snap-composer-textarea"
            placeholder={t('compose.placeholder')}
            bg="background"
            borderRadius={"base"}
            mb={3}
            minH={"100px"}
            ref={postBodyRef}
            _placeholder={{ color: "text" }}
            isDisabled={isLoading}
            onKeyDown={handleKeyDown} // Attach the keydown handler
            _focusVisible={{ border: "tb1" }}
          />

          {/* Media Preview Section - Videos and images side by side */}
          {(compressedImages.length > 0 || selectedGif || videoUrl) && (
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
                    onClick={() => setVideoUrl(null)}
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
              )}
              <Box display="none">
                <ImageCompressor
                  ref={imageCompressorRef}
                  onUpload={handleCompressedImageUpload}
                  isProcessing={isLoading}
                />
              </Box>
              {/* GIF Maker Button */}
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
              {/* Instagram Button - Always show, health check happens in modal */}
              <Tooltip label={t('compose.importFromInstagram')} placement="top">
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
              </Tooltip>
            </HStack>
            <Box display={buttonSize === "sm" ? "inline-block" : undefined}>
              <Button
                id="snap-composer-submit-btn"
                data-testid="snap-composer-submit"
                bg="primary"
                color="background"
                _hover={{ bg: "muted", color: "text", border: "tb1" }}
                isLoading={isLoading}
                isDisabled={isLoading || isUploadingMedia}
                onClick={handleComment}
                borderRadius={"none"}
                fontWeight="bold"
                px={buttonSize === "sm" ? 1 : 8}
                mt={2}
                mb={1}
                minWidth={buttonSize === "sm" ? undefined : "120px"}
                width={buttonSize === "sm" ? undefined : "30%"}
                maxWidth={buttonSize === "sm" ? undefined : undefined}
                fontSize={buttonSize === "sm" ? "xs" : "lg"}
                lineHeight={buttonSize === "sm" ? "1" : undefined}
                flex={buttonSize === "sm" ? "none" : undefined}
                alignSelf={buttonSize === "sm" ? "flex-start" : undefined}
                display={buttonSize === "sm" ? "inline-flex" : undefined}
                maxH={"2rem"}
              >
                {buttonText}
              </Button>
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

      {/* Matrix Overlay and login prompt if not logged in */}
      {!effectiveUser && <></>}
    </Box>
  );
});

export default SnapComposer;
