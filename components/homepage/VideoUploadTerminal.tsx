"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, Text, Flex, Button, VStack, HStack, IconButton, useColorModeValue } from "@chakra-ui/react";
import { SERVER_CONFIG, ServerKey } from "@/lib/utils/videoProcessing";

export interface TerminalLine {
  timestamp: Date;
  type: "info" | "success" | "error" | "warning" | "server";
  server?: ServerKey | "pinata";
  message: string;
  status?: "pending" | "trying" | "success" | "failed";
}

export interface VideoUploadTerminalProps {
  lines: TerminalLine[];
  isVisible: boolean;
  onClose?: () => void;
  debugMode?: boolean;
  progress?: number;
  stage?: string;
  autoCloseOnSuccess?: boolean;
  autoCloseDelay?: number;
  errorDetails?: {
    errorType?: string;
    statusCode?: number;
    failedServer?: string;
    rawError?: string;
  };
}

const funLoadingMessages = [
  "🛹 Waxing the digital ledge...",
  "🔥 Teaching pixels to kickflip...",
  "⚡ Summoning the skateboard gods...",
  "🎬 Your video is doing a manual across the internet...",
  "🌀 Converting gnarliness to bytes...",
  "💫 Spinning up the halfpipe servers...",
  "🎯 Landing this upload like a first try tre flip...",
  "🌊 Your clip is riding the data waves...",
  "🏆 Processing 100% pure skateboarding vibes...",
  "🔧 Tightening the truck bolts on your video...",
  "🎪 Your edit is doing a circus kickflip...",
  "🚀 Launching to IPFS at Mach shred...",
  "🧪 Distilling pure stoke into frames...",
  "🎸 Your video is shredding (literally)...",
  "🌈 Adding extra steeze to each pixel...",
  "🎭 Rehearsing the perfect upload...",
  "🦄 A wild skateboard video appears...",
  "🍕 Hold tight, this is better than waiting for pizza...",
  "⏳ Good things come to those who wait (and skate)...",
  "🔮 The upload oracle predicts: success!",
  "🎲 Rolling the dice on a clean upload...",
  "🧙 Casting upload spell... ✨",
  "🎪 The server is doing a circus kickflip with your file...",
];

const preparingMessages = [
  "🔍 Analyzing video dimensions...",
  "📐 Measuring the steeze factor...",
  "🎬 FFmpeg is warming up...",
  "⚙️ Preparing transcoding pipeline...",
  "🔧 Setting up the video grinder...",
  "📦 Unpacking your footage...",
  "🎯 Calculating optimal compression...",
  "🧪 Analyzing video codec...",
];

const skateFrames = ['🛹', '🛹', '🛹', '💨🛹', '🛹', '✨🛹', '🛹', '🔥🛹'];
const prepFrames = ['🛹', '  🛹', '    🛹', '  🛹', '🛹', '🛹💨', '🛹✨', '🛹'];

