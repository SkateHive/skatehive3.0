"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  Box,
  IconButton,
  VStack,
  HStack,
  Text,
  Button,
  Spinner,
} from "@chakra-ui/react";
import {
  FaChevronUp,
  FaChevronDown,
  FaTimes,
  FaHeart,
  FaComment,
  FaShare,
} from "react-icons/fa";
import { LuPlay, LuPause, LuVolumeX, LuVolume2 } from "react-icons/lu";
import { Discussion } from "@hiveio/dhive";
import { useFarcasterMiniapp } from "@/hooks/useFarcasterMiniapp";
import { parseMediaContent } from "@/lib/utils/snapUtils";
import { useVideoPreloader } from "@/hooks/useVideoPreloader";
import {
  getVideoFeedConfig,
  VIDEO_FEED_CONFIG,
  VideoFeedPerformance,
} from "@/lib/config/videoFeedConfig";

// Get environment-specific configuration
const config = getVideoFeedConfig();

interface VerticalVideoFeedProps {
  comments: Discussion[];
  onClose: () => void;
  initialVideoSrc?: string;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
}

interface VideoPlayerProps {
  src: string;
  isActive: boolean;
  onNext: () => void;
  onPrev: () => void;
  discussion: Discussion;
  isPreloaded?: boolean;
  opacity?: number;
  zIndex?: number;
  onVideoReady?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  isActive,
  onNext,
  onPrev,
  discussion,
  isPreloaded = false,
  opacity = 1,
  zIndex = 1,
  onVideoReady,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [videoReady, setVideoReady] = useState(false);
  const [hasEnoughData, setHasEnoughData] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<"up" | "down" | null>(
    null
  );
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeoutId, setControlsTimeoutId] =
    useState<NodeJS.Timeout | null>(null);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);
  const touchStartX = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  const { isInMiniapp } = useFarcasterMiniapp();

  // Simplified auto-play for instant experience - no loading states
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;

    // Immediate setup for smooth experience
    setProgress(0);
    setIsPlaying(true);
    setIsInitialLoad(false); // Never show loading
    setVideoReady(true); // Always assume ready
    setHasEnoughData(true);

    const attemptPlay = async () => {
      try {
        video.currentTime = 0;
        video.muted = true;

        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              onVideoReady?.(); // Immediately notify ready
            })
            .catch((error) => {
              if (error.name !== "AbortError" && config.enableConsoleLogging) {
                console.warn("Autoplay failed:", error.name);
              }
              setIsPlaying(false);
            });
        }
      } catch (error) {
        if (config.enableConsoleLogging) {
          console.warn("Play failed:", error);
        }
        setIsPlaying(false);
      }
    };

    // Play immediately
    attemptPlay();

    // Minimal event handlers for instant experience
    const handleCanPlay = () => {
      onVideoReady?.();
      if (video.paused && isActive) {
        attemptPlay();
      }
    };

    video.addEventListener("canplay", handleCanPlay);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
    };
  }, [src, isActive, onVideoReady]);

  // Controls visibility management
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);

    // Clear existing timeout
    if (controlsTimeoutId) {
      clearTimeout(controlsTimeoutId);
    }

    // Set new timeout to hide controls after 3 seconds
    const timeoutId = setTimeout(() => {
      setShowControls(false);
    }, 3000);

    setControlsTimeoutId(timeoutId);
  }, [controlsTimeoutId]);

  // Show controls when video becomes active
  useEffect(() => {
    if (isActive) {
      showControlsTemporarily();
    }

    return () => {
      if (controlsTimeoutId) {
        clearTimeout(controlsTimeoutId);
      }
    };
  }, [isActive, showControlsTemporarily, controlsTimeoutId]);

  // Handle video events for accurate play state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      setIsInitialLoad(false);
    };
    const handlePause = () => setIsPlaying(false);
    const handleWaiting = () => {
      // Don't change playing state on waiting during initial load
      if (!isInitialLoad) {
        setIsPlaying(false);
      }
    };
    const handlePlaying = () => {
      setIsPlaying(true);
      setIsInitialLoad(false);
    };

    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("waiting", handleWaiting);
    video.addEventListener("playing", handlePlaying);

    return () => {
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("waiting", handleWaiting);
      video.removeEventListener("playing", handlePlaying);
    };
  }, [isInitialLoad]);

  // Handle time updates
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const duration = video.duration;
      if (duration > 0) {
        setProgress((video.currentTime / duration) * 100);
      }
    };

    const handleEnded = () => {
      // Auto-advance to next video when current one ends
      onNext();
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, [onNext]);

  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;

    if (isPlaying || !videoRef.current.paused) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      // Optimistically set playing state immediately
      setIsPlaying(true);
      videoRef.current.play().catch((error) => {
        if (config.enableConsoleLogging) {
          console.warn("Play failed on toggle:", error);
        }
        setIsPlaying(false);
      });
    }
  }, [isPlaying]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;

    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Native touch event handlers to avoid passive listener issues
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
      touchStartX.current = e.touches[0].clientX;
      touchStartTime.current = Date.now();
      isDragging.current = false;
      setSwipeDirection(null);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) {
        const currentY = e.touches[0].clientY;
        const currentX = e.touches[0].clientX;
        const deltaY = Math.abs(currentY - touchStartY.current);
        const deltaX = Math.abs(currentX - touchStartX.current);

        // Only start dragging if vertical movement is greater than horizontal
        if (deltaY > 10 && deltaY > deltaX) {
          isDragging.current = true;
          e.preventDefault();
        }
      }

      if (isDragging.current) {
        const currentY = e.touches[0].clientY;
        const deltaY = touchStartY.current - currentY;

        // Show swipe direction hint
        if (Math.abs(deltaY) > 20) {
          setSwipeDirection(deltaY > 0 ? "up" : "down");
        } else {
          setSwipeDirection(null);
        }

        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndY = e.changedTouches[0].clientY;
      const touchEndTime = Date.now();
      const deltaY = touchStartY.current - touchEndY;
      const deltaX = Math.abs(
        e.changedTouches[0].clientX - touchStartX.current
      );
      const deltaTime = touchEndTime - touchStartTime.current;

      // Improved swipe detection parameters
      const minSwipeDistance = 30;
      const maxSwipeTime = 500;
      const maxHorizontalDrift = 100;

      // Check if this was a tap (small movement, quick time)
      const isTap =
        Math.abs(deltaY) < 10 &&
        deltaX < 10 &&
        deltaTime < 300 &&
        !isDragging.current;

      if (isTap) {
        // Show controls on tap
        showControlsTemporarily();
      } else if (
        // Only trigger swipe if it was a vertical swipe
        Math.abs(deltaY) > minSwipeDistance &&
        deltaTime < maxSwipeTime &&
        deltaX < maxHorizontalDrift &&
        isDragging.current
      ) {
        // Add haptic feedback if available
        if ("vibrate" in navigator) {
          navigator.vibrate(50);
        }

        if (deltaY > 0) {
          // Swipe up - next video
          onNext();
        } else {
          // Swipe down - previous video
          onPrev();
        }
      }

      // Reset swipe direction
      setSwipeDirection(null);
      isDragging.current = false;
    };

    // Add event listeners with proper passive options
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onNext, onPrev]);

  // Keyboard navigation for miniapp context
  useEffect(() => {
    if (!isActive || !isInMiniapp) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          onNext();
          break;
        case "ArrowUp":
          e.preventDefault();
          onPrev();
          break;
        case " ":
          e.preventDefault();
          togglePlayPause();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, isInMiniapp, onNext, onPrev, togglePlayPause]);

  return (
    <Box
      ref={containerRef}
      position="relative"
      width="100vw"
      height="100vh"
      bg="black"
      display="flex"
      alignItems="center"
      justifyContent="center"
      style={{
        touchAction: "pan-y", // Allow vertical scrolling but prevent horizontal
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
    >
      {/* Video Element - Always visible for smooth experience */}
      <video
        ref={videoRef}
        src={src}
        muted={isMuted}
        playsInline
        loop
        autoPlay
        preload="auto" // Always preload for instant availability
        crossOrigin="anonymous"
        onClick={(e) => {
          // Show controls and toggle play/pause if it wasn't a swipe gesture
          if (!isDragging.current) {
            showControlsTemporarily();
            // Don't toggle play/pause immediately, let user interact with controls
          }
        }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: opacity,
          zIndex: zIndex,
          transition: "opacity 0.2s ease-out", // Faster transition for snappier feel
          backgroundColor: "black", // Prevent flash of white
        }}
      />

      {/* Progress Bar - Show/hide with controls */}
      <Box
        position="absolute"
        bottom={0}
        left={0}
        right={0}
        height="2px"
        bg="rgba(255,255,255,0.3)"
        opacity={showControls ? 1 : 0}
        transition="opacity 0.3s ease"
        zIndex={998}
      >
        <Box
          height="100%"
          bg="white"
          width={`${progress}%`}
          transition="width 0.1s"
        />
      </Box>

      {/* Play/Pause Overlay - Show when paused and controls are visible */}
      {!isPlaying &&
        !isInitialLoad &&
        videoRef.current?.paused !== false &&
        showControls && (
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="rgba(0,0,0,0.6)"
            borderRadius="50%"
            p={4}
            cursor="pointer"
            onClick={togglePlayPause}
            zIndex={1001}
            transition="opacity 0.3s ease"
          >
            <LuPlay size={48} color="white" />
          </Box>
        )}

      {/* Swipe Direction Indicator */}
      {swipeDirection && (
        <Box
          position="absolute"
          top="50%"
          left="50%"
          transform="translate(-50%, -50%)"
          bg="rgba(255,255,255,0.8)"
          borderRadius="50%"
          p={3}
          pointerEvents="none"
          transition="opacity 0.2s"
        >
          {swipeDirection === "up" ? (
            <FaChevronUp size={32} color="black" />
          ) : (
            <FaChevronDown size={32} color="black" />
          )}
        </Box>
      )}

      {/* Side Controls - Show/hide based on touch interaction */}
      <VStack
        position="absolute"
        right={4}
        bottom={20}
        spacing={4}
        alignItems="center"
        opacity={showControls ? 1 : 0}
        transition="opacity 0.3s ease"
        pointerEvents={showControls ? "auto" : "none"}
        zIndex={1000} // High z-index to ensure accessibility
      >
        {/* Mute/Unmute */}
        <IconButton
          aria-label="Toggle mute"
          icon={isMuted ? <LuVolumeX /> : <LuVolume2 />}
          bg="rgba(0,0,0,0.6)"
          color="white"
          borderRadius="50%"
          size="lg"
          onClick={(e) => {
            e.stopPropagation();
            toggleMute();
            showControlsTemporarily(); // Extend visibility
          }}
          _hover={{ bg: "rgba(0,0,0,0.8)" }}
        />

        {/* Like Button */}
        <IconButton
          aria-label="Like"
          icon={<FaHeart />}
          bg="rgba(0,0,0,0.6)"
          color="white"
          borderRadius="50%"
          size="lg"
          onClick={(e) => {
            e.stopPropagation();
            showControlsTemporarily(); // Extend visibility
          }}
          _hover={{ bg: "rgba(0,0,0,0.8)" }}
        />

        {/* Comment Button */}
        <IconButton
          aria-label="Comment"
          icon={<FaComment />}
          bg="rgba(0,0,0,0.6)"
          color="white"
          borderRadius="50%"
          size="lg"
          onClick={(e) => {
            e.stopPropagation();
            showControlsTemporarily(); // Extend visibility
          }}
          _hover={{ bg: "rgba(0,0,0,0.8)" }}
        />

        {/* Share Button */}
        <IconButton
          aria-label="Share"
          icon={<FaShare />}
          bg="rgba(0,0,0,0.6)"
          color="white"
          borderRadius="50%"
          size="lg"
          onClick={(e) => {
            e.stopPropagation();
            showControlsTemporarily(); // Extend visibility
          }}
          _hover={{ bg: "rgba(0,0,0,0.8)" }}
        />
      </VStack>

      {/* Navigation Arrows (visible in miniapp context and when controls are shown) */}
      {isInMiniapp && showControls && (
        <>
          <IconButton
            aria-label="Previous video"
            icon={<FaChevronUp />}
            position="absolute"
            top="20%"
            left="50%"
            transform="translateX(-50%)"
            bg="rgba(0,0,0,0.6)"
            color="white"
            borderRadius="50%"
            size="lg"
            onClick={onPrev}
            _hover={{ bg: "rgba(0,0,0,0.8)" }}
            zIndex={1000}
          />
          <IconButton
            aria-label="Next video"
            icon={<FaChevronDown />}
            position="absolute"
            bottom="20%"
            left="50%"
            transform="translateX(-50%)"
            bg="rgba(0,0,0,0.6)"
            color="white"
            borderRadius="50%"
            size="lg"
            onClick={onNext}
            _hover={{ bg: "rgba(0,0,0,0.8)" }}
            zIndex={1000}
          />
        </>
      )}

      {/* User Info - Show/hide with controls */}
      <Box
        position="absolute"
        bottom={6}
        left={4}
        right={20}
        color="white"
        opacity={showControls ? 1 : 0}
        transition="opacity 0.3s ease"
        pointerEvents={showControls ? "auto" : "none"}
        zIndex={999}
      >
        <Text fontWeight="bold" fontSize="lg" mb={1}>
          @{discussion.author}
        </Text>
        <Text fontSize="sm" opacity={0.9} noOfLines={2}>
          {discussion.title ||
            (discussion.body ? discussion.body.slice(0, 100) : "")}
        </Text>
      </Box>
    </Box>
  );
};

