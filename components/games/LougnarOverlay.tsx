"use client";

import React from "react";
import { Box, Text } from "@chakra-ui/react";

interface LougnarOverlayProps {
  children: React.ReactNode;
}

/**
 * Lougnar overlay: keeps the GBA vibe, but shows the correct control hint.
 * Lougnar input is click/tap (confirmed in webgnar/excaliburSkate source: pointer primary down).
 */
export default function LougnarOverlay({ children }: LougnarOverlayProps) {
  return (
    <Box
      position="relative"
      w="100%"
      maxW="1200px"
      mx="auto"
      aspectRatio="2/1"
      bg="linear-gradient(135deg, #7b68ee 0%, #6a5acd 50%, #5a4fb8 100%)"
      borderRadius="3xl"
      boxShadow="0 20px 60px rgba(0,0,0,0.5), inset 0 2px 8px rgba(255,255,255,0.15)"
      p={8}
    >
      {/* Power LED */}
      <Box
        position="absolute"
        top={6}
        right={8}
        w={3}
        h={3}
        borderRadius="full"
        bg="#00ff00"
        boxShadow="0 0 12px #00ff00"
      />

      {/* Screen */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w="65%"
        h="70%"
        bg="#1a1a1a"
        borderRadius="lg"
        border="6px solid #0a0a0a"
        boxShadow="inset 0 6px 16px rgba(0,0,0,0.7)"
        overflow="hidden"
      >
        {children}

        {/* Control hint overlay */}
        <Box
          position="absolute"
          bottom={3}
          left={3}
          bg="rgba(0,0,0,0.65)"
          border="1px solid rgba(255,255,255,0.14)"
          borderRadius="lg"
          px={3}
          py={2}
        >
          <Text fontSize="xs" color="gray.200" fontWeight="800" letterSpacing="0.08em">
            CLICK / TAP
          </Text>
          <Text fontSize="xs" color="gray.300">
            Jump
          </Text>
        </Box>
      </Box>

      {/* Right-side: big CLICK button (visual only) */}
      <Box position="absolute" bottom="22%" right="8%" pointerEvents="none">
        <Box
          w={{ base: 24, md: 28 }}
          h={{ base: 24, md: 28 }}
          borderRadius="full"
          bg="rgba(0,0,0,0.18)"
          border="3px solid rgba(0,0,0,0.35)"
          boxShadow="0 4px 10px rgba(0,0,0,0.35), inset 0 1px 2px rgba(255,255,255,0.12)"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize="xs" color="white" fontWeight="900" letterSpacing="0.10em">
            CLICK
          </Text>
        </Box>
      </Box>

      {/* Label */}
      <Text
        position="absolute"
        top={6}
        left={8}
        fontSize="xs"
        fontWeight="bold"
        color="whiteAlpha.800"
        letterSpacing="0.12em"
      >
        LOUGNAR
      </Text>
    </Box>
  );
}
