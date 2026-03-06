"use client";

import { useEffect, useCallback, useState } from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Text,
} from "@chakra-ui/react";
import { MdArrowBack, MdFullscreen, MdOpenInNew, MdRefresh } from "react-icons/md";
import Link from "next/link";

const GAME_URL = "https://quest-for-stoken.vercel.app/";

export default function QuestForStokenGame() {
  const [gameKey, setGameKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const refreshGame = useCallback(() => {
    setGameKey((prev) => prev + 1);
  }, []);

  const openInNewTab = useCallback(() => {
    if (typeof window === "undefined") return;
    window.open(GAME_URL, "_blank");
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (typeof document === "undefined") return;

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
      return;
    }

    document.exitFullscreen();
    setIsFullscreen(false);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const handleKeyPress = (event: KeyboardEvent) => {
      // Prevent arrow keys and WASD from scrolling the page
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "w",
          "a",
          "s",
          "d",
          "W",
          "A",
          "S",
          "D",
        ].includes(event.key)
      ) {
        event.preventDefault();
      }

      // F key fullscreen
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        toggleFullscreen();
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("keydown", handleKeyPress);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.body.style.overflow = "auto";
      document.removeEventListener("keydown", handleKeyPress);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [toggleFullscreen]);

  return (
    <Box
      minH="100vh"
      h="100vh"
      bg="background"
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      {/* Top bar */}
      <Flex
        bg="muted"
        px={4}
        py={2}
        align="center"
        justify="space-between"
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
        flexShrink={0}
      >
        <Link href="/games">
          <Button
            size="sm"
            variant="ghost"
            color="primary"
            leftIcon={<Icon as={MdArrowBack} />}
            _hover={{ bg: "whiteAlpha.100" }}
          >
            Games
          </Button>
        </Link>

        <Text color="primary" fontWeight="bold" fontSize="sm">
          QUEST FOR STOKEN
        </Text>

        <HStack spacing={1}>
          <IconButton
            aria-label="Refresh"
            icon={<MdRefresh />}
            size="sm"
            variant="ghost"
            color="gray.400"
            _hover={{ color: "primary", bg: "whiteAlpha.100" }}
            onClick={refreshGame}
          />
          <IconButton
            aria-label="Open in new tab"
            icon={<MdOpenInNew />}
            size="sm"
            variant="ghost"
            color="gray.400"
            _hover={{ color: "primary", bg: "whiteAlpha.100" }}
            onClick={openInNewTab}
          />
          <IconButton
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            icon={<MdFullscreen />}
            size="sm"
            variant="ghost"
            color={isFullscreen ? "primary" : "gray.400"}
            _hover={{ color: "primary", bg: "whiteAlpha.100" }}
            onClick={toggleFullscreen}
          />
        </HStack>
      </Flex>

      {/* Game iframe */}
      <Box flex="1" w="100%" overflow="hidden" position="relative">
        <Box
          key={gameKey}
          as="iframe"
          src={GAME_URL}
          w="100%"
          h="100%"
          border="none"
          title="Quest for Stoken - SkateHive Game"
          allow="fullscreen; autoplay; encrypted-media"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
          sx={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        />
      </Box>
    </Box>
  );
}
