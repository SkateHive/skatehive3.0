"use client";

import React, { useState } from "react";
import NextLink from "next/link";
import {
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Flex,
  Grid,
  GridItem,
  Heading,
  HStack,
  Link,
  Spinner,
  Text,
  VStack,
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
import SpotImageCarousel from "./SpotImageCarousel";

interface SpotPageClientProps {
  discussion: Discussion;
  spot: ParsedSpot;
}

function buildMapEmbedSrc(lat: number, lng: number): string {
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

  const hasCoords = spot.lat != null && spot.lng != null;
  const hasImages = spot.images.length > 0;

  const handleNewComment = (newComment: Partial<Discussion>) => {
    setOptimisticComments((prev) => [newComment as Discussion, ...prev]);
  };

  return (
    <Container maxW="7xl" px={{ base: 3, md: 6 }} py={{ base: 4, md: 6 }}>
      {/* Top breadcrumb */}
      <HStack mb={3} spacing={3} color="gray.400" fontSize="sm">
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

      {/* Title block */}
      <Flex
        align={{ base: "flex-start", md: "center" }}
        justify="space-between"
        direction={{ base: "column", md: "row" }}
        gap={{ base: 2, md: 4 }}
        mb={{ base: 4, md: 6 }}
      >
        <Box>
          <Heading
            as="h1"
            fontSize={{ base: "2xl", md: "4xl" }}
            color="primary"
            lineHeight="1.15"
            mb={2}
          >
            {spot.name || "Skate spot"}
          </Heading>
          <HStack spacing={2} color="gray.400" fontSize="sm">
            <Avatar
              size="xs"
              name={discussion.author}
              src={`https://images.hive.blog/u/${discussion.author}/avatar/sm`}
            />
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
            <Text color="gray.600">·</Text>
            <Text>{getPostDate(discussion.created)}</Text>
          </HStack>
        </Box>
        {hasCoords && (
          <Button
            as="a"
            href={buildDirectionsUrl(spot.lat!, spot.lng!)}
            target="_blank"
            rel="noopener noreferrer"
            bg="primary"
            color="background"
            size="md"
            px={5}
            _hover={{ bg: "accent", color: "text" }}
            rightIcon={<ExternalLinkIcon />}
            flexShrink={0}
          >
            Get directions
          </Button>
        )}
      </Flex>

      {/* Two-column hero: carousel on the left, info card on the right.
          On mobile they stack: carousel first, then info card. */}
      <Grid
        templateColumns={{
          base: "1fr",
          lg: hasImages ? "minmax(0, 1.35fr) minmax(0, 1fr)" : "1fr",
        }}
        gap={{ base: 4, md: 6 }}
        mb={{ base: 6, md: 10 }}
        alignItems="stretch"
      >
        {hasImages && (
          <GridItem minW={0}>
            <SpotImageCarousel
              images={spot.images}
              alt={spot.name || "Skate spot photo"}
            />
          </GridItem>
        )}

        <GridItem minW={0}>
          <Box
            bg="rgba(20,20,20,0.55)"
            border="1px solid"
            borderColor="whiteAlpha.100"
            borderRadius="lg"
            overflow="hidden"
            display="flex"
            flexDirection="column"
            height="100%"
          >
            <Box p={{ base: 4, md: 5 }}>
              <Heading
                as="h2"
                fontSize="sm"
                color="primary"
                textTransform="uppercase"
                letterSpacing="wide"
                mb={3}
                fontWeight="800"
              >
                About this spot
              </Heading>
              {spot.description ? (
                <Box
                  color="gray.200"
                  fontSize={{ base: "sm", md: "md" }}
                  lineHeight={1.65}
                >
                  <EnhancedMarkdownRenderer content={spot.description} />
                </Box>
              ) : (
                <Text color="gray.500" fontSize="sm" fontStyle="italic">
                  No description provided.
                </Text>
              )}
            </Box>

            <Divider borderColor="whiteAlpha.100" />

            {/* Location section: coords + mini map + actions */}
            <Box p={{ base: 4, md: 5 }} display="flex" flexDirection="column" gap={3}>
              <Flex align="center" justify="space-between" gap={2}>
                <Heading
                  as="h2"
                  fontSize="sm"
                  color="primary"
                  textTransform="uppercase"
                  letterSpacing="wide"
                  fontWeight="800"
                >
                  Location
                </Heading>
                {hasCoords && (
                  <Text
                    fontSize="xs"
                    fontFamily="ui-monospace, monospace"
                    color="gray.300"
                  >
                    {spot.lat!.toFixed(5)}, {spot.lng!.toFixed(5)}
                  </Text>
                )}
              </Flex>

              {spot.address && spot.address !== `${spot.lat}, ${spot.lng}` && (
                <Text fontSize="xs" color="gray.500" fontFamily="ui-monospace, monospace">
                  {spot.address}
                </Text>
              )}

              {hasCoords ? (
                <>
                  <Box
                    borderRadius="md"
                    overflow="hidden"
                    border="1px solid"
                    borderColor="rgba(167,255,0,0.25)"
                    h={{ base: "240px", md: "260px" }}
                    boxShadow="0 0 16px rgba(167, 255, 0, 0.08)"
                  >
                    <iframe
                      src={buildMapEmbedSrc(spot.lat!, spot.lng!)}
                      style={{
                        border: "none",
                        width: "100%",
                        height: "100%",
                        display: "block",
                      }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      allowFullScreen
                      title="Spot location map"
                    />
                  </Box>
                  <HStack spacing={2} mt={1}>
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
                      flex={1}
                    >
                      Directions
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
                      flex={1}
                    >
                      Open in Maps
                    </Button>
                  </HStack>
                </>
              ) : spot.address ? (
                <Text fontSize="sm" color="gray.400">
                  📍 {spot.address}
                </Text>
              ) : (
                <Text fontSize="sm" color="gray.500" fontStyle="italic">
                  No coordinates available for this spot.
                </Text>
              )}
            </Box>
          </Box>
        </GridItem>
      </Grid>

      {/* Comments */}
      <Box maxW="4xl">
        <HStack mb={4} align="baseline" spacing={3}>
          <Heading
            as="h2"
            fontSize={{ base: "md", md: "lg" }}
            color="primary"
            textTransform="uppercase"
            letterSpacing="wide"
            fontWeight="800"
          >
            Comments
          </Heading>
          <Text
            fontSize="xs"
            color="gray.500"
            fontFamily="ui-monospace, monospace"
          >
            {comments.length + optimisticComments.length}
          </Text>
        </HStack>

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
          <Box
            py={8}
            textAlign="center"
            border="1px dashed"
            borderColor="whiteAlpha.200"
            borderRadius="md"
            color="gray.500"
          >
            <Text>No comments yet. Be the first to share your thoughts on this spot.</Text>
          </Box>
        ) : (
          <VStack spacing={3} align="stretch">
            {optimisticComments.map((c, i) => (
              <Box
                key={`optimistic-${i}`}
                p={2}
                bg="rgba(20,20,20,0.4)"
                opacity={0.85}
                borderLeft="3px solid"
                borderColor="primary"
                borderRadius="md"
              >
                <Snap discussion={c} onOpen={() => {}} setReply={() => {}} />
              </Box>
            ))}
            {comments.map((c) => (
              <Box
                key={c.permlink}
                p={2}
                bg="rgba(20,20,20,0.4)"
                border="1px solid"
                borderColor="whiteAlpha.50"
                borderRadius="md"
              >
                <Snap discussion={c} onOpen={() => {}} setReply={() => {}} />
              </Box>
            ))}
          </VStack>
        )}
      </Box>
    </Container>
  );
}
