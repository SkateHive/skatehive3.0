import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  memo,
  lazy,
  Suspense,
} from "react";
import {
  VStack,
  HStack,
  Text,
  Alert,
  AlertIcon,
  Tabs,
  TabPanels,
  TabPanel,
  Box,
  Button,
  Spinner,
  Center,
} from "@chakra-ui/react";
import { getFileSignature, uploadImage } from "@/lib/hive/client-functions";
import { uploadThumbnail } from "@/lib/utils/videoThumbnailUtils";
import SkateModal from "@/components/shared/SkateModal";

// Lazy load heavy components
const VideoPlayer = lazy(() => import("./VideoPlayer"));
const VideoTimeline = lazy(() => import("./VideoTimeline"));
const ThumbnailCapture = lazy(() => import("./ThumbnailCapture"));
const VideoTrimModalFooter = lazy(() => import("./VideoTrimModalFooter"));
const ImageCropper = lazy(() => import("@/components/shared/ImageCropper"));
import type { AspectOption } from "@/components/shared/ImageCropper";

// Crop presets for the reel cover (matches the photo-snap presets).
const COVER_CROP_ASPECTS: AspectOption[] = [
  { label: "Original", value: null },
  { label: "1:1", value: 1 },
  { label: "4:5", value: 4 / 5 },
  { label: "9:16", value: 9 / 16 },
];

// Loading component for Suspense
const ComponentLoader = memo(() => (
  <Center p={4}>
    <Spinner size="lg" color="primary" />
  </Center>
));
ComponentLoader.displayName = "ComponentLoader";

/** Wrapper for a File with metadata from the trim modal */
export interface TrimmedVideoFile {
  file: File;
  thumbnailUrl: string | null;
  fromTrimModal: true;
}

interface VideoTrimModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoFile: File | null;
  onTrimComplete: (trimmedFile: TrimmedVideoFile) => void;
  maxDuration?: number;
  canBypass?: boolean;
}

