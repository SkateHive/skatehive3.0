import React, {
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useEffect,
} from "react";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { Box, Input, Button, Text, Select, Modal, ModalOverlay, ModalContent, ModalHeader, ModalCloseButton, ModalBody } from "@chakra-ui/react";
import { useTheme } from "@/app/themeProvider";

interface GIFMakerWithSelectorProps {
  onUpload: (url: string | null, caption?: string) => void;
  isProcessing?: boolean;
  onVideoSelected?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  asModal?: boolean;
  onGifCreated?: (gifBlob: Blob, fileName: string) => Promise<void>;
}

export interface GIFMakerRef {
  trigger: () => void;
  reset: () => void;
}

const GIFMakerWithSelector = forwardRef<GIFMakerRef, GIFMakerWithSelectorProps>(
  ({ onUpload, isProcessing = false, onVideoSelected, isOpen = true, onClose, asModal = false, onGifCreated }, ref) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const ffmpegRef = useRef<any>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [status, setStatus] = useState<string>("");
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoDuration, setVideoDuration] = useState<number>(0);
    const [startTime, setStartTime] = useState<number | null>(null);
    const [endTime, setEndTime] = useState<number | null>(null);
    const [canConvert, setCanConvert] = useState<boolean>(false);
    const [isConverting, setIsConverting] = useState<boolean>(false);
    const [fps, setFps] = useState<number>(10);
    // Ref to track if user is seeking
    const isSeekingRef = useRef(false);

    // THEME
    const { theme } = useTheme();
    const colors = theme.colors;
    const borderRadius = theme.radii?.md || "12px";
    const boxShadow = theme.shadows?.md || "0 2px 12px rgba(0,0,0,0.08)";
    const fontSizeSm = theme.fontSizes?.sm || "14px";
    const fontSizeMd = theme.fontSizes?.md || "16px";
    const fontSizeLg = theme.fontSizes?.lg || "18px";
    const fontWeightMedium = theme.fontWeights?.medium || 500;
    const fontWeightBold = theme.fontWeights?.bold || 700;

    useImperativeHandle(ref, () => ({
      trigger: () => {
        if (inputRef.current && !isProcessing) {
          inputRef.current.value = "";
          inputRef.current.click();
        }
      },
      reset: () => {
        setStatus("");
        setVideoUrl(null);
        setVideoFile(null);
        setVideoDuration(0);
        setStartTime(null);
        setEndTime(null);
        setCanConvert(false);
        setIsConverting(false);
      },
    }));

    useEffect(() => {
      return () => {
        if (videoUrl) {
          URL.revokeObjectURL(videoUrl);
        }
      };
    }, [videoUrl]);

    // Auto-trigger video selection when modal opens
    useEffect(() => {
      if (asModal && isOpen && !videoUrl && inputRef.current) {
        // Small delay to ensure modal is fully rendered
        const timer = setTimeout(() => {
          inputRef.current?.click();
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [asModal, isOpen, videoUrl]);

    const validateDuration = (file: File): Promise<{ valid: boolean; duration: number }> => {
      return new Promise((resolve) => {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.onloadedmetadata = () => {
          window.URL.revokeObjectURL(video.src);
          const duration = video.duration;
          resolve({ valid: duration <= 30, duration });
        };
        video.onerror = () => {
          resolve({ valid: false, duration: 0 });
        };
        video.src = URL.createObjectURL(file);
      });
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        setStatus("");
        setVideoUrl(null);
        setVideoFile(null);
        setVideoDuration(0);
        setStartTime(null);
        setEndTime(null);
        setCanConvert(false);
        onUpload(null);
        return;
      }
      setStatus("Validating video duration...");
      const { valid, duration } = await validateDuration(file);
      if (!valid || duration < 0.1) {
        setStatus("Video must be between 0.1 and 30 seconds long.");
        setVideoUrl(null);
        setVideoFile(null);
        setVideoDuration(0);
        setStartTime(null);
        setEndTime(null);
        setCanConvert(false);
        onUpload(null);
        return;
      }
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setVideoFile(file);
      setVideoDuration(duration);
      setStartTime(null);
      setEndTime(null);
      setCanConvert(false);
      setStatus("");
      // Notify parent that video was selected
      if (onVideoSelected) {
        onVideoSelected();
      }
    };

    const handleSetStart = () => {
      if (videoRef.current) {
        const current = videoRef.current.currentTime;
        setStartTime(current);
        if (endTime !== null) {
          if (current >= endTime) {
            setStatus("Start time must be before end time.");
          } else if (endTime - current > 6) {
            setStatus("Segment cannot be longer than 6 seconds.");
          } else {
            setStatus("");
          }
        } else {
          setStatus("");
        }
      }
    };

    const handleSetEnd = () => {
      if (videoRef.current) {
        const current = videoRef.current.currentTime;
        setEndTime(current);
        if (startTime !== null) {
          if (current <= startTime) {
            setStatus("End time must be after start time.");
          } else if (current - startTime > 6) {
            setStatus("Segment cannot be longer than 6 seconds.");
          } else {
            setStatus("");
          }
        } else {
          setStatus("");
        }
      }
    };

    useEffect(() => {
      if (
        startTime !== null &&
        endTime !== null &&
        endTime > startTime &&
        endTime - startTime <= 6
      ) {
        setCanConvert(true);
      } else {
        setCanConvert(false);
      }
    }, [startTime, endTime]);

    const handleConvert = async () => {
      if (!videoFile || startTime === null || endTime === null) return;
      const duration = Math.max(0.1, endTime - startTime);
      setIsConverting(true);
      setStatus("Preparing to convert...");
      try {
        if (!ffmpegRef.current) {
          setStatus("Loading FFmpeg...");
          ffmpegRef.current = new FFmpeg();
          await ffmpegRef.current.load();
        }
        const ffmpeg = ffmpegRef.current;
        setStatus("Converting to GIF...");
        await ffmpeg.writeFile(videoFile.name, await fetchFile(videoFile));
        const vfCommand = `fps=${fps},scale=320:-1:flags=lanczos`; // Debug log
        
        await ffmpeg.exec([
          "-ss", startTime.toString(),
          "-i", videoFile.name,
          "-t", duration.toString(),
          "-vf", vfCommand,
          "-f", "gif",
          "output.gif",
        ]);
        const data = await ffmpeg.readFile("output.gif");
        const gifBlob = new Blob([data.buffer], { type: "image/gif" });
        
        if (onGifCreated) {
          // Use the new direct upload pipeline
          setStatus("Uploading GIF...");
          const fileName = `skatehive-gif-${Date.now()}.gif`;
          await onGifCreated(gifBlob, fileName);
          setStatus("GIF uploaded successfully!");
        } else {
          // Fallback to old behavior for backward compatibility
          const gifUrl = URL.createObjectURL(gifBlob);
          setStatus("GIF created successfully!");
          onUpload(gifUrl, "skatehive-gif");
        }
      } catch (error) {
        setStatus("Error converting video.");
        console.error("Error during GIF conversion:", error);
        onUpload(null, "skatehive-gif");
      } finally {
        setIsConverting(false);
      }
    };

    // Estimate GIF size in MB for 320px wide GIFs (adjusted for FPS)
    const estimateGifSizeMB = (duration: number) => {
      // More realistic estimation based on actual GIF compression
      // Base size per second at 10 FPS, then adjust for actual FPS
      const baseSizePerSecond = 0.18; // MB per second at 10 FPS (increased from 0.15)
      const fpsMultiplier = fps / 10;
      const estimatedSize = baseSizePerSecond * duration * fpsMultiplier;
      return Math.max(0.1, estimatedSize).toFixed(2); // Minimum 0.1 MB
    };

    // Get color for estimated size using theme colors
    const getEstimateColor = (size: number) => {
      if (size < 1.5) return colors.success || "#38A169";
      if (size < 1.7) return colors.warning || "#FFA500";
      if (size < 2.0) return colors.accent || "#B0C4DE";
      return colors.error || "#FF6B6B";
    };

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;
      if (startTime === null || endTime === null || endTime <= startTime) return;

      const handleSeeking = () => {
        isSeekingRef.current = true;
      };
      const handleSeeked = () => {
        isSeekingRef.current = false;
      };
      const handleTimeUpdate = () => {
        if (isSeekingRef.current) return;
        if (video.currentTime >= endTime) {
          video.currentTime = startTime;
          if (!isSeekingRef.current) {
            video.play();
          }
        }
      };
      video.addEventListener('seeking', handleSeeking);
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('timeupdate', handleTimeUpdate);
      return () => {
        video.removeEventListener('seeking', handleSeeking);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('timeupdate', handleTimeUpdate);
      };
    }, [startTime, endTime]);

    const content = (
      <Box maxW={400} mx="auto" p={6} bg={colors.background} borderRadius={borderRadius} boxShadow={boxShadow} textAlign="center">
        {/* Hidden file input for video selection */}
        <Input
          type="file"
          accept="video/*"
          ref={inputRef}
          display="none"
          onChange={handleFileChange}
          isDisabled={isProcessing}
        />
        
        {/* Show video selection prompt when no video is loaded */}
        {!videoUrl && (
          <Box>
            <Text fontSize={fontSizeLg} fontWeight={fontWeightBold} mb={4} color={colors.primary}>
              Create GIF from Video
            </Text>
            <Button
              onClick={() => inputRef.current?.click()}
              px={6}
              py={3}
              fontSize={fontSizeMd}
              borderRadius={theme.radii?.base || 6}
              bg={colors.primary}
              color={colors.background}
              fontWeight={fontWeightBold}
              _hover={{ bg: colors.accent }}
              _active={{ bg: colors.accent }}
            >
              Choose Video
            </Button>
            <Text mt={3} fontSize={fontSizeSm} color={colors.text}>
              Video must be 30 seconds or less
            </Text>
          </Box>
        )}
        
        {/* After video is selected, show the rest of the UI */}
        {videoUrl && videoFile && (
          <>
            <Box as="video"
              ref={videoRef}
              src={videoUrl}
              controls
              maxW="100%"
              borderRadius={theme.radii?.base || 8}
              mb={4}
              mx="auto"
              display="block"
            />
            <Box display="flex" justifyContent="center" gap={3} my={4}>
              {/* Set Start Button */}
              <Button
                onClick={handleSetStart}
                isDisabled={isConverting}
                px={4}
                py={2}
                fontSize={fontSizeMd}
                borderRadius={theme.radii?.base || 6}
                bg={colors.background}
                color={colors.primary}
                borderWidth="2px"
                borderColor={colors.primary}
                fontWeight={fontWeightBold}
                _hover={{ bg: colors.primary, color: colors.background, borderColor: colors.primary }}
                _active={{ bg: colors.primary, color: colors.background, borderColor: colors.primary }}
                cursor={isConverting ? "not-allowed" : "pointer"}
              >
                Set Start
              </Button>
              {/* Set End Button */}
              <Button
                onClick={handleSetEnd}
                isDisabled={isConverting}
                px={4}
                py={2}
                fontSize={fontSizeMd}
                borderRadius={theme.radii?.base || 6}
                bg={colors.background}
                color={colors.primary}
                borderWidth="2px"
                borderColor={colors.primary}
                fontWeight={fontWeightBold}
                _hover={{ bg: colors.primary, color: colors.background, borderColor: colors.primary }}
                _active={{ bg: colors.primary, color: colors.background, borderColor: colors.primary }}
                cursor={isConverting ? "not-allowed" : "pointer"}
              >
                Set End
              </Button>
            </Box>
            <Text mt={3} fontSize={fontSizeSm} color={colors.text}>
              {startTime !== null && endTime !== null ? (
                <>
                  Segment: {startTime.toFixed(2)}s - {endTime.toFixed(2)}s ({(endTime - startTime).toFixed(2)}s)
                </>
              ) : startTime !== null ? (
                <>Start: {startTime.toFixed(2)}s</>
              ) : endTime !== null ? (
                <>End: {endTime.toFixed(2)}s</>
              ) : (
                <>No segment selected.</>
              )}
            </Text>
            {startTime !== null && endTime !== null && (
              <>
                <Box display="flex" alignItems="center" justifyContent="center" gap={3} mt={3}>
                  <Text fontSize={fontSizeSm} color={colors.text}>
                    FPS:
                  </Text>
                  <Select
                    value={fps}
                    onChange={(e) => setFps(Number(e.target.value))}
                    size="sm"
                    w="80px"
                    bg={colors.background}
                    color={colors.primary}
                    borderColor={colors.primary}
                    borderRadius={theme.radii?.base || 6}
                    _hover={{ borderColor: colors.primary }}
                    _focus={{ borderColor: colors.primary, boxShadow: `0 0 0 1px ${colors.primary}` }}
                  >
                    <option value={5}>5</option>
                    <option value={8}>8</option>
                    <option value={10}>10</option>
                    <option value={12}>12</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                    <option value={24}>24</option>
                  </Select>

                </Box>
                {(() => {
                  const est = parseFloat(estimateGifSizeMB(endTime - startTime));
                  return (
                    <>
                      <Text mt={1} fontSize={fontSizeSm} fontWeight={fontWeightMedium}>
                        Estimated GIF size: <Box as="span" color={getEstimateColor(est)} bg="muted" borderRadius={theme.radii?.base || 6} px={2} py={0.5} ml={2} display="inline-block">{est} MB</Box>
                      </Text>
                      {est > 2 && (
                        <Text mt={1} fontSize={fontSizeSm} color={colors.error || "#FF6B6B"} fontWeight={fontWeightMedium}>
                          TRY TO KEEP THE SIZE UNDER 2MB, DICKHEAD!
                        </Text>
                      )}
                    </>
                  );
                })()}
              </>
            )}
            {/* Convert to GIF Button */}
            <Button
              onClick={handleConvert}
              isDisabled={isConverting || !canConvert}
              px={6}
              py={2.5}
              fontSize={fontSizeLg}
              borderRadius={theme.radii?.base || 6}
              bg={colors.background}
              color={colors.primary}
              borderWidth="2px"
              borderColor={colors.primary}
              fontWeight={fontWeightBold}
              cursor={isConverting || !canConvert ? "not-allowed" : "pointer"}
              mt={2}
              mb={2}
              _hover={{ bg: colors.primary, color: colors.background, borderColor: colors.primary }}
              _active={{ bg: colors.primary, color: colors.background, borderColor: colors.primary }}
            >
              {isConverting ? "Processing..." : (startTime !== null && endTime !== null && parseFloat(estimateGifSizeMB(endTime - startTime)) > 2 ? "Suck it web-gnar!" : "Convert to GIF")}
            </Button>
          </>
        )}
        {/* Status text */}
        {status && (
          <Text mt={2} color={status.startsWith("Error") ? colors.error : colors.text}>{status}</Text>
        )}
      </Box>
    );

    if (asModal) {
      return (
        <Modal isOpen={isOpen} onClose={onClose || (() => {})} size="xl">
          <ModalOverlay />
          <ModalContent bg={colors.background} borderRadius={borderRadius}>
            <ModalHeader color={colors.primary} fontWeight={fontWeightBold}>
              GIF Maker
            </ModalHeader>
            <ModalCloseButton color={colors.primary} />
            <ModalBody pb={6}>
              {content}
            </ModalBody>
          </ModalContent>
        </Modal>
      );
    }

    return content;
  }
);

GIFMakerWithSelector.displayName = "GIFMakerWithSelector";

export default GIFMakerWithSelector; 