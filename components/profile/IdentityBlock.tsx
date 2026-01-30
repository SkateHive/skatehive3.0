"use client";
import React from "react";
import { Box, Flex, Avatar, VStack, HStack, Text, Link, IconButton } from "@chakra-ui/react";
import { FaExternalLinkAlt, FaEdit } from "react-icons/fa";

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
  statsRow?: React.ReactNode;
  integrations?: React.ReactNode;
  editButton?: React.ReactNode;
}

/**
 * Terminal-Style Identity Block
 *
 * CLI/Hacker Aesthetic:
 * - Monospace fonts (Fira Code)
 * - Sharp edges (no rounded corners)
 * - Terminal colors (green on dark)
 * - ASCII brackets and separators
 * - Uppercase labels
 * - Status indicators
 */
export default function IdentityBlock({
  avatar,
  displayName,
  handle,
  bio,
  badges,
  externalLink,
  statsRow,
  integrations,
  editButton,
}: IdentityBlockProps) {
  return (
    <Box position="relative" w="100%">
      {/* Terminal-style info panel */}
      <Box
        position="relative"
        border="1px solid"
        borderColor="dim"
        borderRadius="none"
        p={{ base: 3, md: 4 }}
        bg="muted"
        boxShadow="0 0 5px rgba(168, 255, 96, 0.1)"
      >
        {/* Network folder icons - Bottom right of gray box */}
        {integrations && (
          <Flex
            position="absolute"
            bottom={4}
            right={4}
            gap={2}
            align="center"
            zIndex={10}
          >
            {integrations}
          </Flex>
        )}
        <Flex direction="row" align="flex-start" gap={{ base: 3, md: 4 }}>
          {/* Avatar - square, sharp edges */}
          <Box position="relative" flexShrink={0}>
            <Avatar
              src={avatar}
              name={displayName}
              borderRadius="none"
              boxSize={{ base: "80px", md: "100px" }}
              border="2px solid"
              borderColor="border"
              boxShadow="0 0 8px rgba(168, 255, 96, 0.3)"
            />
            {/* Status indicator */}
            <Box
              position="absolute"
              bottom={-1}
              right={-1}
              w={4}
              h={4}
              bg="success"
              border="2px solid"
              borderColor="background"
              borderRadius="none"
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="2xs" color="background">●</Text>
            </Box>
          </Box>

          {/* Text content - monospace terminal style */}
          <VStack
            align="flex-start"
            spacing={{ base: 2, md: 3 }}
            flex="1"
            minW={0}
            fontFamily="mono"
          >
            {/* Name row - terminal style */}
            <HStack spacing={2} align="center" flexWrap="wrap">
              <Text
                fontSize={{ base: "xs", md: "sm" }}
                color="dim"
                fontFamily="mono"
              >
                &gt;
              </Text>
              <Text
                fontSize={{ base: "md", md: "lg" }}
                fontWeight="bold"
                color="primary"
                fontFamily="mono"
                textTransform="uppercase"
                letterSpacing="wide"
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
                  color="text"
                  opacity={0.7}
                  _hover={{ opacity: 1, color: "primary" }}
                  transition="all 0.2s"
                >
                  <FaExternalLinkAlt size={12} />
                </Link>
              )}
              {editButton}
            </HStack>

            {/* Handle row + badges - terminal style */}
            <HStack spacing={2} align="center" flexWrap="wrap">
              <Text
                fontSize={{ base: "xs", md: "sm" }}
                color="text"
                fontFamily="mono"
                noOfLines={1}
              >
                [{handle}]
              </Text>
              {badges?.map((badge, idx) => (
                <Text
                  key={idx}
                  fontSize="xs"
                  color="warning"
                  fontFamily="mono"
                  px={2}
                  py={0.5}
                  border="1px solid"
                  borderColor="warning"
                  borderRadius="none"
                  textTransform="uppercase"
                  bg="rgba(255, 189, 74, 0.1)"
                >
                  {badge.label}:{badge.value}
                </Text>
              ))}
            </HStack>

            {/* Bio row - terminal style */}
            {bio && (
              <Text
                fontSize={{ base: "xs", md: "xs" }}
                color="dim"
                fontFamily="mono"
                noOfLines={3}
                lineHeight={1.6}
                maxW="100%"
              >
                {bio}
              </Text>
            )}
          </VStack>
        </Flex>
      </Box>

      {/* Stats row - rendered below identity panel */}
      {statsRow && (
        <Box mt={{ base: 3, md: 4 }}>
          {statsRow}
        </Box>
      )}
    </Box>
  );
}
