"use client";

import React from "react";
import { Box, Text } from "@chakra-ui/react";

interface QuestForStokenOverlayProps {
  children: React.ReactNode;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

type ControlKey = {
  label: string;
  key: string;
  code: string;
  hint?: string;
  variant?: "primary" | "default";
};

/**
 * Quest for Stoken overlay: arcade / CRT vibe.
 * Now self-hosted (same-origin), so we CAN send keystrokes programmatically!
 *
 * Controls (from Vlad screenshot):
 * - Move: W A S D
 * - Jump: SPACE
 * - Attack/Action/Dash: J K L
 * - Block: O
 */
export default function QuestForStokenOverlay({
  children,
  iframeRef,
}: QuestForStokenOverlayProps) {
  const sendKey = (k: ControlKey, action: "down" | "up" = "down") => {
    if (!iframeRef?.current?.contentWindow) return;

    const event = new KeyboardEvent(action === "down" ? "keydown" : "keyup", {
      key: k.key,
      code: k.code,
      bubbles: true,
      cancelable: true,
    });

    iframeRef.current.contentWindow.document.dispatchEvent(event);
  };

  const tap = (k: ControlKey) => {
    sendKey(k, "down");
    setTimeout(() => sendKey(k, "up"), 90);
  };

  const ACTION_KEYS: ControlKey[] = [
    { label: "O", key: "o", code: "KeyO", hint: "Block" },
    { label: "J", key: "j", code: "KeyJ", hint: "Attack", variant: "primary" },
    { label: "K", key: "k", code: "KeyK", hint: "Action" },
    { label: "L", key: "l", code: "KeyL", hint: "Dash" },
  ];

  const MOVE_KEYS: ControlKey[] = [
    { label: "W", key: "w", code: "KeyW" },
    { label: "A", key: "a", code: "KeyA" },
    { label: "S", key: "s", code: "KeyS" },
    { label: "D", key: "d", code: "KeyD" },
  ];

  const SPACE_KEY: ControlKey = {
    label: "SPACE",
    key: " ",
    code: "Space",
    hint: "Jump",
    variant: "primary",
  };

  return (
    <Box
      position="relative"
      w="100%"
      maxW="1400px"
      mx="auto"
      aspectRatio="16/9"
      borderRadius="2xl"
      bg="linear-gradient(135deg, rgba(0,0,0,0.96) 0%, rgba(18,18,18,0.96) 100%)"
      boxShadow="0 22px 80px rgba(0,0,0,0.78)"
      overflow="hidden"
      border="1px solid rgba(167,255,0,0.18)"
    >
      {/* CRT glow */}
      <Box
        position="absolute"
        inset={0}
        pointerEvents="none"
        bg="radial-gradient(circle at 50% 50%, rgba(167,255,0,0.12), transparent 55%)"
      />

      {/* Screen bezel */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w={{ base: "96%", md: "90%" }}
        h={{ base: "82%", md: "88%" }}
        borderRadius="xl"
        bg="#050505"
        border="2px solid rgba(167,255,0,0.22)"
        boxShadow="inset 0 0 0 6px rgba(0,0,0,0.62), 0 0 40px rgba(0,0,0,0.72)"
        overflow="hidden"
      >
        {/* Scanlines */}
        <Box
          position="absolute"
          inset={0}
          pointerEvents="none"
          opacity={0.12}
          bg="repeating-linear-gradient(0deg, rgba(255,255,255,0.12), rgba(255,255,255,0.12) 1px, transparent 1px, transparent 3px)"
          mixBlendMode="overlay"
        />

        {/* Game */}
        <Box position="relative" w="100%" h="100%" bg="#000">
          {children}
        </Box>
      </Box>

      {/* Controls (bottom) - now functional! */}
      <Box
        position="absolute"
        bottom={{ base: 3, md: 4 }}
        left="50%"
        transform="translateX(-50%)"
        w={{ base: "94%", md: "86%" }}
        display="flex"
        justifyContent="space-between"
        alignItems="flex-end"
        gap={{ base: 3, md: 6 }}
      >
        {/* Movement: WASD cross */}
        <Box display="flex" gap={3} alignItems="flex-end">
          <Box
            display="grid"
            gridTemplateColumns="repeat(3, 44px)"
            gridTemplateRows="repeat(2, 44px)"
            gap={2}
            p={3}
            borderRadius="xl"
            bg="rgba(0,0,0,0.72)"
            border="1px solid rgba(167,255,0,0.18)"
            backdropFilter="blur(10px)"
            boxShadow="0 10px 30px rgba(0,0,0,0.55)"
          >
            <Box />
            <Box
              as="button"
              onClick={() => tap(MOVE_KEYS[0])}
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="md"
              bg="rgba(255,255,255,0.10)"
              color="white"
              fontWeight="800"
              letterSpacing="0.06em"
              cursor="pointer"
              transition="all 0.1s"
              _active={{ bg: "rgba(255,255,255,0.20)", transform: "scale(0.95)" }}
            >
              W
            </Box>
            <Box />
            <Box
              as="button"
              onClick={() => tap(MOVE_KEYS[1])}
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="md"
              bg="rgba(255,255,255,0.10)"
              color="white"
              fontWeight="800"
              letterSpacing="0.06em"
              cursor="pointer"
              transition="all 0.1s"
              _active={{ bg: "rgba(255,255,255,0.20)", transform: "scale(0.95)" }}
            >
              A
            </Box>
            <Box
              as="button"
              onClick={() => tap(MOVE_KEYS[2])}
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="md"
              bg="rgba(255,255,255,0.10)"
              color="white"
              fontWeight="800"
              letterSpacing="0.06em"
              cursor="pointer"
              transition="all 0.1s"
              _active={{ bg: "rgba(255,255,255,0.20)", transform: "scale(0.95)" }}
            >
              S
            </Box>
            <Box
              as="button"
              onClick={() => tap(MOVE_KEYS[3])}
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="md"
              bg="rgba(255,255,255,0.10)"
              color="white"
              fontWeight="800"
              letterSpacing="0.06em"
              cursor="pointer"
              transition="all 0.1s"
              _active={{ bg: "rgba(255,255,255,0.20)", transform: "scale(0.95)" }}
            >
              D
            </Box>
          </Box>

          {/* Space under-left of the cross */}
          <Box
            as="button"
            onClick={() => tap(SPACE_KEY)}
            px={{ base: 4, md: 5 }}
            py={{ base: 3, md: 3 }}
            minW={{ base: "110px", md: "130px" }}
            borderRadius="xl"
            bg="rgba(0,0,0,0.72)"
            border="1px solid rgba(167,255,0,0.18)"
            backdropFilter="blur(10px)"
            boxShadow="0 10px 30px rgba(0,0,0,0.55)"
            cursor="pointer"
            transition="all 0.1s"
            _active={{ bg: "rgba(0,0,0,0.85)", transform: "scale(0.98)" }}
          >
            <Text
              fontWeight="900"
              letterSpacing="0.10em"
              color="primary"
              textAlign="center"
            >
              SPACE
            </Text>
            <Text fontSize="xs" color="gray.300" textAlign="center">
              Jump
            </Text>
          </Box>
        </Box>

        {/* Actions: O J K L */}
        <Box
          p={3}
          borderRadius="xl"
          bg="rgba(0,0,0,0.72)"
          border="1px solid rgba(167,255,0,0.18)"
          backdropFilter="blur(10px)"
          boxShadow="0 10px 30px rgba(0,0,0,0.55)"
          display="grid"
          gridTemplateColumns={{ base: "repeat(2, 56px)", md: "repeat(4, 64px)" }}
          gap={2}
          alignItems="center"
          justifyItems="center"
        >
          {ACTION_KEYS.map((k) => (
            <Box key={k.label} textAlign="center">
              <Box
                as="button"
                onClick={() => tap(k)}
                w={{ base: "56px", md: "64px" }}
                h={{ base: "44px", md: "48px" }}
                borderRadius="md"
                bg={k.variant === "primary" ? "rgba(167,255,0,0.18)" : "rgba(255,255,255,0.10)"}
                color={k.variant === "primary" ? "primary" : "white"}
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="900"
                letterSpacing="0.08em"
                cursor="pointer"
                transition="all 0.1s"
                _active={{
                  bg: k.variant === "primary" ? "rgba(167,255,0,0.28)" : "rgba(255,255,255,0.20)",
                  transform: "scale(0.95)",
                }}
              >
                {k.label}
              </Box>
              <Text fontSize="xs" color="gray.300" mt={1}>
                {k.hint}
              </Text>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
