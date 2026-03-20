"use client";

import React, { useState } from "react";
import {
  Box,
  Container,
  Text,
  VStack,
  HStack,
  Image,
  Link as ChakraLink,
  Icon,
  IconButton,
  Spinner,
} from "@chakra-ui/react";
import NextLink from "next/link";
import HubNavigation from "@/components/shared/HubNavigation";
import { FaFilm, FaArrowLeft, FaExternalLinkAlt, FaPlay } from "react-icons/fa";
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
  soundtrack?: { part: string; song: string }[];
  skaters?: string[];
  dataSource?: string;
  svsSlug?: string;
}

export default function CinemaVideoPage({
  video,
  relatedVideos,
}: {
  video: CinemaVideo;
  relatedVideos: CinemaVideo[];
}) {
  const [playingSong, setPlayingSong] = useState<number | null>(null);
  const [loadingSong, setLoadingSong] = useState<number | null>(null);
  const [videoIds, setVideoIds] = useState<Record<number, string>>({});

  const handlePlaySong = async (index: number, song: string) => {
    if (playingSong === index) {
      setPlayingSong(null);
      return;
    }

    if (videoIds[index]) {
      setPlayingSong(index);
      return;
    }

    setLoadingSong(index);
    try {
      const res = await fetch(`/api/search-music?q=${encodeURIComponent(song)}`);
      const data = await res.json();
      
      if (data.videoId) {
        setVideoIds({ ...videoIds, [index]: data.videoId });
        setPlayingSong(index);
      }
    } catch (error) {
      console.error("Failed to load song:", error);
    } finally {
      setLoadingSong(null);
    }
  };

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
          
          {/* Data credits */}
          {video.dataSource === "skatevideosite" && (
            <Text fontFamily="mono" fontSize="2xs" color="gray.600" mt={2}>
              Soundtrack data: <ChakraLink href={`https://skatevideosite.com/videos/${video.svsSlug}`} isExternal color="primary" _hover={{ textDecoration: "underline" }}>SkateVideoSite</ChakraLink>
            </Text>
          )}
        </Box>

        {/* Soundtrack */}
        {video.soundtrack && video.soundtrack.length > 0 && (
          <Box mb={6}>
            <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color="text" mb={3}>
              soundtrack
            </Text>
            <VStack align="stretch" spacing={2}>
              {video.soundtrack.map((item, index) => (
                <Box key={index}>
                  <HStack spacing={3} p={2} borderRadius="sm" bg="whiteAlpha.50" justify="space-between">
                    <HStack spacing={3} flex={1}>
                      <Text fontFamily="mono" fontSize="2xs" color="primary" minW="100px" fontWeight="bold">
                        {item.part}
                      </Text>
                      <Text fontFamily="mono" fontSize="xs" color="gray.300">
                        {item.song}
                      </Text>
                    </HStack>
                    <IconButton
                      aria-label="Play song"
                      icon={loadingSong === index ? <Spinner size="xs" /> : <Icon as={FaPlay} boxSize={3} />}
                      size="sm"
                      variant="ghost"
                      colorScheme={playingSong === index ? "green" : "gray"}
                      onClick={() => handlePlaySong(index, item.song)}
                      isDisabled={loadingSong !== null && loadingSong !== index}
                    />
                  </HStack>
                  {playingSong === index && videoIds[index] && (
                    <Box mt={2} w="100%" h="80px" borderRadius="sm" overflow="hidden">
                      <iframe
                        src={`https://www.youtube.com/embed/${videoIds[index]}?autoplay=1`}
                        style={{ width: "100%", height: "100%", border: 0 }}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                    </Box>
                  )}
                </Box>
              ))}
            </VStack>
          </Box>
        )}

        {/* Skaters */}
        {video.skaters && video.skaters.length > 0 && (
          <Box mb={6}>
            <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color="text" mb={3}>
              skaters ({video.skaters.length})
            </Text>
            <HStack spacing={2} flexWrap="wrap">
              {video.skaters.map((skater, index) => (
                <Text key={index} fontFamily="mono" fontSize="xs" color="gray.400" px={2} py={1} bg="whiteAlpha.50" borderRadius="sm">
                  {skater}
                </Text>
              ))}
            </HStack>
          </Box>
        )}

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
