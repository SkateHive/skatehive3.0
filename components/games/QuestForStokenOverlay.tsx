"use client";

import React from "react";
import { Box, Text } from "@chakra-ui/react";

interface QuestForStokenOverlayProps {
  children: React.ReactNode;
}

type ControlKey = {
  label: string;
  hint?: string;
  variant?: "primary" | "default";
};

/**
 * Quest for Stoken overlay: arcade / CRT vibe.
 * NOTE: QFS runs in a cross-origin iframe, so we cannot programmatically send keys.
 * This overlay is purely visual (shows the correct keys to press).
 *
 * Controls (from Vlad screenshot):
 * - Move: W A S D
 * - Jump: SPACE
 * - Attack/Action/Dash: J K L
 * - Block: O
 */
export default function QuestForStokenOverlay({
  children,
}: QuestForStokenOverlayProps) {
  const ACTION_KEYS: ControlKey[] = [
    { label: "O", hint: "Block" },
    { label: "J", hint: "Attack" },
    { label: "K", hint: "Action" },
    { label: "L", hint: "Dash" },
  ];

  return (
    <Box
      position="relative"
      w="100%"
      maxW="1280px"
      mx="auto"
      aspectRatio="21/10"
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
        w={{ base: "92%", md: "82%" }}
        h={{ base: "74%", md: "78%" }}
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

      {/* Hybrid controls (bottom) */}
      <Box
        position="absolute"
        bottom={{ base: 4, md: 5 }}
        left="50%"
        transform="translateX(-50%)"
        w={{ base: "92%", md: "78%" }}
        display="flex"
        justifyContent="space-between"
        alignItems="flex-end"
        gap={{ base: 3, md: 6 }}
        pointerEvents="none"
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
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="md"
              bg="rgba(255,255,255,0.10)"
              color="white"
              fontWeight="800"
              letterSpacing="0.06em"
            >
              W
            </Box>
            <Box />
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="md"
              bg="rgba(255,255,255,0.10)"
              color="white"
              fontWeight="800"
              letterSpacing="0.06em"
            >
              A
            </Box>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="md"
              bg="rgba(255,255,255,0.10)"
              color="white"
              fontWeight="800"
              letterSpacing="0.06em"
            >
              S
            </Box>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="md"
              bg="rgba(255,255,255,0.10)"
              color="white"
              fontWeight="800"
              letterSpacing="0.06em"
            >
              D
            </Box>
          </Box>

          {/* Space under-left of the cross */}
          <Box
            px={{ base: 4, md: 5 }}
            py={{ base: 3, md: 3 }}
            minW={{ base: "110px", md: "130px" }}
            borderRadius="xl"
            bg="rgba(0,0,0,0.72)"
            border="1px solid rgba(167,255,0,0.18)"
            backdropFilter="blur(10px)"
            boxShadow="0 10px 30px rgba(0,0,0,0.55)"
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
                w={{ base: "56px", md: "64px" }}
                h={{ base: "44px", md: "48px" }}
                borderRadius="md"
                bg={k.label === "J" ? "rgba(167,255,0,0.18)" : "rgba(255,255,255,0.10)"}
                color={k.label === "J" ? "primary" : "white"}
                display="flex"
                alignItems="center"
                justifyContent="center"
                fontWeight="900"
                letterSpacing="0.08em"
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