const VideoTrimModal: React.FC<VideoTrimModalProps> = memo(
  ({
    isOpen,
    onClose,
    videoFile,
    onTrimComplete,
    maxDuration = 15,
    canBypass = false,
  }) => {
    // Video refs and state
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Trimming state
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);

    // UI state
    const [isDragging, setIsDragging] = useState(false);
    const [isSeeking, setIsSeeking] = useState(false);
    const [isPreviewingSlider, setIsPreviewingSlider] = useState(false);

    // Refs for throttling seeks
    const lastSeekTime = useRef(0);
    const seekTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Thumbnail selection states
    const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
    const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
    const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
    // Local data URL of the current frame, captured for the crop/position editor
    // (cropping the local frame avoids cross-origin canvas taint on upload).
    const [coverCropSrc, setCoverCropSrc] = useState<string | null>(null);

    // Advanced options toggle
    // Steps (Trim/Cover) are shown by default — this IS the media-prepare flow,
    // not a hidden "advanced" panel. The toggle can still collapse it.
    const [showAdvanced, setShowAdvanced] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    // Memoized computed values
    const trimmingRequired = useMemo(
      () => !canBypass && duration > maxDuration,
      [canBypass, duration, maxDuration]
    );

    const showAdvancedToggle = useMemo(
      () => !trimmingRequired && duration > 0,
      [trimmingRequired, duration]
    );

    const isValidSelection = useMemo(() => {
      if (!duration) return false;
      const selectionDuration = endTime - startTime;
      return (
        selectionDuration > 0 && (canBypass || selectionDuration <= maxDuration)
      );
    }, [startTime, endTime, duration, canBypass, maxDuration]);

    const hasActiveTrim = useMemo(
      () => Math.abs(startTime) > 0.1 || Math.abs(endTime - duration) > 0.1,
      [startTime, endTime, duration]
    );

    // Optimized reset function
    const resetState = useCallback(() => {
      console.log("🔄 Resetting modal state");
      setDuration(0);
      setStartTime(0);
      setEndTime(0);
      setCurrentTime(0);
      setIsPlaying(false);
      setThumbnailBlob(null);
      setThumbnailUrl(null);
      setIsGeneratingThumbnail(false);
      setActiveTab(0);
      setShowAdvanced(true);
    }, []);

    // Reset state when modal opens with a new video
    useEffect(() => {
      if (isOpen && videoFile) {
        console.log("🎭 Modal opened with video file - resetting state");
        resetState();
      }
    }, [isOpen, videoFile, resetState]);

    // Optimized event handlers with useCallback
    const handleLoadedMetadata = useCallback(() => {
      console.log("📊 Video metadata loaded");
      if (videoRef.current) {
        const videoDuration = videoRef.current.duration;

        setDuration(videoDuration);
        // Only auto-trim to maxDuration if user cannot bypass the limit
        const calculatedEndTime = canBypass
          ? videoDuration
          : Math.min(videoDuration, maxDuration);
        setEndTime(calculatedEndTime);
        setCurrentTime(0);

        // Auto-show advanced options if user needs to trim
        const needsTrimming = !canBypass && videoDuration > maxDuration;
        if (needsTrimming) {
          setShowAdvanced(true);
          setActiveTab(0); // Start on the Trim step
        } else {
          setShowAdvanced(true);
          setActiveTab(0); // Start on the Trim step
        }
      }
    }, [canBypass, maxDuration]);

    // Optimized video URL management with proper cleanup
    useEffect(() => {
      console.log("🎬 VideoTrimModal: videoFile changed", {
        hasFile: !!videoFile,
        fileName: videoFile?.name,
        fileSize: videoFile?.size,
        fileType: videoFile?.type,
      });

      if (videoFile) {
        // Reset state when new video file is loaded
        console.log("🔄 Resetting video state for new file");
        resetState();

        // Use requestIdleCallback for better performance
        const createVideoUrl = () => {
          const url = URL.createObjectURL(videoFile);
          console.log("🔗 Created blob URL:", url);
          setVideoUrl(url);

          // Force metadata check after a short delay
          const checkMetadata = () => {
            if (videoRef.current && videoRef.current.readyState >= 1) {
              if (
                videoRef.current.duration &&
                !isNaN(videoRef.current.duration)
              ) {
                handleLoadedMetadata();
              }
            }
          };

          // Use requestAnimationFrame for smoother performance
          requestAnimationFrame(() => {
            setTimeout(checkMetadata, 300); // Reduced delay
          });

          return url;
        };

        let url: string;
        if ("requestIdleCallback" in window) {
          requestIdleCallback(
            () => {
              url = createVideoUrl();
            },
            { timeout: 100 }
          );
        } else {
          url = createVideoUrl();
        }

        // Cleanup function with debounced URL revocation
        return () => {
          console.log("🧹 Scheduling blob URL cleanup:", url);
          // Use a longer delay to prevent issues with pending operations
          setTimeout(() => {
            if (url) {
              URL.revokeObjectURL(url);
            }
          }, 2000); // Increased cleanup delay
        };
      } else {
        console.log("❌ No video file, clearing URL");
        setVideoUrl(null);
      }
    }, [videoFile, resetState, handleLoadedMetadata]);

    // Optimized seek function with throttling
    const seekTo = useCallback(
      (time: number) => {
        if (isSeeking || isDragging || !videoRef.current) {
          return;
        }

        const video = videoRef.current;
        if (video.readyState < 2) {
          return;
        }

        const currentTime = video.currentTime;
        if (Math.abs(currentTime - time) < 0.1) {
          return;
        }

        const now = Date.now();
        if (now - lastSeekTime.current < 100) {
          if (seekTimeoutRef.current) {
            clearTimeout(seekTimeoutRef.current);
          }
          seekTimeoutRef.current = setTimeout(() => {
            if (videoRef.current && videoRef.current.readyState >= 2) {
              videoRef.current.currentTime = time;
              setCurrentTime(time);
              lastSeekTime.current = Date.now();
            }
            seekTimeoutRef.current = null;
          }, 50);
          return;
        }

        setIsSeeking(true);
        video.currentTime = time;
        setCurrentTime(time);
        lastSeekTime.current = now;

        const handleSeeked = () => {
          setIsSeeking(false);
          video.removeEventListener("seeked", handleSeeked);
        };

        video.addEventListener("seeked", handleSeeked);

        // Fallback timeout
        setTimeout(() => {
          if (video.readyState >= 2) {
            setIsSeeking(false);
            video.removeEventListener("seeked", handleSeeked);
          }
        }, 1000);
      },
      [isSeeking, isDragging]
    );

    const handleTimeUpdate = useCallback(() => {
      if (videoRef.current && !isDragging && !isSeeking) {
        const newTime = videoRef.current.currentTime;
        setCurrentTime(newTime);

        // Auto-pause when reaching end of selection during playback
        if (isPlaying && newTime >= endTime) {
          videoRef.current.pause();
          setIsPlaying(false);
          seekTo(startTime);
        }
      }
    }, [isDragging, isSeeking, isPlaying, endTime, startTime, seekTo]);

    const togglePlayPause = useCallback(() => {
      if (videoRef.current) {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          videoRef.current
            .play()
            .then(() => {
              setIsPlaying(true);
            })
            .catch((error) => {
              console.error("Failed to play video:", error);
              setIsPlaying(false);
            });
        }
      }
    }, [isPlaying]);

    // Seek during handle dragging (bypasses dragging check)
    const seekDuringDrag = useCallback((time: number) => {
      if (!videoRef.current) return;

      const video = videoRef.current;
      if (video.readyState < 2) return;

      video.currentTime = time;
      setCurrentTime(time);
    }, []);

    // Optimized thumbnail generation with Web Workers (if available)
    const generateThumbnail = useCallback(async () => {
      if (!videoRef.current) return null;

      setIsGeneratingThumbnail(true);

      try {
        const video = videoRef.current;

        // Use OffscreenCanvas if available for better performance
        const useOffscreenCanvas = "OffscreenCanvas" in window;

        let canvas: HTMLCanvasElement | OffscreenCanvas;
        let ctx:
          | CanvasRenderingContext2D
          | OffscreenCanvasRenderingContext2D
          | null;

        if (useOffscreenCanvas) {
          canvas = new OffscreenCanvas(640, 640);
          ctx = canvas.getContext("2d");
        } else {
          canvas = document.createElement("canvas");
          ctx = (canvas as HTMLCanvasElement).getContext("2d");
        }

        if (!ctx) {
          setIsGeneratingThumbnail(false);
          return null;
        }

        // Use optimized dimensions with aspect ratio preservation
        const aspectRatio = video.videoWidth / video.videoHeight;
        const maxWidth = 640;
        const maxHeight = 640;

        if (aspectRatio > 1) {
          // Landscape video
          canvas.width = maxWidth;
          canvas.height = Math.round(maxWidth / aspectRatio);
        } else {
          // Portrait or square video
          canvas.height = maxHeight;
          canvas.width = Math.round(maxHeight * aspectRatio);
        }

        // Fill with black background and draw video
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to blob with optimized settings
        let blob: Blob;
        if (useOffscreenCanvas) {
          blob = await (canvas as OffscreenCanvas).convertToBlob({
            type: "image/webp",
            quality: 0.75,
          });
        } else {
          blob = await new Promise<Blob>((resolve) => {
            (canvas as HTMLCanvasElement).toBlob(
              (blob) => resolve(blob!),
              "image/webp",
              0.75
            );
          });
        }

        setThumbnailBlob(blob);

        const thumbnailFile = new File([blob], "thumbnail.webp", {
          type: "image/webp",
        });

        // Attempt Hive image upload first, fall back to Pinata if signature fails
        let hiveUrl: string | null = null;
        try {
          const signature = await getFileSignature(thumbnailFile);
          hiveUrl = await uploadImage(thumbnailFile, signature);
        } catch (error) {
          console.warn("Hive thumbnail upload failed, falling back to Pinata:", error);
          hiveUrl = await uploadThumbnail(thumbnailFile);
        }

        if (!hiveUrl) {
          throw new Error("Thumbnail upload failed");
        }

        setThumbnailUrl(hiveUrl);
        setIsGeneratingThumbnail(false);
        return hiveUrl;
      } catch (error) {
        console.error("Error generating/uploading thumbnail:", error);
        setIsGeneratingThumbnail(false);
        return null;
      }
    }, []);

    // Optimized event handlers
    const handleCaptureFrame = useCallback(async () => {
      await generateThumbnail();
    }, [generateThumbnail]);

    // Capture the current frame to a local data URL and open the crop/position
    // editor (no upload yet — the cropped result is uploaded on confirm).
    const handleCropFrame = useCallback(() => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setCoverCropSrc(canvas.toDataURL("image/jpeg", 0.92));
    }, []);

    // Upload the cropped cover and use it as the video thumbnail.
    const handleCoverCropComplete = useCallback(async (file: File) => {
      setIsGeneratingThumbnail(true);
      try {
        let url: string | null = null;
        try {
          const signature = await getFileSignature(file);
          url = await uploadImage(file, signature);
        } catch (error) {
          console.warn("Hive cover upload failed, falling back to Pinata:", error);
          url = await uploadThumbnail(file);
        }
        if (url) {
          setThumbnailBlob(file);
          setThumbnailUrl(url);
        }
      } catch (error) {
        console.error("Error uploading cropped cover:", error);
      } finally {
        setIsGeneratingThumbnail(false);
        setCoverCropSrc(null);
      }
    }, []);

    const handleSliderChangeEnd = useCallback(() => {
      setIsPreviewingSlider(false);
      setIsDragging(false);
    }, []);

    // Optimized video trimming with better memory management
    const createTrimmedVideo = useCallback(
      async (file: File, start: number, end: number): Promise<Blob> => {
        console.log(`🎬 Creating trimmed video: ${start}s to ${end}s`);

        return new Promise((resolve, reject) => {
          const video = document.createElement("video");
          const videoUrl = URL.createObjectURL(file);
          video.src = videoUrl;
          video.muted = true;
          video.playsInline = true;

          video.onloadedmetadata = () => {
            const duration = end - start;

            if (duration <= 0 || start >= video.duration) {
              URL.revokeObjectURL(videoUrl);
              reject(new Error("Invalid trim range"));
              return;
            }

            // Create canvas for recording with optimized settings
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", {
              alpha: false,
              desynchronized: true,
            });

            if (!ctx) {
              URL.revokeObjectURL(videoUrl);
              reject(new Error("Failed to get canvas context"));
              return;
            }

            // Preserve original aspect ratio while limiting max resolution
            const originalWidth = video.videoWidth;
            const originalHeight = video.videoHeight;
            const aspectRatio = originalWidth / originalHeight;

            // Calculate dimensions maintaining aspect ratio
            let canvasWidth = originalWidth;
            let canvasHeight = originalHeight;

            // Scale down if video is too large, maintaining aspect ratio
            const maxWidth = 1920;
            const maxHeight = 1080;

            if (canvasWidth > maxWidth) {
              canvasWidth = maxWidth;
              canvasHeight = Math.round(maxWidth / aspectRatio);
            }

            if (canvasHeight > maxHeight) {
              canvasHeight = maxHeight;
              canvasWidth = Math.round(maxHeight * aspectRatio);
            }

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            // Create MediaRecorder with optimized settings
            const stream = canvas.captureStream(30);
            const mediaRecorder = new MediaRecorder(stream, {
              mimeType: "video/webm;codecs=vp9",
              videoBitsPerSecond: 2500000, // 2.5 Mbps for good quality/size balance
            });

            const chunks: Blob[] = [];

            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                chunks.push(event.data);
              }
            };

            mediaRecorder.onstop = () => {
              const blob = new Blob(chunks, { type: "video/webm" });
              URL.revokeObjectURL(videoUrl);
              resolve(blob);
            };

            mediaRecorder.onerror = (event) => {
              console.error("MediaRecorder error:", event);
              URL.revokeObjectURL(videoUrl);
              reject(new Error("Recording failed"));
            };

            // Position video at start time
            video.currentTime = start;

            video.onseeked = () => {
              console.log(
                `🎯 Video positioned at ${video.currentTime}s, starting recording`
              );

              // Start recording
              mediaRecorder.start(100); // Record in 100ms chunks

              // Play video at normal speed
              video.play().catch((error) => {
                console.error("Video play error:", error);
                URL.revokeObjectURL(videoUrl);
                reject(new Error("Video playback failed"));
              });

              // Set up timer to stop at exact duration
              setTimeout(() => {
                console.log(`⏹️ Stopping recording after ${duration}s`);
                video.pause();
                mediaRecorder.stop();
              }, duration * 1000);
            };

            // Optimized frame drawing with requestAnimationFrame
            let animationId: number;
            const drawFrame = () => {
              if (!video.paused && !video.ended && video.currentTime < end) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                animationId = requestAnimationFrame(drawFrame);
              }
            };

            video.onplay = () => {
              drawFrame();
            };

            video.onpause = () => {
              if (animationId) {
                cancelAnimationFrame(animationId);
              }
            };

            video.onerror = () => {
              URL.revokeObjectURL(videoUrl);
              reject(new Error("Video playback error"));
            };
          };

          video.onerror = () => {
            URL.revokeObjectURL(videoUrl);
            reject(new Error("Failed to load video"));
          };
        });
      },
      []
    );

    // Optimized trim handler
    const handleTrim = useCallback(async () => {
      if (!videoFile || !videoRef.current) return;

      setIsProcessing(true);

      try {
        console.log("🎬 Starting video trimming process...");

        const trimmedBlob = await createTrimmedVideo(
          videoFile,
          startTime,
          endTime
        );

        let finalThumbnailUrl = thumbnailUrl;
        if (!finalThumbnailUrl) {
          console.log("📸 Generating thumbnail for trimmed video...");
          const middleTime = startTime + (endTime - startTime) / 2;
          videoRef.current.currentTime = middleTime;
          await new Promise((resolve) => setTimeout(resolve, 100));
          finalThumbnailUrl = await generateThumbnail();
        }

        const trimmedFile = new File(
          [trimmedBlob],
          `trimmed_${videoFile.name}`,
          {
            type: "video/webm",
          }
        );

        console.log("✅ Video trimming completed successfully");
        onTrimComplete({
          file: trimmedFile,
          thumbnailUrl: finalThumbnailUrl ?? null,
          fromTrimModal: true,
        });
        onClose();
      } catch (error) {
        console.error("❌ Error trimming video:", error);
        alert("Failed to trim video. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    }, [
      videoFile,
      startTime,
      endTime,
      thumbnailUrl,
      createTrimmedVideo,
      generateThumbnail,
      onTrimComplete,
      onClose,
    ]);

    // Optimized bypass handler
    const handleBypass = useCallback(async () => {
      if (videoFile) {
        try {
          let finalThumbnailUrl = thumbnailUrl;
          if (!finalThumbnailUrl) {
            if (videoRef.current) {
              videoRef.current.currentTime = duration / 2;
              await new Promise((resolve) => setTimeout(resolve, 100));
              finalThumbnailUrl = await generateThumbnail();
            }
          }

          onTrimComplete({
            file: videoFile,
            thumbnailUrl: finalThumbnailUrl ?? null,
            fromTrimModal: true,
          });
          onClose();
        } catch (error) {
          console.error("Error generating thumbnail for bypass:", error);
          onTrimComplete({
            file: videoFile,
            thumbnailUrl: null,
            fromTrimModal: true,
          });
          onClose();
        }
      }
    }, [
      videoFile,
      thumbnailUrl,
      duration,
      generateThumbnail,
      onTrimComplete,
      onClose,
    ]);

    const selectedDuration = endTime - startTime;

    // UX Logic
    const videoExceedsLimit = duration > maxDuration;
    const selectionExceedsLimit = selectedDuration > maxDuration;

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        if (seekTimeoutRef.current) {
          clearTimeout(seekTimeoutRef.current);
          seekTimeoutRef.current = null;
        }
      };
    }, []);

    return (
      <>
        <style>
          {`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
        </style>
        <SkateModal
          isOpen={isOpen}
          onClose={onClose}
          title={trimmingRequired ? "prepare-media (trim required)" : "prepare-media"}
          size={{ base: "xl", md: "xl" }}
          onCloseComplete={() => {
            setVideoUrl(null);
            setIsPlaying(false);
            setThumbnailBlob(null);
            setThumbnailUrl(null);
            setIsGeneratingThumbnail(false);
          }}
          closeOnOverlayClick={false}
          motionPreset="slideInBottom"
          footer={
            <Suspense fallback={null}>
              <VideoTrimModalFooter
                isValidSelection={isValidSelection}
                maxDuration={maxDuration}
                canBypass={canBypass}
                isProcessing={isProcessing}
                hasActiveTrim={hasActiveTrim}
                onBypass={handleBypass}
                onTrim={handleTrim}
              />
            </Suspense>
          }
        >
          <Box
            maxH={{ base: "100vh", md: "90vh" }}
            overflowY="auto"
          >
            <Box px={{ base: 3, md: 6 }} py={{ base: 3, md: 4 }}>
              <VStack align="start" spacing={2} mb={4}>
                {canBypass ? (
                  <Text fontSize="sm" color="primary">
                    ✨ You have more than 100 HP - You can use the full video or
                    trim it as needed
                  </Text>
                ) : (
                  <Text fontSize="sm" color="accent">
                    📹 Videos are limited to {maxDuration} seconds in the feed.
                    Get {">"}100 HP to bypass this limit.
                  </Text>
                )}
              </VStack>

              <VStack spacing={{ base: 3, md: 4 }}>
                {/* Video Player - Always at the top */}
                {videoUrl ? (
                  <Suspense fallback={<ComponentLoader />}>
                    <VideoPlayer
                      videoRef={videoRef}
                      videoUrl={videoUrl}
                      isPlaying={isPlaying}
                      onLoadedMetadata={handleLoadedMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      onTogglePlayPause={togglePlayPause}
                    />
                  </Suspense>
                ) : (
                  <Box
                    width="100%"
                    height="200px"
                    bg="red.100"
                    border="2px solid red"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Text color="red.600" fontWeight="bold">
                      DEBUG: No videoUrl - videoFile:{" "}
                      {videoFile ? "exists" : "missing"}
                    </Text>
                  </Box>
                )}

                {/* Required Trimming Notice */}
                {trimmingRequired && (
                  <Alert status="warning" size="sm">
                    <AlertIcon />
                    <Text fontSize="sm" fontWeight="medium">
                      🎬 Video trimming required - Your video is longer than{" "}
                      {maxDuration} seconds. Please trim it below.
                    </Text>
                  </Alert>
                )}

                {/* Show Advanced Toggle - Only show when trimming is not required */}
                {showAdvancedToggle && (
                  <Button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    variant="ghost"
                    size="sm"
                    width="100%"
                    leftIcon={
                      <Text fontSize="lg">{showAdvanced ? "▼" : "▶"}</Text>
                    }
                  >
                    {showAdvanced ? "Hide editing tools" : "Trim & cover"}
                  </Button>
                )}

                {/* Advanced Options - Always show when trimming required, or when user toggles */}
                {(showAdvanced || trimmingRequired) && (
                  <Box
                    width="100%"
                    style={{
                      animation: "fadeIn 0.2s ease-in-out",
                    }}
                  >
                    {/* Tabs for Trim and Thumbnail functionality */}
                    <Tabs
                      width="100%"
                      variant="enclosed"
                      colorScheme="blue"
                      index={activeTab}
                      onChange={setActiveTab}
                    >
                      {/* Step header — Prepare media: Trim → Cover */}
                      <HStack spacing={2} mb={4} flexWrap="wrap">
                        <Button
                          size="sm"
                          variant={activeTab === 0 ? "solid" : "outline"}
                          colorScheme={trimmingRequired ? "orange" : "blue"}
                          borderRadius="full"
                          onClick={() => setActiveTab(0)}
                        >
                          {`1 · Trim${trimmingRequired ? " (required)" : ""}`}
                        </Button>
                        <Button
                          size="sm"
                          variant={activeTab === 1 ? "solid" : "outline"}
                          colorScheme="blue"
                          borderRadius="full"
                          onClick={() => setActiveTab(1)}
                        >
                          2 · Cover
                        </Button>
                      </HStack>

                      <TabPanels>
                        {/* Step 1 — Trim */}
                        <TabPanel px={0}>
                          <Suspense fallback={<ComponentLoader />}>
                            <VideoTimeline
                              duration={duration}
                              currentTime={currentTime}
                              startTime={startTime}
                              endTime={endTime}
                              isValidSelection={isValidSelection}
                              maxDuration={maxDuration}
                              canBypass={canBypass}
                              onSeek={seekTo}
                              onSeekDuringDrag={seekDuringDrag}
                              onStartTimeChange={setStartTime}
                              onEndTimeChange={setEndTime}
                              onDragStart={() => {
                                setIsPreviewingSlider(true);
                                setIsDragging(true);
                              }}
                              onDragEnd={handleSliderChangeEnd}
                            />
                          </Suspense>
                        </TabPanel>
                        {/* Step 2 — Cover (pick frame + crop/position) */}
                        <TabPanel px={0}>
                          <Suspense fallback={<ComponentLoader />}>
                            <ThumbnailCapture
                              thumbnailUrl={thumbnailUrl}
                              isGeneratingThumbnail={isGeneratingThumbnail}
                              onCaptureFrame={handleCaptureFrame}
                              onCropFrame={handleCropFrame}
                            />
                          </Suspense>
                          {coverCropSrc && (
                            <Suspense fallback={null}>
                              <ImageCropper
                                isOpen
                                imageSrc={coverCropSrc}
                                title="Crop & position cover"
                                aspectOptions={COVER_CROP_ASPECTS}
                                outputMaxDimension={1080}
                                outputFileName="cover.jpg"
                                onClose={() => setCoverCropSrc(null)}
                                onCropComplete={handleCoverCropComplete}
                              />
                            </Suspense>
                          )}
                        </TabPanel>
                      </TabPanels>

                      {/* Step navigation */}
                      <HStack justify="space-between" mt={4}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveTab(0)}
                          isDisabled={activeTab === 0}
                        >
                          ← Trim
                        </Button>
                        <Button
                          size="sm"
                          colorScheme="blue"
                          onClick={() => setActiveTab(1)}
                          isDisabled={activeTab === 1}
                        >
                          Cover →
                        </Button>
                      </HStack>
                    </Tabs>
                  </Box>
                )}
              </VStack>
            </Box>
          </Box>
        </SkateModal>
      </>
    );
  }
);

VideoTrimModal.displayName = "VideoTrimModal";

export default VideoTrimModal;
