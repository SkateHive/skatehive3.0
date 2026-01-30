"use client";
import React, { ReactNode } from "react";
import { Box, Flex } from "@chakra-ui/react";

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
        boxShadow="0 0 10px rgba(168, 255, 96, 0.2)"
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
