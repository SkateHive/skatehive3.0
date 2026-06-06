"use client";

import React, { forwardRef, useState } from "react";
import NextLink from "next/link";
import NextImage from "next/image";
import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { FaMapMarkedAlt } from "react-icons/fa";
import type { GeoSpot } from "@/hooks/useGeoSpots";

interface MapSpotCardProps {
  spot: GeoSpot;
  /** Whether this card's marker is currently hovered/selected on the map. */
  highlighted?: boolean;
  /** Fires when the user hovers/focuses the card so the map can highlight the matching marker. */
  onHover?: (id: string | null) => void;
  /** Fires on click of the card image — parent pans/zooms the map to this spot. */
  onSelect?: (spot: GeoSpot) => void;
}

/**
 * Compact card used in the Airbnb-style /map left column. Renders for both
 * Hive spots and Google-My-Maps spots — the source determines which action
 * buttons appear:
 *   - Hive: "View spot" (filled) + "Maps" (outline)
 *   - KML:  "Open in Google Maps" only
 *
 * Cards intentionally don't fetch live Hive data (vote/comment counts);
 * those live on the spot page. Keeping this component cheap lets the left
 * column render hundreds of cards without virtualisation.
 */
const MapSpotCard = forwardRef<HTMLDivElement, MapSpotCardProps>(function MapSpotCard(
  { spot, highlighted = false, onHover, onSelect },
  ref
) {
  const [imgErrored, setImgErrored] = useState(false);

  // Every spot in spotmap_spots has a (hive_author, hive_permlink) — Hive
  // spots use the real Hive identity, KML spots use the synthetic
  // "skatehive-map" author and the row uuid. Either way the URL pattern
  // is /spot/[author]/[permlink].
  const spotHref =
    spot.hiveAuthor && spot.hivePermlink
      ? `/spot/${spot.hiveAuthor}/${spot.hivePermlink}`
      : null;
  const mapsHref = `https://www.google.com/maps?q=${spot.lat},${spot.lng}`;
  const isHive = spot.source === "hive";

  // Image is always the primary click target. If we somehow lost the
  // author/permlink, fall back to Google Maps so the click still does
  // something useful.
  const imageHref = spotHref ?? mapsHref;
  const imageOpensExternal = !spotHref;

  const showImage = spot.thumbnail && !imgErrored;
  const subtitle = isHive ? (
    <>
      @{spot.hiveAuthor}
      {spot.created && <span style={{ opacity: 0.55 }}> · {formatRelative(spot.created)}</span>}
    </>
  ) : (
    <Box as="span" color="primary" fontWeight="700" letterSpacing="0.02em">
      Google My Maps
    </Box>
  );

  return (
    <Box
      ref={ref}
      bg="rgba(20,20,20,0.65)"
      border="2px solid"
      borderColor={highlighted ? "primary" : "whiteAlpha.100"}
      borderRadius="lg"
      overflow="hidden"
      transition="border-color 0.15s, transform 0.15s, box-shadow 0.15s"
      transform={highlighted ? "translateY(-2px)" : "translateY(0)"}
      boxShadow={highlighted ? "0 12px 28px rgba(167, 255, 0, 0.22)" : "none"}
      _hover={{
        borderColor: "primary",
        transform: "translateY(-2px)",
        boxShadow: "0 12px 28px rgba(167, 255, 0, 0.18)",
      }}
      onMouseEnter={() => onHover?.(spot.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(spot.id)}
      onBlur={() => onHover?.(null)}
      data-spot-id={spot.id}
      role="article"
    >
      {/* Image / title area — clickable, opens primary detail (spot page or
          Google Maps). The action buttons below live OUTSIDE this link so
          we don't nest <a>s, which is invalid HTML. */}
      <Box
        as={NextLink}
        href={imageHref}
        target={imageOpensExternal ? "_blank" : undefined}
        rel={imageOpensExternal ? "noopener noreferrer" : undefined}
        display="block"
        cursor="pointer"
        onClick={() => onSelect?.(spot)}
        sx={{
          "&, &:hover, &:focus, &:active, &:visited": {
            textDecoration: "none",
          },
        }}
      >
        {showImage ? (
          <Box position="relative" h="180px" overflow="hidden" bg="#0a0a0a">
            <NextImage
              src={spot.thumbnail!}
              alt={spot.name}
              fill
              sizes="(max-width: 768px) 100vw, 480px"
              style={{ objectFit: "cover" }}
              onError={() => setImgErrored(true)}
              unoptimized={spot.thumbnail!.startsWith("https://ipfs.")}
            />
            <Box
              position="absolute"
              inset={0}
              background="linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 35%, transparent 60%)"
              pointerEvents="none"
            />
            <Flex
              position="absolute"
              bottom={0}
              left={0}
              right={0}
              p={3}
              align="flex-end"
              justify="space-between"
              gap={2}
            >
              <Text
                color="primary"
                fontWeight="800"
                fontSize="md"
                lineHeight="1.2"
                noOfLines={2}
                textShadow="0 2px 8px rgba(0,0,0,0.85)"
                flex={1}
              >
                {spot.name}
              </Text>
            </Flex>
          </Box>
        ) : (
          <Box
            px={3}
            py={4}
            bg="linear-gradient(135deg, rgba(167,255,0,0.06) 0%, transparent 100%)"
            borderBottom="1px solid"
            borderColor="whiteAlpha.100"
          >
            <Text color="primary" fontWeight="800" fontSize="md" noOfLines={2}>
              {spot.name}
            </Text>
          </Box>
        )}

        <Box px={3} pt={2} pb={1}>
          <Text fontSize="xs" color="gray.400" noOfLines={1}>
            {subtitle}
          </Text>
        </Box>
      </Box>

      {/* Action buttons row — Hive spots get two; KML spots get one. */}
      <HStack spacing={2} px={3} pb={3} pt={2}>
        {spotHref && (
          <Button
            as={NextLink}
            href={spotHref}
            size="xs"
            bg="primary"
            color="background"
            fontWeight="800"
            flex={1}
            borderRadius="md"
            _hover={{ bg: "accent", color: "background" }}
            sx={{
              "&, &:hover, &:focus, &:active, &:visited": { textDecoration: "none" },
            }}
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            View spot →
          </Button>
        )}
        <Button
          as="a"
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          size="xs"
          variant="outline"
          borderColor="primary"
          color="primary"
          fontWeight="700"
          flex={1}
          borderRadius="md"
          leftIcon={<FaMapMarkedAlt />}
          _hover={{ bg: "primary", color: "background" }}
          sx={{
            "&, &:hover, &:focus, &:active, &:visited": { textDecoration: "none" },
          }}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          Maps
        </Button>
      </HStack>
    </Box>
  );
});

/** Tiny relative-time formatter — avoids importing dayjs/intl just for this. */
function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  if (s < 2629800) return `${Math.floor(s / 604800)}w`;
  return new Date(iso).toLocaleDateString();
}

export default MapSpotCard;
