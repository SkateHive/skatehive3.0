"use client";
import React, { ReactNode } from "react";
import { Box, Flex, useTheme } from "@chakra-ui/react";

interface ProfileHeaderWrapperProps {
  coverImage?: string; // Not used in terminal style, kept for API compatibility
  username?: string; // Not used in terminal style, kept for API compatibility
  identity: ReactNode;
  primaryActions?: ReactNode;
  integrations?: ReactNode;
}

/**
 * Terminal-Style Profile Header
 *
 * Implements CLI/hacker aesthetic:
 * - No rounded corners (sharp edges only)
 * - Monospace fonts
 * - Terminal color scheme
 * - Glowing borders
 * - ASCII-style layout
 * - No gradients, flat design
 */
export default function ProfileHeaderWrapper({
  identity,
  primaryActions,
  integrations,
}: ProfileHeaderWrapperProps) {
  const theme = useTheme();

  // Compute glow shadow using theme's primary color with 0.2 opacity
  const primary = theme.colors.primary;
  const primaryColor = typeof primary === "string" ? primary : (primary[500] || primary.DEFAULT || Object.values(primary)[0]);

  function hexToRgba(hex: string, alpha: number) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const num = parseInt(c, 16);
    return `rgba(${(num >> 16) & 255},${(num >> 8) & 255},${num & 255},${alpha})`;
  }

  const glowColor = primaryColor.startsWith('#') ? hexToRgba(primaryColor, 0.2) : primaryColor;
  const glowShadow = `0 0 10px ${glowColor}`;

  return (
    <Box
      position="relative"
      w="100%"
      maxW="container.xl"
      mx="auto"
      borderRadius="none"
    >
      {/* Terminal-style container */}
      <Box
        position="relative"
        w="100%"
        bg="background"
        border="2px solid"
        borderColor="border"
        borderRadius="none"
        boxShadow={glowShadow}
        p={{ base: 4, md: 6 }}
      >
        {/* Identity block */}
        <Box w="100%">
          {identity}
        </Box>
      </Box>
    </Box>
  );
}