const VerticalVideoFeed: React.FC<VerticalVideoFeedProps> = ({
  comments,
  onClose,
  initialVideoSrc = "",
  onLoadMore,
  hasMore = false,
  isLoading: externalLoading = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videoComments, setVideoComments] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentVideoSrc, setCurrentVideoSrc] = useState<string>("");
  const [transitioning, setTransitioning] = useState(false);
  const [nextVideoIndex, setNextVideoIndex] = useState<number | null>(null);

  // Filter comments to only include ones with videos
  useEffect(() => {
    const prevVideoComments = videoComments;
    const filtered = comments.filter((comment) => {
      if (!comment || !comment.body) return false;
      try {
        const mediaItems = parseMediaContent(comment.body);
        return mediaItems.some((item) => item.type === "video" && item.src);
      } catch (error) {
        if (config.enableConsoleLogging) {
          console.warn("Error parsing media content:", error);
        }
        return false;
      }
    });

    // Preserve current video position when content updates
    let newIndex = 0;
    const targetVideoSrc = initialVideoSrc || currentVideoSrc;

    if (targetVideoSrc) {
      const foundIndex = filtered.findIndex((comment) => {
        if (!comment?.body) return false;
        try {
          const mediaItems = parseMediaContent(comment.body);
          return mediaItems.some(
            (item) => item.type === "video" && item.src === targetVideoSrc
          );
        } catch (error) {
          return false;
        }
      });

      if (foundIndex >= 0) {
        newIndex = foundIndex;
      } else if (currentVideoSrc && prevVideoComments.length > 0) {
        // If current video is not found but we had previous comments,
        // it means new content was loaded. Try to maintain position
        const wasAtEnd = currentIndex >= prevVideoComments.length - 1;
        if (wasAtEnd) {
          // If we were at the end, stay at the end
          newIndex = Math.max(0, filtered.length - 1);
        } else {
          // Otherwise, try to maintain relative position
          const relativePosition = currentIndex / prevVideoComments.length;
          newIndex = Math.floor(relativePosition * filtered.length);
          newIndex = Math.max(0, Math.min(newIndex, filtered.length - 1));
        }
      }
    }

    setVideoComments(filtered);
    setCurrentIndex(newIndex);

    // Update current video src if we have a new current video
    if (filtered[newIndex]) {
      try {
        const mediaItems = parseMediaContent(filtered[newIndex].body);
        const videoItem = mediaItems.find((item) => item.type === "video");
        if (videoItem?.src) {
          setCurrentVideoSrc(videoItem.src);
        }
      } catch (error) {
        if (config.enableConsoleLogging) {
          console.warn("Error getting current video src:", error);
        }
      }
    }

    setIsLoading(false);

    // Log for debugging (only in development)
    if (
      prevVideoComments.length !== filtered.length &&
      config.enableConsoleLogging
    ) {
      console.log(
        `Video feed updated: ${prevVideoComments.length} -> ${filtered.length} videos, current index: ${newIndex}`
      );
    }
  }, [comments, initialVideoSrc]);

  // Extract video sources for preloading
  const videoSources = useMemo(() => {
    return videoComments
      .map((comment) => {
        try {
          const mediaItems = parseMediaContent(comment.body);
          const videoItem = mediaItems.find((item) => item.type === "video");
          return videoItem?.src || "";
        } catch (error) {
          return "";
        }
      })
      .filter(Boolean);
  }, [videoComments]);

  // Enhanced video preloader with performance options
  const { isVideoPreloaded, isVideoLoading } = useVideoPreloader(
    videoSources,
    currentIndex,
    {
      enabled: VIDEO_FEED_CONFIG.FEATURES.enableVideoPreloading,
      maxConcurrent: config.maxConcurrentPreloads,
      lookahead: config.lookaheadCount,
      debugMode: config.debugMode,
    }
  );

  const goToNext = useCallback(() => {
    if (transitioning) return; // Prevent multiple transitions

    setCurrentIndex((prev) => {
      if (videoComments.length === 0) return 0;

      const nextIndex = prev + 1;

      // Check if we're near the end and need to load more
      if (nextIndex >= videoComments.length - 2 && hasMore && onLoadMore) {
        onLoadMore();
      }

      // Don't go beyond the last video, just stay there
      const newIndex = Math.min(nextIndex, videoComments.length - 1);

      // Instant transition - no waiting
      setTransitioning(true);
      setNextVideoIndex(newIndex);

      // Quick transition for smooth experience
      setTimeout(() => {
        setTransitioning(false);
        setNextVideoIndex(null);

        // Update current video src
        if (videoComments[newIndex]) {
          try {
            const mediaItems = parseMediaContent(videoComments[newIndex].body);
            const videoItem = mediaItems.find((item) => item.type === "video");
            if (videoItem?.src) {
              setCurrentVideoSrc(videoItem.src);
            }
          } catch (error) {
            if (config.enableConsoleLogging) {
              console.warn("Error updating video src on next:", error);
            }
          }
        }
      }, 200); // Fast 200ms transition

      return newIndex;
    });
  }, [videoComments.length, hasMore, onLoadMore, transitioning]);

  const goToPrev = useCallback(() => {
    if (transitioning) return; // Prevent multiple transitions

    setCurrentIndex((prev) => {
      if (videoComments.length === 0) return 0;
      const newIndex = prev === 0 ? videoComments.length - 1 : prev - 1;

      // Instant transition
      setTransitioning(true);
      setNextVideoIndex(newIndex);

      // Quick transition for smooth experience
      setTimeout(() => {
        setTransitioning(false);
        setNextVideoIndex(null);

        // Update current video src
        if (videoComments[newIndex]) {
          try {
            const mediaItems = parseMediaContent(videoComments[newIndex].body);
            const videoItem = mediaItems.find((item) => item.type === "video");
            if (videoItem?.src) {
              setCurrentVideoSrc(videoItem.src);
            }
          } catch (error) {
            if (config.enableConsoleLogging) {
              console.warn("Error updating video src on prev:", error);
            }
          }
        }
      }, 200); // Fast 200ms transition

      return newIndex;
    });
  }, [videoComments.length, transitioning]);

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      // Stop any ongoing video playback and free memory
      const videos = document.querySelectorAll("video");
      videos.forEach((video) => {
        if (video.src) {
          video.pause();
          video.removeAttribute("src");
          video.load();
        }
      });
    };
  }, []);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (isLoading) {
    return (
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="black"
        display="flex"
        alignItems="center"
        justifyContent="center"
        zIndex={9999}
      >
        <Spinner size="xl" color="white" />
      </Box>
    );
  }

  if (videoComments.length === 0) {
    return (
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="black"
        display="flex"
        alignItems="center"
        justifyContent="center"
        zIndex={9999}
      >
        <VStack spacing={4}>
          <Text color="white" fontSize="lg">
            No videos found
          </Text>
          <Button onClick={onClose} colorScheme="blue">
            Go Back
          </Button>
        </VStack>
      </Box>
    );
  }

  const currentComment = videoComments[currentIndex];

  if (!currentComment || !currentComment.body) {
    return (
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="black"
        display="flex"
        alignItems="center"
        justifyContent="center"
        zIndex={9999}
      >
        <VStack spacing={4}>
          <Text color="white" fontSize="lg">
            Content not available
          </Text>
          <Button onClick={onClose} colorScheme="blue">
            Go Back
          </Button>
        </VStack>
      </Box>
    );
  }

  const mediaItems = parseMediaContent(currentComment.body);
  const videoItem = mediaItems.find((item) => item.type === "video");

  if (!videoItem || !videoItem.src) {
    return null;
  }

  return (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={9999}
      bg="black"
      overflow="hidden"
      style={{
        touchAction: "pan-y",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {/* Close Button */}
      <IconButton
        aria-label="Close"
        icon={<FaTimes />}
        position="absolute"
        top={4}
        left={4}
        bg="rgba(0,0,0,0.6)"
        color="white"
        borderRadius="50%"
        size="lg"
        onClick={onClose}
        zIndex={10000}
        _hover={{ bg: "rgba(0,0,0,0.8)" }}
      />

      {/* Video Counter with Preload Status */}
      <HStack
        position="absolute"
        top={4}
        right={4}
        color="white"
        bg="rgba(0,0,0,0.6)"
        px={3}
        py={1}
        borderRadius="full"
        fontSize="sm"
        zIndex={10000}
        spacing={2}
      >
        <Text>
          {currentIndex + 1} / {videoComments.length}
        </Text>
        {externalLoading && <Spinner size="sm" />}
        {/* Show dots for preloaded videos */}
        <HStack spacing={1}>
          {[1, 2].map((offset) => {
            const nextIndex = currentIndex + offset;
            if (nextIndex >= videoSources.length) return null;

            const nextSrc = videoSources[nextIndex];
            const isPreloaded = isVideoPreloaded(nextSrc);
            const isLoading = isVideoLoading(nextSrc);

            return (
              <Box
                key={offset}
                width="4px"
                height="4px"
                borderRadius="50%"
                bg={
                  isPreloaded
                    ? "green.400"
                    : isLoading
                    ? "yellow.400"
                    : "gray.400"
                }
                opacity={0.8}
              />
            );
          })}
        </HStack>
      </HStack>

      {/* Video Players - Current and Next for Smooth Transitions */}
      <Box position="relative" width="100%" height="100%">
        {/* Current Video */}
        <VideoPlayer
          key={`current-video-${currentIndex}`}
          src={videoItem.src!}
          isActive={true}
          onNext={goToNext}
          onPrev={goToPrev}
          discussion={currentComment}
          isPreloaded={isVideoPreloaded(videoItem.src!)}
          opacity={transitioning ? 0 : 1}
          zIndex={transitioning ? 1 : 2}
        />

        {/* Next Video (for smooth transition) - Always visible when transitioning */}
        {transitioning &&
          nextVideoIndex !== null &&
          videoComments[nextVideoIndex] &&
          (() => {
            const nextComment = videoComments[nextVideoIndex];
            const nextMediaItems = parseMediaContent(nextComment.body);
            const nextVideoItem = nextMediaItems.find(
              (item) => item.type === "video"
            );

            return nextVideoItem?.src ? (
              <VideoPlayer
                key={`next-video-${nextVideoIndex}`}
                src={nextVideoItem.src}
                isActive={true}
                onNext={goToNext}
                onPrev={goToPrev}
                discussion={nextComment}
                isPreloaded={isVideoPreloaded(nextVideoItem.src)}
                opacity={1} // Always visible for instant experience
                zIndex={2}
              />
            ) : null;
          })()}
      </Box>
    </Box>
  );
};

export default VerticalVideoFeed;
