"use client";

import React from "react";
import { Box, Text } from "@chakra-ui/react";

interface GameBoyOverlayProps {
  children: React.ReactNode;
}

export default function GameBoyOverlay({ children }: GameBoyOverlayProps) {
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

      {/* Screen area (center, larger) */}
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
        {/* Game iframe */}
        {children}
      </Box>

      {/* D-pad (left side) */}
      <Box
        position="absolute"
        bottom="20%"
        left="8%"
        w={24}
        h={24}
      >
        <svg viewBox="0 0 100 100" fill="none">
          <g filter="drop-shadow(0px 3px 6px rgba(0,0,0,0.4))">
            {/* Horizontal bar */}
            <rect x="18" y="35" width="64" height="30" fill="#1a1a2e" rx="4" />
            {/* Vertical bar */}
            <rect x="35" y="18" width="30" height="64" fill="#1a1a2e" rx="4" />
            {/* Center circle */}
            <circle cx="50" cy="50" r="12" fill="#0f0f1a" />
          </g>
        </svg>
      </Box>

      {/* A/B buttons (right side) */}
      <Box
        position="absolute"
        bottom="22%"
        right="8%"
        display="flex"
        gap={3}
      >
        <Box
          w={16}
          h={16}
          borderRadius="full"
          bg="#a855f7"
          border="3px solid #7e22ce"
          boxShadow="0 4px 8px rgba(0,0,0,0.4)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="xl"
          fontWeight="bold"
          color="white"
          textShadow="0 1px 2px rgba(0,0,0,0.5)"
        >
          B
        </Box>
        <Box
          w={16}
          h={16}
          borderRadius="full"
          bg="#a855f7"
          border="3px solid #7e22ce"
          boxShadow="0 4px 8px rgba(0,0,0,0.4)"
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize="xl"
          fontWeight="bold"
          color="white"
          textShadow="0 1px 2px rgba(0,0,0,0.5)"
          mt={-3}
        >
          A
        </Box>
      </Box>

      {/* L/R shoulder buttons */}
      <Box
        position="absolute"
        top={2}
        left={6}
        fontSize="xs"
        fontWeight="bold"
        color="white"
        bg="#1a1a2e"
        px={3}
        py={1}
        borderRadius="md"
        boxShadow="0 2px 4px rgba(0,0,0,0.3)"
      >
        L
      </Box>
      <Box
        position="absolute"
        top={2}
        right={20}
        fontSize="xs"
        fontWeight="bold"
        color="white"
        bg="#1a1a2e"
        px={3}
        py={1}
        borderRadius="md"
        boxShadow="0 2px 4px rgba(0,0,0,0.3)"
      >
        R
      </Box>

      {/* START/SELECT buttons (below screen) */}
      <Box
        position="absolute"
        bottom="8%"
        left="50%"
        transform="translateX(-50%)"
        display="flex"
        gap={3}
      >
        <Box
          px={3}
          py={1}
          bg="#1a1a2e"
          borderRadius="full"
          fontSize="2xs"
          fontWeight="bold"
          color="white"
          boxShadow="0 2px 4px rgba(0,0,0,0.3)"
        >
          SELECT
        </Box>
        <Box
          px={3}
          py={1}
          bg="#1a1a2e"
          borderRadius="full"
          fontSize="2xs"
          fontWeight="bold"
          color="white"
          boxShadow="0 2px 4px rgba(0,0,0,0.3)"
        >
          START
        </Box>
      </Box>

      {/* Speaker grille (right side) */}
      <Box
        position="absolute"
        bottom="8%"
        right="4%"
        display="flex"
        flexDirection="column"
        gap={1}
      >
        {[...Array(6)].map((_, i) => (
          <Box
            key={i}
            w={16}
            h={0.5}
            bg="rgba(0,0,0,0.3)"
            borderRadius="full"
          />
        ))}
      </Box>
    </Box>
  );
}
