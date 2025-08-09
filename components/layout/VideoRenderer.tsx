import { Box, Button, HStack, IconButton, useBreakpointValue } from "@chakra-ui/react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  RefObject,
  Dispatch,
  SetStateAction,
} from "react";
import { FiMaximize, FiMinimize, FiVolume2, FiVolumeX } from "react-icons/fi";
import { LuPause, LuPlay, LuRotateCw } from "react-icons/lu";
import LoadingComponent from "../homepage/loadingComponent";
import { getVideoThumbnail, extractIPFSHash } from "@/lib/utils/ipfsMetadata";

// Add useInView hook for detecting visibility
interface IntersectionOptions {
  threshold?: number;
  rootMargin?: string;
  root?: Element | null;
}

function useInView(options: IntersectionOptions = {}) {
  const [ref, setRef] = useState<Element | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsInView(entry.isIntersecting);
    }, options);

    observer.observe(ref);

    return () => {
      observer.disconnect();
    };
  }, [ref, options]);

  return { ref: setRef, isInView };
}

type RendererProps = {
  src?: string;
  loop?: boolean;
  skipThumbnailLoad?: boolean; // New prop to skip thumbnail loading
  onMobileFullscreen?: (videoSrc: string) => void; // Callback for mobile fullscreen
  [key: string]: any;
};

// Define interface for VideoControls props
interface VideoControlsProps {
  isPlaying: boolean;
  handlePlayPause: () => void;
  volume: number;
  setVolume: Dispatch<SetStateAction<number>>;
  showVolumeSlider: boolean;
  setShowVolumeSlider: Dispatch<SetStateAction<boolean>>;
  isFullscreen: boolean;
  handleFullscreenToggle: () => void;
  progress: number;
  handleProgressChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleMouseMove: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  handleMouseLeave: () => void;
  hoverTime: number | null;
  videoDuration: number | undefined;
  progressSliderStyle: React.CSSProperties;
  volumeSliderStyle: React.CSSProperties;
  videoRef: RefObject<HTMLVideoElement>;
  onMobileFullscreen?: (videoSrc: string) => void;
  videoSrc?: string;
}

// Memoized LoadingComponent to prevent unnecessary re-renders
const MemoizedLoadingComponent = React.memo(LoadingComponent);

