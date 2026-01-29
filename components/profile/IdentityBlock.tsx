"use client";
import React from "react";
import { Box, Flex, Avatar, VStack, HStack, Text, Badge, Link } from "@chakra-ui/react";
import { FaExternalLinkAlt } from "react-icons/fa";

interface IdentityBlockProps {
  avatar: string;
  displayName: string;
  handle: string;
  bio?: string;
  badges?: {
    label: string;
    value: string | number;
    colorScheme?: string;
  }[];
  externalLink?: {
    url: string;
    label: string;
  };
  size?: "md" | "lg";
}

/**
 * Identity Block Component
 *
 * Hierarchy:
 * 1. Display name (largest, highest contrast)
 * 2. Handle (smaller, medium contrast)
 * 3. Badges (same baseline as handle, low-medium contrast)
 * 4. Bio/status (tertiary, clamped to 2 lines)
 *
 * Features localized scrim for readability over cover images
 */
export default function IdentityBlock({
  avatar,
  displayName,
  handle,
  bio,
  badges,
  externalLink,
  size = "lg",
}: IdentityBlockProps) {
  const avatarSize = size === "lg" ? "120px" : "64px";
  const nameSize = size === "lg" ? "2xl" : "lg";
  const handleSize = size === "lg" ? "md" : "sm";
  const bioSize = size === "lg" ? "sm" : "xs";

  return (
    <Flex
      direction="row"
      align="flex-start"
      gap={{ base: 3, md: 4 }}
      position="relative"
    >
      {/* Localized scrim behind identity block for readability */}
      <Box
        position="absolute"
        top="-8px"
        left="-8px"
        right="-8px"
        bottom="-8px"
        bgGradient="linear(to-r, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 70%, transparent 100%)"
        borderRadius="lg"
        zIndex={0}
        pointerEvents="none"
      />

      {/* Avatar - vertically centered to text block */}
      <Avatar
        src={avatar}
        name={displayName}
        borderRadius="lg"
        boxSize={avatarSize}
        border="3px solid"
        borderColor="whiteAlpha.900"
        boxShadow="0 4px 12px rgba(0,0,0,0.4)"
        position="relative"
        zIndex={1}
      />

      {/* Text block with clear hierarchy */}
      <VStack
        align="flex-start"
        spacing={{ base: 1, md: 2 }}
        flex="1"
        minW={0}
        position="relative"
        zIndex={1}
      >
        {/* Display name - primary */}
        <Flex direction="row" align="center" gap={2}>
          <Text
            fontSize={nameSize}
            fontWeight="bold"
            color="white"
            textShadow="0 2px 6px rgba(0,0,0,0.9)"
            lineHeight={1.2}
            noOfLines={1}
          >
            {displayName}
          </Text>
          {externalLink && (
            <Link
              href={externalLink.url}
              isExternal
              display="flex"
              alignItems="center"
              aria-label={externalLink.label}
              opacity={0.8}
              _hover={{ opacity: 1 }}
            >
              <FaExternalLinkAlt size={14} color="white" />
            </Link>
          )}
        </Flex>

        {/* Handle + Badges row - secondary hierarchy, same baseline */}
        <HStack spacing={3} align="center">
          <Text
            fontSize={handleSize}
            color="whiteAlpha.800"
            fontWeight="medium"
            textShadow="0 2px 4px rgba(0,0,0,0.9)"
            noOfLines={1}
          >
            {handle}
          </Text>
          {badges?.map((badge, idx) => (
            <Badge
              key={idx}
              colorScheme={badge.colorScheme || "gray"}
              variant="solid"
              fontSize="2xs"
              px={2}
              py={0.5}
              borderRadius="full"
              boxShadow="0 2px 4px rgba(0,0,0,0.3)"
              textTransform="uppercase"
            >
              {badge.label}: {badge.value}
            </Badge>
          ))}
        </HStack>

        {/* Bio - tertiary, clamped */}
        {bio && (
          <Text
            fontSize={bioSize}
            color="whiteAlpha.700"
            textShadow="0 2px 4px rgba(0,0,0,0.9)"
            noOfLines={2}
            maxW={{ base: "100%", md: "500px" }}
            lineHeight={1.4}
          >
            {bio}
          </Text>
        )}
      </VStack>
    </Flex>
  );
}