const SkateboardLoader = ({ serverName, progress = 0, stage }: { serverName?: string; progress?: number; stage?: string }) => {
  const [skateFrame, setSkateFrame] = useState(0);
  const [lastProgress, setLastProgress] = useState(progress);
  const [messageIndex, setMessageIndex] = useState(() => Math.floor(Math.random() * funLoadingMessages.length));
  const [prepMessageIndex, setPrepMessageIndex] = useState(() => Math.floor(Math.random() * preparingMessages.length));
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (progress === 0) {
      setLastProgress(0);
      setSkateFrame(0);
      setMessageIndex(Math.floor(Math.random() * funLoadingMessages.length));
      setPrepMessageIndex(Math.floor(Math.random() * preparingMessages.length));
    }
  }, [progress]);

  useEffect(() => {
    const skateInterval = setInterval(() => {
      setSkateFrame(prev => (prev + 1) % skateFrames.length);
    }, 200);

    const messageInterval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % funLoadingMessages.length);
    }, 3000);

    const prepInterval = setInterval(() => {
      setPrepMessageIndex(prev => (prev + 1) % preparingMessages.length);
    }, 2000);

    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);

    return () => {
      clearInterval(skateInterval);
      clearInterval(messageInterval);
      clearInterval(prepInterval);
      clearInterval(dotsInterval);
    };
  }, []);

  const textColor = "text";
  const mutedColor = "dim";
  const primaryColor = "primary";

  if (progress === 0 || (stage === 'receiving' && progress < 5)) {
    return (
      <Box fontFamily="mono" fontSize="xs" my={1}>
        <Flex alignItems="center" gap={2}>
          <Text color={mutedColor}>[</Text>
          <Text color={primaryColor} fontFamily="mono">
            {prepFrames[skateFrame % prepFrames.length]} ░░░░░░░░░░░░░░░░░░░░░░░░
          </Text>
          <Text color={mutedColor}>]</Text>
          <Text color={primaryColor}>⏳</Text>
        </Flex>
        <Text color={primaryColor} mt={0.5} fontFamily="mono">
          {preparingMessages[prepMessageIndex]}{dots}
        </Text>
      </Box>
    );
  }

  const trackWidth = 24;
  const displayProgress = Math.min(progress, 100);
  const filledWidth = Math.floor((displayProgress / 100) * trackWidth);
  const skatePos = Math.max(0, Math.min(filledWidth, trackWidth - 1));

  const track = Array(trackWidth).fill('─').map((char, i) => {
    if (i === skatePos) return skateFrames[skateFrame];
    if (i < skatePos) return '█';
    return '░';
  }).join('');

  return (
    <Box fontFamily="mono" fontSize="xs" my={1}>
      <Flex alignItems="center" gap={2}>
        <Text color={mutedColor}>[</Text>
        <Text color={primaryColor} fontFamily="mono" letterSpacing="tight">{track}</Text>
        <Text color={mutedColor}>]</Text>
        <Text color="warning" fontWeight="bold">{Math.floor(displayProgress)}%</Text>
      </Flex>
      <Text color={mutedColor} mt={0.5} fontFamily="mono">
        {funLoadingMessages[messageIndex]}
      </Text>
    </Box>
  );
};

const ServerIcon = ({ server, status }: { server: string; status?: string }) => {
  const icons: Record<string, string> = {
    oracle: "🔮",
    macmini: "🍎",
    pi: "🫐",
    pinata: "📌",
  };

  const statusColors: Record<string, string> = {
    pending: "dim",
    trying: "warning",
    success: "success",
    failed: "error",
  };

  return (
    <Text as="span" color={statusColors[status || 'pending'] || "dim"}>
      {icons[server] || "🖥️"}{status === 'success' ? '✓' : status === 'failed' ? '✗' : status === 'trying' ? '⟳' : ''}
    </Text>
  );
};

