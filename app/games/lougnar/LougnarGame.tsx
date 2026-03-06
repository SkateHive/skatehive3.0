"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  HStack,
  Icon,
  Text,
  Flex,
} from "@chakra-ui/react";
import { MdFullscreen, MdRefresh, MdArrowBack } from "react-icons/md";
import Link from "next/link";

export default function LougnarGame() {
  const [gameKey, setGameKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const refreshGame = useCallback(() => {
    setGameKey((prev) => prev + 1);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const handleKeyPress = (event: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(event.key)
      ) {
        event.preventDefault();
      }
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
          LOUGNAR
        </Text>
        <HStack spacing={2}>
          <Button
            size="sm"
            variant="ghost"
            color="gray.400"
            onClick={refreshGame}
            _hover={{ color: "primary", bg: "whiteAlpha.100" }}
          >
            <Icon as={MdRefresh} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="gray.400"
            onClick={toggleFullscreen}
            _hover={{ color: "primary", bg: "whiteAlpha.100" }}
          >
            <Icon as={MdFullscreen} />
          </Button>
        </HStack>
      </Flex>

      {/* Game iframe */}
      <Box flex="1" w="100%" overflow="hidden">
        <Box
          key={gameKey}
          as="iframe"
          src="https://quest-for-stoken.vercel.app/lougnar"
          w="100%"
          h="100%"
          border="none"
          title="Lougnar - SkateHive Game"
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
