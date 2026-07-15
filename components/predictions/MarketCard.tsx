"use client";
import React from "react";
import NextLink from "next/link";
import { Badge, Box, Flex, Text, VStack } from "@chakra-ui/react";
import type { Market } from "@/lib/predictions/types";
import {
  closesLabel,
  outcomeLabel,
  poolNumbers,
  statusColor,
} from "./marketDisplay";

interface MarketCardProps {
  market: Market;
  now?: Date;
}

// hivepredict-styled market card. Uses Chakra semantic tokens only so it adapts
// across every Skatehive theme.
export default function MarketCard({ market, now = new Date() }: MarketCardProps) {
  const { yes, no, yesPct, noPct, total } = poolNumbers(market);
  const yesLabel = outcomeLabel(market, "YES");
  const noLabel = outcomeLabel(market, "NO");

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
          <Badge
            colorScheme="gray"
            bg="subtle"
            color="text"
            textTransform="capitalize"
          >
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

        {/* YES / NO probability split bar */}
        <Box>
          <Flex justify="space-between" mb={1}>
            <Text fontSize="xs" color="success" fontWeight={600} noOfLines={1}>
              {yesLabel} {yesPct}%
            </Text>
            <Text fontSize="xs" color="error" fontWeight={600} noOfLines={1}>
              {noLabel} {noPct}%
            </Text>
          </Flex>
          <Flex h="6px" borderRadius="full" overflow="hidden" bg="subtle">
            <Box w={`${yesPct}%`} bg="success" />
            <Box w={`${noPct}%`} bg="error" />
          </Flex>
        </Box>

        <Flex justify="space-between" align="center">
          <Text fontSize="xs" color="muted">
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
