import {
  Box,
  Button,
  HStack,
  IconButton,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  RefObject,
} from "react";
import { FiMaximize, FiMinimize, FiVolume2, FiVolumeX } from "react-icons/fi";
import { LuPause, LuPlay, LuRotateCw } from "react-icons/lu";
import { useInView } from "react-intersection-observer";
import LogoMatrix from "../graphics/LogoMatrix";

type RendererProps = {
  src?: string;
  /** Alternate URLs (e.g. fallback IPFS gateways) tried in order on error
   *  before showing the error UI. */
  fallbackSrcs?: string[];
  loop?: boolean;
  skipThumbnailLoad?: boolean;
  disableAutoplay?: boolean;
  [key: string]: any;
};

// Define interface for VideoControls props
interface VideoControlsProps {
  isPlaying: boolean;
  handlePlayPause: () => void;
  volume: number;
  handleVolumeToggle: () => void;
  isFullscreen: boolean;
  handleFullscreenToggle: () => void;
  progress: number;
  handleProgressChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  handleMouseLeave: () => void;
  hoverTime: number | null;
  videoDuration: number | undefined;
  progressSliderStyle: React.CSSProperties;
  videoRef: RefObject<HTMLVideoElement>;
  showProgressBar: boolean;
}

// Memoized LoadingComponent to prevent unnecessary re-renders
const MemoizedLoadingComponent = React.memo(LogoMatrix);
MemoizedLoadingComponent.displayName = "MemoizedLoadingComponent";

// Extract VideoControls to a separate component to prevent unnecessary re-renders
const VideoControls = React.memo(
  ({
    isPlaying,
    handlePlayPause,
    volume,
    handleVolumeToggle,
    isFullscreen,
    handleFullscreenToggle,
    progress,
    handleProgressChange,
    handleMouseMove,
    handleMouseLeave,
    hoverTime,
    videoDuration,
    progressSliderStyle,
    videoRef,
    showProgressBar,
  }: VideoControlsProps) => {
    // Check if video has ended (progress is at or very close to 100%)
    const isVideoEnded = progress >= 99.9;

    return (
      <Box
        position="absolute"
        bottom={4}
        left={0}
        right={0}
        px={4}
        display="flex"
        alignItems="center"
        justifyContent={showProgressBar ? "space-between" : "flex-start"}
        zIndex={3}
      >
        <HStack gap={0}>
          {showProgressBar && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause();
              }}
              size="md"
              p={2}
              variant={"ghost"}
              color={"white"}
              _hover={{ bg: "transparent", color: "limegreen" }}
              zIndex={3}
            >
              {isVideoEnded ? (
                <LuRotateCw />
              ) : isPlaying ? (
                <LuPause />
              ) : (
                <LuPlay />
              )}
            </Button>
          )}
          <Box display="flex" alignItems="center" position="relative">
            <IconButton
              aria-label="Volume"
              onClick={(e) => {
                e.stopPropagation();
                handleVolumeToggle();
              }}
              p={showProgressBar ? 2 : 3} // Larger padding on mobile for better touch target
              variant={"ghost"}
              color={"white"}
              _hover={{ bg: "transparent", color: "limegreen" }}
              size={showProgressBar ? "md" : "lg"} // Larger size on mobile
              zIndex={3}
            >
              {volume === 0 ? <FiVolumeX /> : <FiVolume2 />}
            </IconButton>
          </Box>
          {showProgressBar && (
            <IconButton
              aria-label="Fullscreen"
              onClick={(e) => {
                e.stopPropagation();
                handleFullscreenToggle();
              }}
              p={2}
              variant={"ghost"}
              color={"white"}
              _hover={{ bg: "transparent", color: "limegreen" }}
              size="md"
              zIndex={3}
            >
              {isFullscreen ? <FiMinimize /> : <FiMaximize />}
            </IconButton>
          )}
        </HStack>

        {showProgressBar && (
          <Box position="relative" flex="1" mx={4}>
            <input
              type="range"
              min="0"
              max="100"
              value={Number.isFinite(progress) ? progress : 0}
              onChange={handleProgressChange}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={progressSliderStyle}
            />

            <style jsx>{`
              input[type="range"]::-webkit-slider-runnable-track {
                -webkit-appearance: none;
                height: 8px;
                background: transparent;
              }
              input[type="range"]::-webkit-slider-thumb {
                -webkit-appearance: none;
                height: 24px;
                width: 24px;
                background: url("/images/skateboardloader.webp") no-repeat
                  center;
                background-size: contain;
                border: none;
                border-radius: 0%;
                cursor: pointer;
                margin-top: -16px;
                box-shadow: none;
              }
            `}</style>

            {hoverTime !== null && videoDuration && !isNaN(hoverTime) && isFinite(hoverTime) && (
              <Box
                position="absolute"
                top="-25px"
                left={`${(hoverTime / videoDuration) * 100}%`}
                transform="translateX(-50%)"
                bg="black"
                color="white"
                p={1}
                rounded="md"
                fontSize="xs"
              >
                {new Date(hoverTime * 1000).toISOString().substr(11, 8)}
              </Box>
            )}
          </Box>
        )}
      </Box>
    );
  }
);

