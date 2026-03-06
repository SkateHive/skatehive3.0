"use client";

import React from "react";
import { Box, Text } from "@chakra-ui/react";

interface LougnarOverlayProps {
  children: React.ReactNode;
  onClose?: () => void;
}

/**
 * ROG Ally / Steam Deck style overlay for Lougnar
 * Modern handheld gaming aesthetic with neon accents
 * Lougnar uses mouse/tap controls only (no keyboard)
 */
export default function LougnarOverlay({ children, onClose }: LougnarOverlayProps) {
  return (
    <Box
      position="relative"
      w="100%"
      aspectRatio="16/9"
      bg="linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 100%)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      borderRadius="lg"
    >
      {/* Ambient glow */}
      <Box
        position="absolute"
        inset={0}
        bg="radial-gradient(circle at 30% 50%, rgba(138,43,226,0.15), transparent 50%), radial-gradient(circle at 70% 50%, rgba(0,191,255,0.15), transparent 50%)"
        pointerEvents="none"
      />

      {/* Screen container */}
      <Box
        position="relative"
        w="100%"
        h="100%"
        bg="#000"
        borderRadius="md"
        overflow="hidden"
        boxShadow="0 0 60px rgba(138,43,226,0.3), 0 0 120px rgba(0,191,255,0.2)"
      >
        {/* Close button */}
        {onClose && (
          <Box
            as="button"
            onClick={onClose}
            position="absolute"
            top="20px"
            right="20px"
            zIndex={20}
            w="50px"
            h="50px"
            borderRadius="full"
            bg="rgba(20,20,35,0.9)"
            border="2px solid rgba(138,43,226,0.5)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            transition="all 0.2s"
            boxShadow="0 0 20px rgba(138,43,226,0.3)"
            _hover={{
              bg: "rgba(138,43,226,0.3)",
              borderColor: "rgba(138,43,226,0.8)",
              boxShadow: "0 0 30px rgba(138,43,226,0.6)",
              transform: "scale(1.05)",
            }}
            _active={{
              transform: "scale(0.95)",
            }}
          >
            <Text fontSize="2xl" fontWeight="bold" color="rgba(200,200,255,0.9)">
              ✕
            </Text>
          </Box>
        )}

        {/* Game iframe */}
        <Box position="absolute" inset={0} zIndex={1}>
          {children}
        </Box>

        {/* In-game control hint (top center) */}
        <Box
          position="absolute"
          top="30px"
          left="50%"
          transform="translateX(-50%)"
          zIndex={10}
          bg="rgba(0,0,0,0.7)"
          backdropFilter="blur(10px)"
          px={6}
          py={3}
          borderRadius="full"
          border="1px solid rgba(138,43,226,0.3)"
          boxShadow="0 0 30px rgba(138,43,226,0.2)"
        >
          <Text
            fontSize="lg"
            fontWeight="bold"
            color="white"
            textAlign="center"
            letterSpacing="wider"
          >
            🖱️ CLICK / TAP TO JUMP
          </Text>
        </Box>

        {/* Right side: Large CLICK button (visual reference only) */}
        <Box
          position="absolute"
          bottom="60px"
          right="80px"
          zIndex={10}
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap={2}
        >
          {/* Large circular button */}
          <Box
            position="relative"
            w="120px"
            h="120px"
            borderRadius="full"
            bg="linear-gradient(135deg, rgba(0,212,255,0.3), rgba(138,43,226,0.15))"
            border="3px solid rgba(0,212,255,0.5)"
            display="flex"
            alignItems="center"
            justifyContent="center"
            pointerEvents="none"
            animation="pulse 2s ease-in-out infinite"
            sx={{
              "@keyframes pulse": {
                "0%, 100%": {
                  boxShadow: "0 0 20px rgba(0,212,255,0.4), 0 0 40px rgba(138,43,226,0.2)",
                },
                "50%": {
                  boxShadow: "0 0 40px rgba(0,212,255,0.6), 0 0 80px rgba(138,43,226,0.4)",
                },
              },
            }}
          >
            {/* Button glow */}
            <Box
              position="absolute"
              inset={-20}
              bg="radial-gradient(circle, rgba(0,212,255,0.3), transparent 60%)"
              filter="blur(20px)"
              pointerEvents="none"
            />

            {/* Click icon/label */}
            <Text
              fontSize="4xl"
              fontWeight="black"
              color="#00d4ff"
              zIndex={1}
              textShadow="0 0 15px #00d4ff"
            >
              🖱️
            </Text>
          </Box>

          {/* Hint text */}
          <Text
            fontSize="sm"
            fontWeight="bold"
            color="rgba(255,255,255,0.7)"
            textAlign="center"
            letterSpacing="wider"
          >
            CLICK SCREEN
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
