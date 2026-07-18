"use client";
import React from "react";
import NextLink from "next/link";
import { Badge, Box, Flex, HStack, Text } from "@chakra-ui/react";
import type { Market } from "@/lib/predictions/types";
import { useTranslations } from "@/lib/i18n/hooks";
import {
  closesInfo,
  formatCloses,
  isBinaryMarket,
  marketHeat,
  outcomeBreakdown,
  sliceColor,
  statusColor,
  totalPoolOf,
} from "./marketDisplay";

interface MarketCardProps {
  market: Market;
  now?: Date;
}

// Full-width row card (one market per row): title + badges up top, the full
// outcome split bar, then a stats line. Handles binary (YES/NO) and
// multi-outcome (O1..On) markets. Chakra semantic tokens only, so it adapts
// across every Skatehive theme.
export default function MarketCard({ market, now = new Date() }: MarketCardProps) {
  const t = useTranslations("predictions");
  const slices = outcomeBreakdown(market);
  const total = totalPoolOf(market);
  const binary = isBinaryMarket(market);
  const ranked = [...slices].sort((a, b) => b.pct - a.pct);
  const heat = marketHeat(market, now);
  // Row layout has room for a few leaders, not just one.
  const leaders = binary ? slices : ranked.slice(0, 3);
  const moreCount = binary ? 0 : Math.max(0, slices.length - 3);

  return (
    <Box
      as={NextLink}
      href={`/hivepredict/${encodeURIComponent(market.id)}`}
      display="block"
      bg="panel"
      border="1px solid"
      borderColor="border"
      borderRadius="lg"
      px={4}
      py={3}
      transition="background 0.15s, transform 0.15s"
      _hover={{ bg: "panelHover", transform: "translateY(-1px)" }}
      sx={{
        // The global theme underlines anchors on hover; this card is one big
        // anchor, so that would underline every line of text in it.
        "&:hover": { textDecoration: "none !important" },
      }}
    >
      {/* Header: category + heat left, token/status right */}
      <Flex justify="space-between" align="center" gap={2} mb={1.5}>
        <HStack spacing={2} minW={0}>
          <Badge bg="subtle" color="text" textTransform="capitalize">
            {market.category || "market"}
          </Badge>
          {heat.emojis && (
            <Text
              as="span"
              fontSize="sm"
              lineHeight={1}
              title={[
                heat.fire ? t("hotTooltip") : "",
                heat.closingSoon ? t("closingSoonTooltip") : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              {heat.emojis}
            </Text>
          )}
        </HStack>
        <HStack spacing={2} flexShrink={0}>
          <Badge bg={market.token === "HBD" ? "accent" : "primary"} color="background">
            {market.token}
          </Badge>
          <Badge bg={statusColor(market.status)} color="background" textTransform="capitalize">
            {market.status}
          </Badge>
        </HStack>
      </Flex>

      {/* Title — full width, no truncation squeeze */}
      <Text fontWeight={700} fontSize="md" color="text" noOfLines={2} mb={2}>
        {market.title}
      </Text>

      {/* Leaders line: top outcomes with label + % */}
      <Flex wrap="wrap" columnGap={4} rowGap={1} mb={1.5}>
        {leaders.map((s) => {
          const i = slices.findIndex((x) => x.code === s.code);
          return (
            <HStack key={s.code} spacing={1.5} minW={0}>
              <Box
                w="8px"
                h="8px"
                borderRadius="sm"
                bg={sliceColor(market, s.code, i)}
                flexShrink={0}
              />
              <Text fontSize="sm" color="text" noOfLines={1}>
                {s.label}
              </Text>
              <Text fontSize="sm" color="text" fontWeight={700}>
                {s.pct}%
              </Text>
            </HStack>
          );
        })}
        {moreCount > 0 && (
          <Text fontSize="sm" color="dim">
            +{moreCount} {t("more")}
          </Text>
        )}
      </Flex>

      {/* Full-width stacked split bar */}
      <Flex h="8px" borderRadius="full" overflow="hidden" bg="subtle" mb={2}>
        {slices.map((s, i) => (
          <Box key={s.code} w={`${s.pct}%`} bg={sliceColor(market, s.code, i)} />
        ))}
      </Flex>

      {/* Stats line */}
      <Flex justify="space-between" align="center" wrap="wrap" gap={2}>
        <HStack spacing={3}>
          <Text fontSize="xs" color="dim">
            {t("pool")} <b>{total.toFixed(3)} {market.token}</b>
          </Text>
          <Text fontSize="xs" color="dim">
            {slices.length} {t("outcomes")}
          </Text>
          {market.creatorUsername && (
            <Text fontSize="xs" color="dim">
              {t("by")} @{market.creatorUsername}
            </Text>
          )}
        </HStack>
        <Text
          fontSize="xs"
          color={heat.closingSoon ? "warning" : "dim"}
          fontWeight={heat.closingSoon ? 600 : undefined}
        >
          {formatCloses(closesInfo(market.bettingClosesAt, now), t)}
        </Text>
      </Flex>
    </Box>
  );
}
