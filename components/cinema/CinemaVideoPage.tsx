"use client";

import React from "react";
import {
  Box,
  Container,
  Text,
  VStack,
  HStack,
  Image,
  Link as ChakraLink,
  Icon,
} from "@chakra-ui/react";
import NextLink from "next/link";
import HubNavigation from "@/components/shared/HubNavigation";
import { FaFilm, FaArrowLeft, FaExternalLinkAlt } from "react-icons/fa";
import { SiOdysee } from "react-icons/si";

interface CinemaVideo {
  slug: string;
  title: string;
  brand: string;
  year: number | null;
  embedUrl: string;
  thumbnail: string;
  description: string;
  channel: string;
  link: string;
}

export default function CinemaVideoPage({
  video,
  relatedVideos,
}: {
  video: CinemaVideo;
  relatedVideos: CinemaVideo[];
}) {
  return (
    <Box minH="100vh">
      <Container maxW="container.lg" px={{ base: 2, md: 4 }}>
        <HubNavigation />

        {/* Back link */}
        <ChakraLink as={NextLink} href="/cinema" fontFamily="mono" fontSize="xs" color="gray.500"
          _hover={{ color: "primary", textDecoration: "none" }} display="inline-flex" alignItems="center" gap={1} mb={4}>
          <Icon as={FaArrowLeft} boxSize={2.5} /> back to cinema
        </ChakraLink>

        {/* Video Player */}
        <Box w="100%" sx={{ aspectRatio: "16 / 9" }} bg="background" position="relative" overflow="hidden"
          border="1px solid" borderColor="whiteAlpha.100" borderRadius="md" mb={4}>
          <iframe
            src={video.embedUrl}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
            allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </Box>

        {/* Video Info */}
        <Box mb={6}>
          <Text fontFamily="mono" fontSize={{ base: "md", md: "lg" }} fontWeight="bold" color="text" mb={2}>
            {video.title}
          </Text>

          <HStack spacing={4} mb={3} flexWrap="wrap">
            <HStack spacing={2}>
              <Icon as={FaFilm} boxSize={4} color="yellow.400" />
              <Text fontFamily="mono" fontSize="xs" color="primary" fontWeight="bold">{video.brand}</Text>
            </HStack>
            {video.year && (
              <Text fontFamily="mono" fontSize="xs" color="gray.500">{video.year}</Text>
            )}
            <HStack spacing={1}>
              <Icon as={SiOdysee} boxSize={3} color="pink.400" />
              <Text fontFamily="mono" fontSize="xs" color="gray.500">{video.channel}</Text>
            </HStack>
            <ChakraLink href={video.link} isExternal _hover={{ textDecoration: "none" }}>
              <HStack spacing={1}>
                <Icon as={FaExternalLinkAlt} boxSize={2.5} color="gray.500" _hover={{ color: "primary" }} />
                <Text fontFamily="mono" fontSize="2xs" color="gray.500" _hover={{ color: "primary" }}>Odysee</Text>
              </HStack>
            </ChakraLink>
          </HStack>

          {video.description && (
            <Text fontFamily="mono" fontSize="xs" color="gray.400" lineHeight="1.6">
              {video.description}
            </Text>
          )}
        </Box>

        {/* Related Videos */}
        {relatedVideos.length > 0 && (
          <Box mb={8}>
            <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color="text" mb={3}>
              more from {video.brand}
            </Text>
            <VStack align="stretch" spacing={2}>
              {relatedVideos.map((rv) => (
                <ChakraLink key={rv.slug} as={NextLink} href={`/cinema/${rv.slug}`} _hover={{ textDecoration: "none" }}>
                  <HStack spacing={3} p={2} borderRadius="sm" _hover={{ bg: "whiteAlpha.50" }} transition="all 0.15s">
                    <Box w="100px" h="56px" flexShrink={0} borderRadius="sm" overflow="hidden" bg="background">
                      <Image src={rv.thumbnail} alt={rv.title} w="100%" h="100%" objectFit="cover" />
                    </Box>
                    <VStack align="start" spacing={0} flex={1} minW={0}>
                      <Text fontFamily="mono" fontSize="xs" color="text" noOfLines={2} _hover={{ color: "primary" }}>
                        {rv.title}
                      </Text>
                      <Text fontFamily="mono" fontSize="2xs" color="gray.600">
                        {rv.channel} {rv.year && `· ${rv.year}`}
                      </Text>
                    </VStack>
                  </HStack>
                </ChakraLink>
              ))}
            </VStack>
          </Box>
        )}
      </Container>
    </Box>
  );
}