export const VideoUploadTerminal: React.FC<VideoUploadTerminalProps> = ({
  lines,
  isVisible,
  onClose,
  debugMode = false,
  progress = 0,
  stage,
  autoCloseOnSuccess = true,
  autoCloseDelay = 10,
  errorDetails,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const bgColor = "background";
  const headerBgColor = "muted";
  const borderColor = "border";
  const textColor = "text";
  const dimColor = "dim";

  useEffect(() => {
    if (lines.length === 0) {
      setCountdown(null);
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [lines.length]);

  const isFullyComplete = lines.some(l =>
    l.message.includes("Video ready!") ||
    l.message.includes("🎉") ||
    l.message.includes("IPFS CID:") ||
    l.message.includes("Upload complete") ||
    (l.type === "success" && l.message.includes("✓ IPFS upload successful"))
  );

  // Only show the error state if the upload ultimately failed.
  // Intermediate server failures (e.g. Oracle 404 before Mac Mini succeeds)
  // add error-type lines but the upload still completes — don't treat those as fatal.
  const hasError = !isFullyComplete && lines.some(l => l.type === "error");

  useEffect(() => {
    if (isFullyComplete && !hasError && autoCloseOnSuccess && onClose && countdown === null) {
      setCountdown(autoCloseDelay);
    }
  }, [isFullyComplete, hasError, autoCloseOnSuccess, onClose, autoCloseDelay, countdown]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      countdownRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0 && onClose) {
      onClose();
    }

    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdown, onClose]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  if (!isVisible) return null;

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getLineColor = (type: TerminalLine["type"]) => {
    switch (type) {
      case "success": return "success";
      case "error": return "error";
      case "warning": return "warning";
      case "server": return "primary";
      default: return textColor;
    }
  };

  function getServerStatus(lines: TerminalLine[], server: string): "pending" | "trying" | "success" | "failed" | undefined {
    const serverLines = lines.filter((l) => l.server === server);
    if (serverLines.length === 0) return "pending";
    const lastLine = serverLines[serverLines.length - 1];
    return lastLine.status;
  }

  function isLoading(lines: TerminalLine[]): boolean {
    if (lines.length === 0) return false;
    const hasCompletion = lines.some(l =>
      l.message.includes("Video ready!") ||
      l.message.includes("🎉") ||
      l.message.includes("IPFS CID:") ||
      l.message.includes("✓ Transcoding successful") ||
      l.message.includes("✓ IPFS upload successful") ||
      (l.type === "error" && l.message.includes("failed"))
    );
    if (hasCompletion) return false;
    const allServers = ["pinata", ...SERVER_CONFIG.map(s => s.key)];
    for (const server of allServers) {
      const status = getServerStatus(lines, server);
      if (status === "trying") return true;
    }
    const lastLine = lines[lines.length - 1];
    if (lastLine.type === "info" &&
      (lastLine.message.includes("Uploading") ||
        lastLine.message.includes("Processing") ||
        lastLine.message.includes("Trying") ||
        lastLine.message.includes("Starting"))) {
      return true;
    }
    return false;
  }

  function getCurrentServer(lines: TerminalLine[]): string | undefined {
    const serverNames: Record<string, string> = {
      pinata: "Pinata IPFS",
      ...Object.fromEntries(SERVER_CONFIG.map(s => [s.key, s.name]))
    };
    const allServers = ["pinata", ...SERVER_CONFIG.map(s => s.key)];
    for (const server of allServers) {
      const status = getServerStatus(lines, server);
      if (status === "trying") return serverNames[server];
    }
    return undefined;
  }

  return (
    <Box
      w="100%"
      mt={2}
      bg={bgColor}
      borderRadius="md"
      border="1px solid"
      borderColor={borderColor}
      overflow="hidden"
    >
      <Flex
        alignItems="center"
        justifyContent="space-between"
        px={3}
        py={1.5}
        bg={headerBgColor}
        borderBottom="1px solid"
        borderColor={borderColor}
      >
        <Flex alignItems="center" gap={2}>
          <Flex gap={1}>
            <Box w={2.5} h={2.5} borderRadius="full" bg="red.500" />
            <Box w={2.5} h={2.5} borderRadius="full" bg="yellow.500" />
            <Box w={2.5} h={2.5} borderRadius="full" bg="green.500" />
          </Flex>
          <Text fontSize="xs" color={dimColor} fontFamily="mono">
            upload-terminal
          </Text>
        </Flex>
        {onClose && (
          <IconButton
            aria-label="Close terminal"
            icon={<Text>✕</Text>}
            size="sm"
            variant="ghost"
            color={dimColor}
            _hover={{ color: textColor, bg: "whiteAlpha.100" }}
            onClick={onClose}
          />
        )}
      </Flex>

      <Flex
        px={3}
        py={1.5}
        bg={`${headerBgColor}50`}
        borderBottom="1px solid"
        borderColor={borderColor}
        gap={3}
        fontSize="xs"
        fontFamily="mono"
        flexWrap="wrap"
      >
        <Flex alignItems="center" gap={1}>
          <ServerIcon server="pinata" status={getServerStatus(lines, "pinata")} />
          <Text color={dimColor}>IPFS</Text>
        </Flex>
        {SERVER_CONFIG.map((server) => (
          <Flex key={server.key} alignItems="center" gap={1}>
            <ServerIcon server={server.key} status={getServerStatus(lines, server.key)} />
            <Text color={dimColor}>{server.name.split(' ')[0]}</Text>
          </Flex>
        ))}
      </Flex>

      <Box
        ref={terminalRef}
        p={3}
        maxH="200px"
        overflowY="auto"
        fontFamily="mono"
        fontSize="xs"
        bg="background"
      >
        {lines.map((line, index) => (
          <Box key={index} color={getLineColor(line.type)} mb={0.5}>
            <Text as="span" color={dimColor}>[{formatTime(line.timestamp)}]</Text>{" "}
            {line.server && <ServerIcon server={line.server} status={line.status} />}{" "}
            <Text as="span">{line.message}</Text>
          </Box>
        ))}

        {isLoading(lines) && (
          <Box mt={1} mb={1}>
            <SkateboardLoader serverName={getCurrentServer(lines)} progress={progress} stage={stage} />
          </Box>
        )}

        {countdown !== null && countdown > 0 && (
          <Box mt={2} color={dimColor}>
            <Text as="span" color="success">✨ Auto-closing in </Text>
            <Text as="span" color="warning" fontWeight="bold">{countdown}</Text>
            <Text as="span" color="success"> seconds...</Text>
            <Button
              size="xs"
              ml={2}
              variant="ghost"
              color={dimColor}
              _hover={{ color: textColor, bg: "whiteAlpha.100" }}
              onClick={() => {
                if (countdownRef.current) {
                  clearTimeout(countdownRef.current);
                }
                setCountdown(null);
              }}
            >
              [keep open]
            </Button>
          </Box>
        )}

        <Box as="span" display="inline-block" w={1.5} h={3} bg="primary" className="animate-pulse" />
      </Box>

      {onClose && (
        <Flex
          px={3}
          py={2}
          bg={headerBgColor}
          borderTop="1px solid"
          borderColor={borderColor}
          justifyContent="space-between"
          alignItems="center"
        >
          <Box fontSize="xs" fontFamily="mono">
            {hasError ? (
              <Text color="error">❌ Error occurred - terminal will stay open</Text>
            ) : countdown !== null && countdown > 0 ? (
              <Text color="success">🎉 Success! Closing in {countdown}s</Text>
            ) : countdown === null && isFullyComplete ? (
              <Text color="success">✅ Upload complete</Text>
            ) : null}
          </Box>

          <Flex gap={2}>
            {countdown !== null && (
              <Button
                size="xs"
                bg="blue.600"
                color="white"
                _hover={{ bg: "blue.500" }}
                onClick={() => {
                  if (countdownRef.current) {
                    clearTimeout(countdownRef.current);
                  }
                  setCountdown(null);
                }}
              >
                Keep Open
              </Button>
            )}
            <Button
              size="xs"
              bg={dimColor}
              color={textColor}
              _hover={{ bg: "whiteAlpha.200" }}
              onClick={onClose}
            >
              {hasError ? "Close" : "Dismiss"}
            </Button>
          </Flex>
        </Flex>
      )}
    </Box>
  );
};

export function useUploadTerminal() {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');
  const [errorDetails, setErrorDetails] = useState<VideoUploadTerminalProps["errorDetails"]>();

  const addLine = (
    message: string,
    type: TerminalLine["type"] = "info",
    server?: TerminalLine["server"],
    status?: TerminalLine["status"]
  ) => {
    setLines((prev) => [
      ...prev,
      {
        timestamp: new Date(),
        type,
        server,
        message,
        status,
      },
    ]);
  };

  const clear = () => {
    setLines([]);
    setProgress(0);
    setStage('');
    setErrorDetails(undefined);
  };

  const updateProgress = (p: number, s?: string) => {
    setProgress(p);
    if (s) setStage(s);
  };

  const show = () => {
    setIsVisible(true);
  };

  const hide = () => {
    setIsVisible(false);
  };

  const setError = (details: VideoUploadTerminalProps["errorDetails"]) => {
    setErrorDetails(details);
  };

  return {
    lines,
    isVisible,
    progress,
    stage,
    errorDetails,
    addLine,
    clear,
    show,
    hide,
    setError,
    updateProgress,
  };
}

export default VideoUploadTerminal;
