"use client";

import React, { useState } from "react";
import NextLink from "next/link";
import {
  Box,
  Container,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Image,
  Link,
  SimpleGrid,
  Text,
  VStack,
  Spinner,
  Button,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalCloseButton,
  ModalBody,
} from "@chakra-ui/react";
import { ArrowBackIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { Discussion } from "@hiveio/dhive";
import Snap from "@/components/homepage/Snap";
import SnapComposer from "@/components/homepage/SnapComposer";
import { useComments } from "@/hooks/useComments";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";
import { EnhancedMarkdownRenderer } from "@/components/markdown/EnhancedMarkdownRenderer";
import { getPostDate } from "@/lib/utils/GetPostDate";
import { ParsedSpot } from "@/lib/utils/parseSpotBody";

interface SpotPageClientProps {
  discussion: Discussion;
  spot: ParsedSpot;
}

function buildMapEmbedSrc(lat: number, lng: number): string {
  // Standalone Google Maps embed, centered tightly on the spot. No API key needed.
  return `https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`;
}

function buildDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export default function SpotPageClient({ discussion, spot }: SpotPageClientProps) {
  const { canUseAppFeatures } = useEffectiveHiveUser();
  const { comments, isLoading: commentsLoading, error: commentsError } = useComments(
    discussion.author,
    discussion.permlink,
    false
  );
  const [optimisticComments, setOptimisticComments] = useState<Discussion[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const heroImage = spot.images[0]?.url;
  const galleryImages = spot.images.slice(1);
  const hasCoords = spot.lat != null && spot.lng != null;

  const handleNewComment = (newComment: Partial<Discussion>) => {
    setOptimisticComments((prev) => [newComment as Discussion, ...prev]);
  };

  return (
    <Container maxW="6xl" px={{ base: 3, md: 6 }} py={{ base: 4, md: 6 }}>
      {/* Breadcrumb / back */}
      <HStack mb={4} spacing={3} color="gray.400" fontSize="sm">
        <Link
          as={NextLink}
          href="/map"
          display="inline-flex"
          alignItems="center"
          gap={1}
          _hover={{ color: "primary", textDecoration: "none" }}
        >
          <ArrowBackIcon /> Back to map
        </Link>
      </HStack>

      {/* Header */}
      <VStack align="stretch" spacing={2} mb={5}>
        <Heading as="h1" fontSize={{ base: "2xl", md: "4xl" }} color="primary">
          {spot.name || "Untitled spot"}
        </Heading>
        <HStack spacing={2} color="gray.400" fontSize="sm">
          <Text>
            Submitted by{" "}
            <Link
              as={NextLink}
              href={`/user/${discussion.author}`}
              color="primary"
              _hover={{ textDecoration: "underline" }}
            >
              @{discussion.author}
            </Link>
          </Text>
          <Text>·</Text>
          <Text>{getPostDate(discussion.created)}</Text>
        </HStack>
      </VStack>

      <Grid
        templateColumns={{ base: "1fr", lg: hasCoords ? "1.2fr 1fr" : "1fr" }}
        gap={6}
        mb={8}
      >
        {/* Hero image */}
        {heroImage && (
          <GridItem>
            <Box
              borderRadius="lg"
              overflow="hidden"
              border="1px solid"
              borderColor="whiteAlpha.200"
              cursor="zoom-in"
              onClick={() => setLightboxUrl(heroImage)}
            >
              <Image
                src={heroImage}
                alt={spot.images[0]?.caption || spot.name || "Skate spot photo"}
                w="100%"
                maxH={{ base: "60vh", lg: "70vh" }}
                objectFit="cover"
                display="block"
              />
            </Box>
          </GridItem>
        )}

        {/* Mini map */}
        {hasCoords && (
          <GridItem>
            <VStack align="stretch" spacing={3}>
              <Box
                borderRadius="lg"
                overflow="hidden"
                border="1px solid"
                borderColor="primary"
                boxShadow="0 0 16px rgba(167, 255, 0, 0.12)"
                h={{ base: "50vh", lg: heroImage ? "70vh" : "60vh" }}
              >
                <iframe
                  src={buildMapEmbedSrc(spot.lat!, spot.lng!)}
                  style={{ border: "none", width: "100%", height: "100%", display: "block" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </Box>
              <VStack align="stretch" spacing={2}>
                <Text fontSize="sm" color="gray.300">
                  🌐 {spot.lat!.toFixed(6)}, {spot.lng!.toFixed(6)}
                  {spot.address && spot.address !== `${spot.lat}, ${spot.lng}` && (
                    <> · {spot.address}</>
                  )}
                </Text>
                <HStack spacing={2}>
                  <Button
                    as="a"
                    href={buildDirectionsUrl(spot.lat!, spot.lng!)}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    bg="primary"
                    color="background"
                    _hover={{ bg: "accent", color: "text" }}
                    rightIcon={<ExternalLinkIcon />}
                  >
                    Get directions
                  </Button>
                  <Button
                    as="a"
                    href={`https://www.google.com/maps?q=${spot.lat},${spot.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="sm"
                    variant="outline"
                    borderColor="primary"
                    color="primary"
                    _hover={{ bg: "primary", color: "background" }}
                  >
                    Open in Google Maps
                  </Button>
                </HStack>
              </VStack>
            </VStack>
          </GridItem>
        )}
      </Grid>

      {/* No location notice */}
      {!hasCoords && spot.address && (
        <Box mb={6} p={3} bg="rgba(255,255,255,0.04)" borderRadius="md" border="1px solid" borderColor="whiteAlpha.200">
          <Text fontSize="sm" color="gray.300">🌐 {spot.address}</Text>
        </Box>
      )}

      {/* Description */}
      {spot.description && (
        <Box mb={8}>
          <Heading as="h2" fontSize="lg" mb={2} color="white">
            About this spot
          </Heading>
          <Box color="gray.200" lineHeight={1.7}>
            <EnhancedMarkdownRenderer content={spot.description} />
          </Box>
        </Box>
      )}

      {/* Gallery */}
      {galleryImages.length > 0 && (
        <Box mb={10}>
          <Heading as="h2" fontSize="lg" mb={3} color="white">
            Photos
          </Heading>
          <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} spacing={3}>
            {galleryImages.map((img, idx) => (
              <Box
                key={`${img.url}-${idx}`}
                borderRadius="md"
                overflow="hidden"
                border="1px solid"
                borderColor="whiteAlpha.200"
                cursor="zoom-in"
                onClick={() => setLightboxUrl(img.url)}
              >
                <Image
                  src={img.url}
                  alt={img.caption || `${spot.name || "Spot"} photo ${idx + 2}`}
                  w="100%"
                  h={{ base: "120px", md: "160px" }}
                  objectFit="cover"
                  display="block"
                  loading="lazy"
                />
              </Box>
            ))}
          </SimpleGrid>
        </Box>
      )}

      {/* Comments */}
      <Box>
        <Heading as="h2" fontSize="lg" mb={3} color="white">
          Comments
        </Heading>

        {canUseAppFeatures && (
          <Box mb={4}>
            <SnapComposer
              pa={discussion.author}
              pp={discussion.permlink}
              onNewComment={handleNewComment}
              post={false}
              onClose={() => {}}
              submitLabel="Comment"
              buttonSize="sm"
            />
          </Box>
        )}

        {commentsLoading ? (
          <Flex justify="center" py={8}>
            <Spinner color="primary" />
          </Flex>
        ) : commentsError ? (
          <Text color="red.400" textAlign="center" py={8}>
            Error loading comments: {commentsError}
          </Text>
        ) : optimisticComments.length === 0 && comments.length === 0 ? (
          <Text color="gray.500" textAlign="center" py={8}>
            No comments yet. Be the first to share your thoughts on this spot.
          </Text>
        ) : (
          <VStack spacing={3} align="stretch">
            {optimisticComments.map((c, i) => (
              <Box
                key={`optimistic-${i}`}
                p={2}
                bg="muted"
                opacity={0.85}
                borderLeft="3px solid"
                borderColor="primary"
                borderRadius="md"
              >
                <Snap discussion={c} onOpen={() => {}} setReply={() => {}} />
              </Box>
            ))}
            {comments.map((c) => (
              <Box key={c.permlink} p={2} bg="muted" borderRadius="md">
                <Snap discussion={c} onOpen={() => {}} setReply={() => {}} />
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      {/* Image lightbox */}
      <Modal isOpen={!!lightboxUrl} onClose={() => setLightboxUrl(null)} size="full" isCentered>
        <ModalOverlay bg="rgba(0,0,0,0.92)" />
        <ModalContent bg="transparent" boxShadow="none" m={0} maxW="100vw" maxH="100vh">
          <ModalCloseButton color="white" size="lg" top={4} right={4} zIndex={10} />
          <ModalBody
            p={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
            onClick={() => setLightboxUrl(null)}
          >
            {lightboxUrl && (
              <Image
                src={lightboxUrl}
                alt={spot.name || "Spot photo"}
                maxW="100vw"
                maxH="100vh"
                objectFit="contain"
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Container>
  );
}