VideoControls.displayName = "VideoControls";

// Memoize common styles outside the component
const VIDEO_STYLE = {
  background: "transparent",
  marginBottom: "20px",
  width: "100%",
  zIndex: 2,
};

const BASE_SLIDER_STYLE = {
  WebkitAppearance: "none" as React.CSSProperties["WebkitAppearance"],
  height: "8px",
  borderRadius: "4px",
  outline: "none",
  cursor: "pointer",
};

// If a video hasn't reached readyState >= HAVE_CURRENT_DATA within this window,
// the request is considered stalled and we advance to a fallback gateway.
// Tuned for 4G: long enough for legitimately slow gateways, short enough that
// users on cellular don't stare at a spinner forever.
const LOAD_WATCHDOG_MS = 6000;

// 1-byte Range probe — universally supported across IPFS gateways (HEAD is not).
// Used to race remaining gateways when the active source fails.
async function probeIpfsUrl(url: string, signal: AbortSignal): Promise<string> {
  const res = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-0" },
    signal,
    cache: "no-store",
  });
  if (!res.ok && res.status !== 206) {
    throw new Error(`probe ${url} -> ${res.status}`);
  }
  return url;
}

async function findFastestIpfsUrl(
  urls: string[],
  timeoutMs = 5000
): Promise<string | null> {
  if (urls.length === 0) return null;
  if (urls.length === 1) return urls[0];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.any(urls.map((u) => probeIpfsUrl(u, controller.signal)));
  } catch {
    return null;
  } finally {
    controller.abort();
    clearTimeout(timer);
  }
}

// Chromium-only Network Information API. Returns false on Safari/Firefox where
// the API is absent — those users keep default behavior (no regression).
function isSlowConnection(): boolean {
  if (typeof navigator === "undefined") return false;
  const conn = (navigator as any).connection;
  if (!conn) return false;
  if (conn.saveData === true) return true;
  const et: string | undefined = conn.effectiveType;
  return et === "slow-2g" || et === "2g" || et === "3g";
}

