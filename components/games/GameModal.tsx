"use client";

import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  Box,
  IconButton,
  HStack,
  Tooltip,
} from "@chakra-ui/react";
import { FiMaximize2, FiRefreshCw, FiExternalLink } from "react-icons/fi";

interface GameModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameSlug: "quest-for-stoken" | "lougnar";
  gameTitle: string;
}

const GAME_URLS = {
  "quest-for-stoken": "https://quest-for-stoken.vercel.app/",
  lougnar: "https://quest-for-stoken.vercel.app/lougnar",
};

export default function GameModal({
  isOpen,
  onClose,
  gameSlug,
  gameTitle,
}: GameModalProps) {
  const [iframeKey, setIframeKey] = React.useState(0);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const gameUrl = GAME_URLS[gameSlug];

  const handleRefresh = () => {
    setIframeKey((prev) => prev + 1);
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(gameUrl, "_blank", "noopener,noreferrer");
  };

  React.useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full" isCentered>
      <ModalOverlay bg="blackAlpha.900" backdropFilter="blur(8px)" />
      <ModalContent
        bg="transparent"
        maxW="95vw"
        maxH="95vh"
        m={4}
        boxShadow="none"
      >
        <ModalCloseButton
          top={2}
          right={2}
          color="white"
          bg="blackAlpha.700"
          _hover={{ bg: "blackAlpha.800" }}
          size="lg"
          zIndex={10}
        />

        {/* Top bar with controls */}
        <HStack
          position="absolute"
          top={2}
          left={2}
          spacing={2}
          zIndex={10}
        >
          <Tooltip label="Refresh">
            <IconButton
              aria-label="Refresh game"
              icon={<FiRefreshCw />}
              onClick={handleRefresh}
              size="sm"
              bg="blackAlpha.700"
              color="white"
              _hover={{ bg: "blackAlpha.800" }}
            />
          </Tooltip>
          <Tooltip label="Fullscreen">
            <IconButton
              aria-label="Toggle fullscreen"
              icon={<FiMaximize2 />}
              onClick={handleFullscreen}
              size="sm"
              bg="blackAlpha.700"
              color="white"
              _hover={{ bg: "blackAlpha.800" }}
            />
          </Tooltip>
          <Tooltip label="Open in new tab">
            <IconButton
              aria-label="Open in new tab"
              icon={<FiExternalLink />}
              onClick={handleOpenInNewTab}
              size="sm"
              bg="blackAlpha.700"
              color="white"
              _hover={{ bg: "blackAlpha.800" }}
            />
          </Tooltip>
        </HStack>

        {/* Game iframe container */}
        <Box
          ref={containerRef}
          position="relative"
          w="100%"
          h="100%"
          bg="black"
          borderRadius="xl"
          overflow="hidden"
          border="2px solid"
          borderColor="primary"
          boxShadow="0 0 60px rgba(167, 255, 0, 0.3)"
        >
          <iframe
            key={iframeKey}
            src={gameUrl}
            title={gameTitle}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </Box>
      </ModalContent>
    </Modal>
  );
}
