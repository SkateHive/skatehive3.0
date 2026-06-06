"use client";

import React, { useMemo, useState } from "react";
import NextLink from "next/link";
import NextImage from "next/image";
import { Box, Flex, Text, Avatar, HStack, Badge } from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import { parseSpotBody } from "@/lib/utils/parseSpotBody";
import { getPostDate } from "@/lib/utils/GetPostDate";
import { getPayoutValue } from "@/lib/hive/client-functions";

interface SpotCardProps {
  spot: Discussion;
}

/**
 * Purpose-built card for a skate spot. Parses the spot body into clean
 * fields (name, location, description, hero image) instead of dumping
 * the raw markdown the way the generic homepage Snap does, and surfaces
 * the vote/comment/payout numbers as a compact footer.
 *
 * Click anywhere on the card → /spot/[author]/[permlink].
 */
function SpotCardImpl({ spot }: SpotCardProps) {
  const parsed = useMemo(() => parseSpotBody(spot.body), [spot.body]);
  const [imgErrored, setImgErrored] = useState(false);

  const href = `/spot/${spot.author}/${spot.permlink}`;
  const date = spot.created === "just now" ? "just now" : getPostDate(spot.created);
  const voteCount = spot.active_votes?.length ?? 0;
  const commentCount = spot.children ?? 0;
  const payoutRaw = parseFloat(getPayoutValue(spot));
  const payout = Number.isFinite(payoutRaw) ? payoutRaw.toFixed(2) : "0.00";

  const heroImage = !imgErrored ? parsed.images[0]?.url : null;
  const title = parsed.name?.trim() || spot.title || "Skate spot";
  const description = parsed.description?.trim();
  const locationLabel =
    parsed.lat != null && parsed.lng != null
      ? `${parsed.lat.toFixed(4)}, ${parsed.lng.toFixed(4)}`
      : parsed.address;

  return (
    <Box
      as={NextLink}
      href={href}
      bg="rgba(20,20,20,0.65)"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="lg"
      overflow="hidden"
      transition="transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease"
      _hover={{
        borderColor: "primary",
        transform: "translateY(-2px)",
        boxShadow: "0 12px 28px rgba(167, 255, 0, 0.18)",
      }}
      cursor="pointer"
      display="flex"
      flexDirection="column"
      role="article"
      aria-label={`Skate spot ${title}`}
      height="100%"
      sx={{
        // Subtle inner image zoom on hover, scoped to the card
        "&:hover .spot-card-hero img": { transform: "scale(1.04)" },
      }}
    >
      {/* Hero */}
      {heroImage ? (
        <Box
          className="spot-card-hero"
          position="relative"
          height="220px"
          overflow="hidden"
          bg="#0a0a0a"
        >
          <NextImage
            src={heroImage}
            alt={title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            style={{ objectFit: "cover", transition: "transform 0.3s ease" }}
            onError={() => setImgErrored(true)}
            unoptimized={heroImage.startsWith("https://ipfs.")}
          />
          {/* Title overlay over a bottom gradient */}
          <Box
            position="absolute"
            inset={0}
            background="linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.4) 35%, transparent 60%)"
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
              fontSize="lg"
              lineHeight="1.2"
              noOfLines={2}
              textShadow="0 2px 8px rgba(0,0,0,0.8)"
            >
              {title}
            </Text>
            {locationLabel && (
              <Badge
                bg="rgba(0,0,0,0.6)"
                color="primary"
                fontSize="10px"
                fontFamily="ui-monospace, monospace"
                textTransform="none"
                px={2}
                py={0.5}
                borderRadius="full"
                border="1px solid"
                borderColor="rgba(167,255,0,0.35)"
                flexShrink={0}
                aria-label="location"
              >
                📍 {locationLabel}
              </Badge>
            )}
          </Flex>
        </Box>
      ) : (
        // No-image fallback: full title block with the spot's coordinates
        <Box
          p={4}
          bg="linear-gradient(135deg, rgba(167,255,0,0.08) 0%, rgba(20,20,20,0.0) 100%)"
          borderBottom="1px solid"
          borderColor="whiteAlpha.100"
        >
          <Text color="primary" fontWeight="800" fontSize="lg" noOfLines={2} mb={1}>
            {title}
          </Text>
          {locationLabel && (
            <Text fontSize="xs" color="gray.400" fontFamily="ui-monospace, monospace">
              📍 {locationLabel}
            </Text>
          )}
        </Box>
      )}

      {/* Body */}
      <Flex direction="column" p={3} gap={2} flex={1}>
        <HStack spacing={2}>
          <Avatar
            size="xs"
            name={spot.author}
            src={`https://images.hive.blog/u/${spot.author}/avatar/sm`}
          />
          <Text fontSize="xs" color="gray.300" fontWeight="500">
            @{spot.author}
          </Text>
          <Text fontSize="xs" color="gray.600" aria-hidden>
            ·
          </Text>
          <Text fontSize="xs" color="gray.500">
            {date}
          </Text>
        </HStack>

        {description && (
          <Text
            fontSize="sm"
            color="gray.300"
            noOfLines={2}
            lineHeight="1.5"
            mt={1}
          >
            {description}
          </Text>
        )}

        {/* Spacer pushes the footer to the bottom of the card so a row of
            cards lines up neatly regardless of body height. */}
        <Box flex={1} />

        {/* Stats footer */}
        <Flex
          align="center"
          justify="space-between"
          pt={2}
          mt={1}
          borderTop="1px solid"
          borderColor="whiteAlpha.100"
        >
          <HStack spacing={4} fontSize="xs" color="gray.400">
            <HStack spacing={1} aria-label={`${voteCount} upvotes`}>
              <Text color="primary" fontWeight="bold">
                ↑
              </Text>
              <Text>{voteCount}</Text>
            </HStack>
            <HStack spacing={1} aria-label={`${commentCount} comments`}>
              <Text color="primary">💬</Text>
              <Text>{commentCount}</Text>
            </HStack>
            <HStack spacing={1} aria-label={`${payout} dollar payout`}>
              <Text color="primary">$</Text>
              <Text>{payout}</Text>
            </HStack>
          </HStack>
          <Text
            color="primary"
            fontSize="xs"
            fontWeight="bold"
            opacity={0.85}
            aria-hidden
          >
            View spot →
          </Text>
        </Flex>
      </Flex>
    </Box>
  );
}

const SpotCard = React.memo(SpotCardImpl);
export default SpotCard;
