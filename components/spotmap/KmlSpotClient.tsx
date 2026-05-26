"use client";

import React from "react";
import NextLink from "next/link";
import {
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
  Text,
} from "@chakra-ui/react";
import { ArrowBackIcon, ExternalLinkIcon } from "@chakra-ui/icons";
import { FaMapMarkedAlt } from "react-icons/fa";
import type { SpotmapRow } from "@/lib/spotmap/supabase";
import type { ParsedKmlDescription } from "@/lib/spotmap/parseKmlDescription";
import SpotImageCarousel, { type SpotImage } from "./SpotImageCarousel";

interface KmlSpotClientProps {
  spot: SpotmapRow;
  parsed: ParsedKmlDescription;
}

function buildMapEmbedSrc(lat: number, lng: number): string {
  return `https://maps.google.com/maps?q=${lat},${lng}&z=17&output=embed`;
}

function buildDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

function buildMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Spot page renderer for spots that come from the curated Google My Maps
 * dataset (source = 'google_my_maps' in spotmap_spots). They use the
 * synthetic author "skatehive-map" so the URL pattern is the same as
 * Hive-sourced spots, but there are no comments / votes / payout — the
 * dataset is a flat KML feed.
 */
export default function KmlSpotClient({ spot, parsed }: KmlSpotClientProps) {
  // Combine the thumbnail and any extra images from the description into
  // a single carousel set (deduped).
  const imageSet = new Set<string>();
  if (spot.thumbnail) imageSet.add(spot.thumbnail);
  for (const img of parsed.images) imageSet.add(img);
  const images: SpotImage[] = Array.from(imageSet).map((url) => ({ url, caption: "" }));

  const hasImages = images.length > 0;

  return (
    <Container maxW="7xl" px={{ base: 3, md: 6 }} py={{ base: 4, md: 6 }}>
      {/* Breadcrumb */}
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

      {/* Title */}
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
            {spot.name}
          </Heading>
          <Text fontSize="sm" color="gray.400">
            From the curated{" "}
            <Box as="span" color="primary" fontWeight="700">
              Google My Maps
            </Box>{" "}
            dataset · maintained by the Skatehive crew
          </Text>
        </Box>
        <HStack spacing={2} flexShrink={0}>
          <Button
            as="a"
            href={buildDirectionsUrl(spot.lat, spot.lng)}
            target="_blank"
            rel="noopener noreferrer"
            bg="primary"
            color="background"
            size="md"
            _hover={{ bg: "accent", color: "text" }}
            rightIcon={<ExternalLinkIcon />}
          >
            Directions
          </Button>
          <Button
            as="a"
            href={buildMapsUrl(spot.lat, spot.lng)}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            borderColor="primary"
            color="primary"
            size="md"
            leftIcon={<FaMapMarkedAlt />}
            _hover={{ bg: "primary", color: "background" }}
          >
            Maps
          </Button>
        </HStack>
      </Flex>

      {/* Two-column: carousel + about/location */}
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
            <SpotImageCarousel images={images} alt={spot.name} />
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
              {parsed.text ? (
                <Box
                  color="gray.200"
                  fontSize={{ base: "sm", md: "md" }}
                  lineHeight={1.65}
                  whiteSpace="pre-wrap"
                >
                  {parsed.text}
                </Box>
              ) : (
                <Text color="gray.500" fontSize="sm" fontStyle="italic">
                  No description provided in the source map.
                </Text>
              )}

              {parsed.links.length > 0 && (
                <Box mt={4}>
                  <Text fontSize="xs" color="gray.500" mb={2} textTransform="uppercase" letterSpacing="wide">
                    Links from this spot
                  </Text>
                  {parsed.links.slice(0, 5).map((href, i) => (
                    <Link
                      key={`${href}-${i}`}
                      href={href}
                      isExternal
                      display="block"
                      color="primary"
                      fontSize="sm"
                      noOfLines={1}
                      _hover={{ textDecoration: "underline" }}
                    >
                      ↗ {href}
                    </Link>
                  ))}
                </Box>
              )}
            </Box>

            <Divider borderColor="whiteAlpha.100" />

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
                <Text fontSize="xs" fontFamily="ui-monospace, monospace" color="gray.300">
                  {spot.lat.toFixed(5)}, {spot.lng.toFixed(5)}
                </Text>
              </Flex>

              <Box
                borderRadius="md"
                overflow="hidden"
                border="1px solid"
                borderColor="rgba(167,255,0,0.25)"
                h={{ base: "240px", md: "260px" }}
                boxShadow="0 0 16px rgba(167, 255, 0, 0.08)"
              >
                <iframe
                  src={buildMapEmbedSrc(spot.lat, spot.lng)}
                  style={{ border: "none", width: "100%", height: "100%", display: "block" }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  title="Spot location map"
                />
              </Box>
            </Box>
          </Box>
        </GridItem>
      </Grid>
    </Container>
  );
}