// Extract VideoControls to a separate component to prevent unnecessary re-renders
const VideoControls = React.memo(
  ({
    isPlaying,
    handlePlayPause,
    volume,
    setVolume,
    showVolumeSlider,
    setShowVolumeSlider,
    isFullscreen,
    handleFullscreenToggle,
    progress,
    handleProgressChange,
    handleMouseMove,
    handleMouseLeave,
    hoverTime,
    videoDuration,
    progressSliderStyle,
    volumeSliderStyle,
    videoRef,
    onMobileFullscreen,
    videoSrc,
  }: VideoControlsProps) => {
    // Check if video has ended (progress is at or very close to 100%)
    const isVideoEnded = progress >= 99.9;
    const isMobile = useBreakpointValue({ base: true, md: false });

    const handleFullscreenClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      
      // If mobile and we have mobile fullscreen callback, use that instead
      if (isMobile && onMobileFullscreen && videoSrc) {
        onMobileFullscreen(videoSrc);
      } else {
        handleFullscreenToggle();
      }
    };

    return (
      <Box
        position="absolute"
        bottom={4}
        left={0}
        right={0}
        px={4}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        zIndex={3}
      >
        <HStack gap={0}>
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
          <Box display="flex" alignItems="center" position="relative">
            <IconButton
              aria-label="Volume"
              onClick={(e) => {
                e.stopPropagation();
                setShowVolumeSlider((prev: boolean) => !prev);
              }}
              p={2}
              variant={"ghost"}
              color={"white"}
              _hover={{ bg: "transparent", color: "limegreen" }}
              size="md"
              zIndex={3}
            >
              {volume === 0 ? <FiVolumeX /> : <FiVolume2 />}
            </IconButton>
            {showVolumeSlider && (
              <Box
                position="absolute"
                bottom="100%"
                left="50%"
                transform="translate(-50%, -8px)"
                zIndex={4}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    setVolume(newVolume);
                    if (videoRef.current) {
                      videoRef.current.volume = newVolume;
                      videoRef.current.muted = newVolume === 0;
                    }
                  }}
                  style={volumeSliderStyle}
                />
              </Box>
            )}
          </Box>
          <IconButton
            aria-label="Fullscreen"
            onClick={handleFullscreenClick}
            p={2}
            variant={"ghost"}
            color={"white"}
            _hover={{ bg: "transparent", color: "limegreen" }}
            size="md"
            zIndex={3}
          >
            {isFullscreen ? <FiMinimize /> : <FiMaximize />}
          </IconButton>
        </HStack>

        <Box position="relative" flex="1" mx={4}>
          <input
            type="range"
            min="0"
            max="100"
            value={progress}
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
              background: url("/images/skateboardloader.webp") no-repeat center;
              background-size: contain;
              border: none;
              border-radius: 0%;
              cursor: pointer;
              margin-top: -16px;
              box-shadow: none;
            }
          `}</style>

          {hoverTime !== null &&
            videoDuration &&
            Number.isFinite(videoDuration) && (
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
                {Number.isFinite(hoverTime)
                  ? new Date(hoverTime * 1000).toISOString().substr(11, 8)
                  : "00:00:00"}
              </Box>
            )}
        </Box>
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

const VideoRenderer = ({
  src,
  skipThumbnailLoad = false,
  onMobileFullscreen,
  ...props
}: RendererProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isHorizontal, setIsHorizontal] = useState(false);
  const [volume, setVolume] = useState(0);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [shouldLoop, setShouldLoop] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [showPoster, setShowPoster] = useState(true);

  // Use Intersection Observer to detect visibility
  const { ref: setVideoRef, isInView } = useInView({ threshold: 0.5 });

  // Extract IPFS hash from video src and fetch thumbnail - only if not skipped
  useEffect(() => {
    // Skip thumbnail loading if explicitly disabled (e.g., for modal video playback)
    if (skipThumbnailLoad) return;

    const loadThumbnail = async () => {
      if (src) {
        try {
          const hash = extractIPFSHash(src);
          if (hash) {
            const thumbnail = await getVideoThumbnail(hash);
            if (thumbnail) {
              setThumbnailUrl(thumbnail);
            }
          }
        } catch (error) {
          console.error("❌ Failed to load thumbnail:", error);
        }
      }
    };

    loadThumbnail();
  }, [src, skipThumbnailLoad]);

  const handleLoadedData = useCallback(() => {
    setIsVideoLoaded(true);
    if (videoRef.current) {
      setIsHorizontal(
        videoRef.current.videoWidth > videoRef.current.videoHeight
      );
    }
  }, []);

  const handlePlayPause = useCallback(async () => {
    if (videoRef.current) {
      if (progress >= 99.9) {
        // If video has ended, restart it
        videoRef.current.currentTime = 0;
        try {
          await videoRef.current.play();
          setIsPlaying(true);
          setShowPoster(false); // Hide poster when playing
        } catch (err) {
          // Optionally log: console.debug("Video play error:", err);
        }
      } else {
        if (isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
        } else {
          try {
            await videoRef.current.play();
            setIsPlaying(true);
            setShowPoster(false); // Hide poster when playing
          } catch (err) {
            // Optionally log: console.debug("Video play error:", err);
          }
        }
      }
    }
  }, [isPlaying, progress]);

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
        const duration = videoRef.current.duration;
        if (Number.isFinite(duration) && duration > 0) {
          try {
            const newValue = parseFloat(e.target.value);
            if (Number.isFinite(newValue)) {
              const newTime = (duration * newValue) / 100;
              if (Number.isFinite(newTime)) {
                videoRef.current.currentTime = newTime;
              }
              setProgress(newValue);
            } else {
              setProgress(0);
            }
          } catch (error) {
            console.error("Error setting video time:", error);
            setProgress(0);
          }
        } else {
          // If duration is invalid, just update the UI without changing video time
          const newValue = parseFloat(e.target.value);
          setProgress(Number.isFinite(newValue) ? newValue : 0);
        }
      }
    },
    []
  );

  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      // Add validation to prevent NaN
      if (Number.isFinite(duration) && duration > 0) {
        const newProgress = (videoRef.current.currentTime / duration) * 100;
        setProgress(Number.isFinite(newProgress) ? newProgress : 0);
      } else {
        setProgress(0);
      }
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (videoRef.current) {
        const duration = videoRef.current.duration;
        if (Number.isFinite(duration) && duration > 0) {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const newHoverTime = (x / rect.width) * duration;
          setHoverTime(Number.isFinite(newHoverTime) ? newHoverTime : null);
        } else {
          setHoverTime(null);
        }
      }
    },
    []
  );

  const handleMouseLeave = useCallback(() => {
    setHoverTime(null);
  }, []);

  const handleVideoEnded = useCallback(() => {
    if (isInView && videoRef.current) {
      videoRef.current.currentTime = 0;
      setShowPoster(true); // Show poster again when video ends
      videoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setShowPoster(false); // Hide poster when restarting
        })
        .catch((err) => {
          // Optionally log: console.debug("Video play error:", err);
        });
    } else {
      setShowPoster(true); // Show poster when video ends and not in view
    }
  }, [isInView]);

  useEffect(() => {
    const currentVideo = videoRef.current;
    if (currentVideo) {
      currentVideo.addEventListener("timeupdate", handleTimeUpdate);
      return () => {
        currentVideo.removeEventListener("timeupdate", handleTimeUpdate);
      };
    }
  }, [handleTimeUpdate]);

  useEffect(() => {
    const currentVideo = videoRef.current;
    if (currentVideo) {
      if (isInView) {
        if (currentVideo.paused) {
          currentVideo
            .play()
            .then(() => {
              setIsPlaying(true);
              setShowPoster(false); // Hide poster when autoplaying
              setShouldLoop(true);
            })
            .catch((err) => {
              // Suppress play() errors (e.g., user gesture required)
              // Optionally log: console.debug("Video play error:", err);
            });
        } else {
          setIsPlaying(true);
          setShowPoster(false); // Hide poster when already playing
          setShouldLoop(true);
        }
      } else {
        if (!currentVideo.paused) {
          currentVideo.pause();
        }
        setIsPlaying(false);
        setShouldLoop(false);
      }
    }
  }, [isInView]);

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

  const volumeSliderStyle = useMemo(
    () => ({
      ...BASE_SLIDER_STYLE,
      writingMode: "vertical-lr" as React.CSSProperties["writingMode"],
      WebkitAppearance:
        "slider-vertical" as React.CSSProperties["WebkitAppearance"],
      height: "80px",
      transform: "rotate(180deg)",
    }),
    []
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
      <Box width="100%" aspectRatio="16/9" position="relative">
        <picture
          style={{ position: "relative", width: "100%", height: "100%" }}
          ref={setVideoRef}
        >
          <video
            {...props}
            ref={videoRef}
            src={src}
            muted={volume === 0}
            controls={false}
            playsInline={true}
            autoPlay={false}
            loop={shouldLoop}
            preload="metadata"
            onLoadedData={handleLoadedData}
            onEnded={handleVideoEnded}
            onClick={(e) => e.stopPropagation()}
            style={VIDEO_STYLE}
          />

          {/* Thumbnail Poster Overlay */}
          {showPoster && thumbnailUrl && (
            <Box
              position="absolute"
              top={0}
              left={0}
              width="100%"
              height="100%"
              backgroundImage={`url(${thumbnailUrl})`}
              backgroundSize="cover"
              backgroundPosition="center"
              backgroundRepeat="no-repeat"
              zIndex={2}
              cursor="pointer"
              onClick={handlePlayPause}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              {/* Play button overlay */}
              <Box
                bg="rgba(0,0,0,0.6)"
                borderRadius="50%"
                p={4}
                _hover={{ bg: "rgba(0,0,0,0.8)" }}
                transition="background 0.2s"
              >
                <LuPlay size={32} color="white" />
              </Box>
            </Box>
          )}

          {!isVideoLoaded && !thumbnailUrl && (
            <Box
              position="absolute"
              top={0}
              left={0}
              width="100%"
              height="100%"
              bg="black"
              zIndex={3}
              display="flex"
              alignItems="center"
              justifyContent="center"
              overflow="hidden"
            >
              <MemoizedLoadingComponent />
            </Box>
          )}
        </picture>
      </Box>
      {isHovered && (
        <VideoControls
          isPlaying={isPlaying}
          handlePlayPause={handlePlayPause}
          volume={volume}
          setVolume={setVolume}
          showVolumeSlider={showVolumeSlider}
          setShowVolumeSlider={setShowVolumeSlider}
          isFullscreen={isFullscreen}
          handleFullscreenToggle={handleFullscreenToggle}
          progress={progress}
          handleProgressChange={handleProgressChange}
          handleMouseMove={handleMouseMove}
          handleMouseLeave={handleMouseLeave}
          hoverTime={hoverTime}
          videoDuration={videoRef.current?.duration}
          progressSliderStyle={progressSliderStyle}
          volumeSliderStyle={volumeSliderStyle}
          videoRef={videoRef as React.RefObject<HTMLVideoElement>}
          onMobileFullscreen={onMobileFullscreen}
          videoSrc={src}
        />
      )}
    </Box>
  );
};

// Export with React.memo to prevent unnecessary re-renders
export default React.memo(VideoRenderer);
