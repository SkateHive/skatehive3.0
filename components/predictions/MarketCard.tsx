"use client";
import React from "react";
import NextLink from "next/link";
import { Badge, Box, Flex, Text, VStack } from "@chakra-ui/react";
import type { Market } from "@/lib/predictions/types";
import {
  closesLabel,
  isBinaryMarket,
  outcomeBreakdown,
  sliceColor,
  statusColor,
  totalPoolOf,
} from "./marketDisplay";

interface MarketCardProps {
  market: Market;
  now?: Date;
}

// hivepredict-styled market card. Handles both binary (YES/NO) and
// multi-outcome (O1..On) markets. Uses Chakra semantic tokens only so it
// adapts across every Skatehive theme.
export default function MarketCard({ market, now = new Date() }: MarketCardProps) {
  const slices = outcomeBreakdown(market);
  const total = totalPoolOf(market);
  const binary = isBinaryMarket(market);
  const leader = [...slices].sort((a, b) => b.pct - a.pct)[0];

  return (
    <Box
      as={NextLink}
      href={`/prediction-markets/${encodeURIComponent(market.id)}`}
      display="block"
      bg="panel"
      border="1px solid"
      borderColor="border"
      borderRadius="lg"
      p={4}
      transition="background 0.15s, transform 0.15s"
      _hover={{ bg: "panelHover", transform: "translateY(-2px)" }}
    >
      <VStack align="stretch" spacing={3}>
        <Flex justify="space-between" align="start" gap={2}>
          <Badge bg="subtle" color="text" textTransform="capitalize">
            {market.category || "market"}
          </Badge>
          <Flex gap={2} align="center">
            <Badge bg={market.token === "HBD" ? "accent" : "primary"} color="background">
              {market.token}
            </Badge>
            <Badge bg={statusColor(market.status)} color="background" textTransform="capitalize">
              {market.status}
            </Badge>
          </Flex>
        </Flex>

        <Text fontWeight={700} fontSize="md" color="text" noOfLines={2} minH="3rem">
          {market.title}
        </Text>

        {binary ? (
          // YES / NO split
          <Box>
            <Flex justify="space-between" mb={1}>
              {slices.map((s) => (
                <Text
                  key={s.code}
                  fontSize="xs"
                  color={s.code === "NO" ? "error" : "success"}
                  fontWeight={600}
                  noOfLines={1}
                >
                  {s.label} {s.pct}%
                </Text>
              ))}
            </Flex>
            <Flex h="6px" borderRadius="full" overflow="hidden" bg="subtle">
              {slices.map((s) => (
                <Box key={s.code} w={`${s.pct}%`} bg={s.code === "NO" ? "error" : "success"} />
              ))}
            </Flex>
          </Box>
        ) : (
          // Multi-outcome: leading option + stacked multi-color bar
          <Box>
            <Flex justify="space-between" mb={1} gap={2}>
              <Text fontSize="xs" color="text" fontWeight={600} noOfLines={1}>
                {leader ? `${leader.label} ${leader.pct}%` : "—"}
              </Text>
              <Text fontSize="xs" color="dim" flexShrink={0}>
                {market.outcomes.length} options
              </Text>
            </Flex>
            <Flex h="6px" borderRadius="full" overflow="hidden" bg="subtle">
              {slices.map((s, i) => (
                <Box key={s.code} w={`${s.pct}%`} bg={sliceColor(market, s.code, i)} />
              ))}
            </Flex>
          </Box>
        )}

        <Flex justify="space-between" align="center">
          <Text fontSize="xs" color="dim">
            Pool {total.toFixed(3)} {market.token}
          </Text>
          <Text fontSize="xs" color="dim">
            {closesLabel(market.bettingClosesAt, now)}
          </Text>
        </Flex>
      </VStack>
    </Box>
  );
}
