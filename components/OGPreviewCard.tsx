"use client";

import { Box, Heading, Text, Image, VStack, HStack, Badge, Code, Flex } from "@chakra-ui/react";

interface OGMetadata {
  title: string;
  description: string;
  image: string;
  url: string;
  type?: string;
  twitterCard?: string;
  fcFrame?: Record<string, any>;
}

interface OGPreviewCardProps {
  metadata: OGMetadata;
  platform: "telegram" | "discord" | "twitter" | "farcaster";
  pageType: string;
  hasCustomMetadata: boolean;
}

const platformDimensions = {
  telegram: { width: "100%", maxWidth: "500px", imageAspect: 1.91 },
  discord: { width: "100%", maxWidth: "520px", imageAspect: 1.91 },
  twitter: { width: "100%", maxWidth: "504px", imageAspect: 2 },
  farcaster: { width: "100%", maxWidth: "500px", imageAspect: 1.91 },
};

export default function OGPreviewCard({
  metadata,
  platform,
  pageType,
  hasCustomMetadata,
}: OGPreviewCardProps) {
  const dims = platformDimensions[platform];

  return (
    <VStack align="stretch" spacing={3} w="full">
      {/* Header */}
      <HStack justify="space-between">
        <Heading size="sm" textTransform="capitalize">
          {platform} Preview - {pageType}
        </Heading>
        <Badge colorScheme={hasCustomMetadata ? "green" : "yellow"}>
          {hasCustomMetadata ? "Custom" : "Default"}
        </Badge>
      </HStack>

      {/* Visual Preview */}
      <Box
        borderWidth="1px"
        borderRadius="lg"
        overflow="hidden"
        bg="gray.900"
        maxW={dims.maxWidth}
        w={dims.width}
      >
        {/* Image */}
        <Box position="relative" w="full" pb={`${(1 / dims.imageAspect) * 100}%`}>
          <Image
            src={metadata.image}
            alt={metadata.title}
            position="absolute"
            top={0}
            left={0}
            w="full"
            h="full"
            objectFit="cover"
            fallbackSrc="/ogimage.png"
          />
        </Box>

        {/* Content */}
        <VStack align="start" p={4} spacing={2}>
          <Text fontSize="xs" color="gray.500" textTransform="uppercase">
            {new URL(metadata.url).hostname}
          </Text>
          <Heading size="sm" noOfLines={2}>
            {metadata.title}
          </Heading>
          <Text fontSize="sm" color="gray.400" noOfLines={3}>
            {metadata.description}
          </Text>
        </VStack>
      </Box>

      {/* Metadata Details */}
      <Box
        borderWidth="1px"
        borderRadius="md"
        p={3}
        bg="gray.800"
        fontSize="xs"
        overflowX="auto"
      >
        <Code display="block" whiteSpace="pre-wrap" bg="transparent" p={0}>
          {JSON.stringify(
            {
              title: metadata.title,
              description: metadata.description,
              image: metadata.image,
              type: metadata.type,
              twitterCard: metadata.twitterCard,
              hasFarcasterFrame: !!metadata.fcFrame,
            },
            null,
            2
          )}
        </Code>
      </Box>

      {/* Farcaster Frame Info (if applicable) */}
      {platform === "farcaster" && metadata.fcFrame && (
        <Box borderWidth="1px" borderRadius="md" p={3} bg="purple.900">
          <Heading size="xs" mb={2}>
            Farcaster Frame Metadata
          </Heading>
          <Code display="block" whiteSpace="pre-wrap" bg="transparent" p={0} fontSize="xs">
            {JSON.stringify(metadata.fcFrame, null, 2)}
          </Code>
        </Box>
      )}
    </VStack>
  );
}