const VideoRenderer = ({ src, fallbackSrcs = [], skipThumbnailLoad, disableAutoplay = false, ...props }: RendererProps) => {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHorizontal, setIsHorizontal] = useState(false);
  const [volume, setVolume] = useState(0); // Always start muted for autoplay
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [shouldLoop, setShouldLoop] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  // URLs we've already given up on (will not retry).
  const visitedRef = useRef<Set<string>>(new Set());
  // URLs we've already done the single in-place retry on.
  const retriedRef = useRef<Set<string>>(new Set());
  const watchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const allUrls = useMemo(
    () => [src, ...fallbackSrcs].filter((u): u is string => !!u),
    [src, fallbackSrcs]
  );

  // Connection-aware autoplay. Chromium reports effectiveType / saveData;
  // Safari/Firefox return false from isSlowConnection() so they're unaffected.
  const [effectiveDisableAutoplay, setEffectiveDisableAutoplay] = useState(disableAutoplay);
  useEffect(() => {
    setEffectiveDisableAutoplay(disableAutoplay || isSlowConnection());
  }, [disableAutoplay]);

  // Reset retry state when the parent passes a different primary src.
  useEffect(() => {
    setCurrentSrc(src);
    visitedRef.current.clear();
    retriedRef.current.clear();
    setHasError(false);
  }, [src]);

  // Hide progress bar on mobile (show only audio controls)
  const showProgressBar = useBreakpointValue({ base: false, md: true }) ?? true;

  // Use Intersection Observer to detect visibility
  const { ref: setVideoRef, inView: isInView } = useInView({ threshold: 0.5 });

  // Combined ref callback to handle both video ref and intersection observer
  const setRefs = useCallback(
    (node: HTMLVideoElement | null) => {
      // Use type assertion to bypass the readonly check since we know what we're doing
      videoRef.current = node;
      setVideoRef(node);
      setVideoRef(node);
    },
    [setVideoRef]
  );

  // Function to handle volume button click (toggle mute/unmute)
  const handleVolumeToggle = useCallback(() => {
    if (volume === 0) {
      // Unmute: set to fixed volume level
      const newVolume = 0.5;
      setVolume(newVolume);
      if (videoRef.current) {
        videoRef.current.volume = newVolume;
        videoRef.current.muted = false;
      }
    } else {
      // Mute
      setVolume(0);
      if (videoRef.current) {
        videoRef.current.muted = true;
      }
    }
  }, [volume]);

  const handleLoadedData = useCallback(() => {
    setIsVideoLoaded(true);
    setHasError(false);
    if (videoRef.current) {
      setIsHorizontal(
        videoRef.current.videoWidth > videoRef.current.videoHeight
      );
      // Ensure video starts muted for autoplay
      videoRef.current.muted = true;
      videoRef.current.volume = 0;
    }
  }, []);

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current) {
      clearTimeout(watchdogRef.current);
      watchdogRef.current = null;
    }
  }, []);

  const handleVideoError = useCallback(async () => {
    clearWatchdog();
    if (!currentSrc) return;

    // First failure on this URL: one in-place retry. Cellular drops a single
    // packet often enough that this alone saves most "failures" without
    // moving to a slower gateway.
    if (!retriedRef.current.has(currentSrc)) {
      retriedRef.current.add(currentSrc);
      videoRef.current?.load();
      return;
    }

    // Retry already used — mark this URL as dead and pick a new one.
    visitedRef.current.add(currentSrc);
    const remaining = allUrls.filter((u) => !visitedRef.current.has(u));

    if (remaining.length === 0) {
      setHasError(true);
      setIsVideoLoaded(false);
      setIsPlaying(false);
      return;
    }

    // Race the remaining gateways in parallel via a 1-byte probe. The first
    // gateway to respond becomes the new source. Falls back to sequential
    // (first in list) if every probe times out.
    setIsVideoLoaded(false);
    setIsPlaying(false);
    const winner = await findFastestIpfsUrl(remaining);
    setCurrentSrc(winner ?? remaining[0]);
  }, [currentSrc, allUrls, clearWatchdog]);

  const startWatchdog = useCallback(() => {
    clearWatchdog();
    watchdogRef.current = setTimeout(() => {
      // readyState < 2 means we don't even have current frame data yet.
      // The request has stalled — treat as an error and advance.
      if (videoRef.current && videoRef.current.readyState < 2 && !hasError) {
        handleVideoError();
      }
    }, LOAD_WATCHDOG_MS);
  }, [clearWatchdog, handleVideoError, hasError]);

  // Cleanup any pending watchdog on unmount.
  useEffect(() => {
    return () => {
      if (watchdogRef.current) clearTimeout(watchdogRef.current);
    };
  }, []);

  // User-triggered retry from the error UI. Resets the gateway-tracking refs
  // so the full fallback chain (primary first) gets a fresh attempt.
  const handleReload = useCallback(() => {
    visitedRef.current.clear();
    retriedRef.current.clear();
    setHasError(false);
    setIsVideoLoaded(false);
    setIsPlaying(false);
    setCurrentSrc(src);
    videoRef.current?.load();
  }, [src]);

  const handlePlayPause = useCallback(() => {
    if (videoRef.current && !hasError) {
      if (progress >= 99.9) {
        // If video has ended, restart it
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {
          // Silent fail if play is blocked
        });
        setIsPlaying(true);
      } else {
        // Normal play/pause toggle
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          videoRef.current.play().catch(() => {
            // Silent fail if play is blocked
          });
          setIsPlaying(true);
        }
      }
    }
  }, [isPlaying, progress, hasError]);

  const handleFullscreenToggle = useCallback(() => {
    if (videoRef.current) {
      const videoElement = videoRef.current;
      if (document.fullscreenElement) {
        document.exitFullscreen
          ? document.exitFullscreen()
          : (document as any).webkitExitFullscreen?.();
      } else {
        videoElement.requestFullscreen
          ? videoElement.requestFullscreen()
          : (videoElement as any).webkitRequestFullscreen?.();
      }
      setIsFullscreen(!isFullscreen);
    }
  }, [isFullscreen]);

  const handleProgressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (videoRef.current) {
        // Make sure the duration is a valid finite number before calculating newTime
        const duration = videoRef.current.duration;
        if (Number.isFinite(duration) && duration > 0) {
          try {
            const newTime = (duration * parseFloat(e.target.value)) / 100;
            if (Number.isFinite(newTime)) {
              videoRef.current.currentTime = newTime;
            }
          } catch (error) {
            console.error("Error setting video time:", error);
          }
        }
        // Still update the progress state even if we couldn't set the currentTime
        setProgress(parseFloat(e.target.value));
      }
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (videoRef.current && !isNaN(videoRef.current.duration) && isFinite(videoRef.current.duration)) {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const newHoverTime = (x / rect.width) * videoRef.current.duration;
        if (!isNaN(newHoverTime) && isFinite(newHoverTime)) {
          setHoverTime(newHoverTime);
        }
      }
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (isInView && videoRef.current && !hasError) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {
        // Silent fail if autoplay is blocked
      });
      setIsPlaying(true);
    }
  }, [isInView, hasError]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handler = () => {
      if (video) {
        const newProgress = (video.currentTime / video.duration) * 100;
        setProgress(newProgress);
      }
    };

    video.addEventListener("timeupdate", handler);
    return () => {
      video.removeEventListener("timeupdate", handler);
    };
  }, []);

  useEffect(() => {
    if (!videoRef.current || hasError) return;

    if (isInView) {
      // preload="none" means metadata isn't fetched until first interaction.
      // Trigger load() explicitly so first-frame + duration are ready when
      // the user scrolls past, even if autoplay is suppressed.
      if (videoRef.current.readyState === 0) {
        videoRef.current.load();
      }
      if (!effectiveDisableAutoplay) {
        videoRef.current.play().catch(() => {
          // Silent fail if autoplay is blocked
        });
        setIsPlaying(true);
        setShouldLoop(true);
      }
    } else if (!effectiveDisableAutoplay) {
      videoRef.current.pause();
      setIsPlaying(false);
      setShouldLoop(false);
    }
  }, [isInView, hasError, effectiveDisableAutoplay]);

  // Memoize slider background to prevent re-computation on every render
  const sliderBackground = useMemo(
    () => `
        linear-gradient(
            to right,
            rgb(50,205,50) 0%,
            rgb(50,205,50) ${progress}%,
            #ccc ${progress}%,
            #ccc 100%
  )
  `,
    [progress]
  );

  const progressSliderStyle = useMemo(
    () => ({
      ...BASE_SLIDER_STYLE,
      width: "100%",
      background: sliderBackground,
      zIndex: 3,
    }),
    [sliderBackground]
  );

  return (
    <Box
      position="relative"
      display="flex"
      justifyContent="center"
      alignItems="center"
      paddingTop="10px"
      minWidth="100%"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <picture style={{ position: "relative", width: "100%", height: "100%" }}>
        <video
          {...props}
          ref={setRefs}
          src={currentSrc}
          muted={true} // Always start muted for autoplay
          controls={false}
          playsInline={true}
          autoPlay={!effectiveDisableAutoplay}
          loop={!effectiveDisableAutoplay && shouldLoop}
          // preload="none" prevents the parallel-request storm on feed pages.
          // The inView effect calls .load() when the video scrolls into view.
          preload="none"
          onLoadStart={startWatchdog}
          onLoadedMetadata={clearWatchdog}
          onProgress={clearWatchdog}
          onCanPlay={clearWatchdog}
          onLoadedData={handleLoadedData}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          onClick={(e) => e.stopPropagation()}
          style={VIDEO_STYLE}
        />
        {!isVideoLoaded && !hasError && (
          <Box
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height="100%"
            zIndex={3}
            display="flex"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
          >
            <MemoizedLoadingComponent />
          </Box>
        )}
        {hasError && (
          <Box
            // Marks this subtree as "not prose" — when the player is
            // rendered inside a post body, this prevents the parent
            // .post-prose CSS (drop caps, paragraph sizing, prose font)
            // from leaking into the error message.
            data-not-prose="true"
            position="absolute"
            top={0}
            left={0}
            width="100%"
            height="100%"
            zIndex={3}
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            gap={3}
            bg="gray.800"
            borderRadius="none"
            px={4}
          >
            <Text color="gray.400" fontSize="sm" textAlign="center">
              Video failed to load
              <br />
              <Text as="span" fontSize="xs" color="gray.500">
                Please check your connection and try again
              </Text>
            </Text>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleReload();
              }}
              size="sm"
              variant="outline"
              color="limegreen"
              borderColor="limegreen"
              _hover={{ bg: "limegreen", color: "black" }}
              aria-label="Retry video"
            >
              <Box as={LuRotateCw} mr={2} display="inline-block" />
              Retry
            </Button>
          </Box>
        )}
      </picture>
      {isHovered && (
        <VideoControls
          isPlaying={isPlaying}
          handlePlayPause={handlePlayPause}
          volume={volume}
          handleVolumeToggle={handleVolumeToggle}
          isFullscreen={isFullscreen}
          handleFullscreenToggle={handleFullscreenToggle}
          progress={progress}
          handleProgressChange={handleProgressChange}
          handleMouseMove={handleMouseMove}
          handleMouseLeave={handleMouseLeave}
          hoverTime={hoverTime}
          videoDuration={videoRef.current?.duration}
          progressSliderStyle={progressSliderStyle}
          videoRef={videoRef as React.RefObject<HTMLVideoElement>}
          showProgressBar={showProgressBar}
        />
      )}
    </Box>
  );
};

// Export with React.memo to prevent unnecessary re-renders
const MemoizedVideoRenderer = React.memo(VideoRenderer);
MemoizedVideoRenderer.displayName = "VideoRenderer";
export default MemoizedVideoRenderer;
