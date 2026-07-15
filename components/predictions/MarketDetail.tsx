"use client";
import React, { useState } from "react";
import NextLink from "next/link";
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useAioha } from "@aioha/react-ui";
import { predictionKeys, predictionsApi } from "@/lib/predictions/api";
import { closesLabel, outcomeLabel, poolNumbers, statusColor } from "./marketDisplay";
import PlaceBetModal from "./PlaceBetModal";
import ConnectWalletPrompt from "./ConnectWalletPrompt";

export default function MarketDetail({ id }: { id: string }) {
  const { user } = useAioha();
  const [betOpen, setBetOpen] = useState(false);

  const { data: market, isLoading, isError } = useQuery({
    queryKey: predictionKeys.market(id),
    queryFn: () => predictionsApi.getMarket(id),
    staleTime: 10_000,
  });

  const { data: predictionsData } = useQuery({
    queryKey: predictionKeys.predictions(id),
    queryFn: () => predictionsApi.getPredictions(id, { limit: "20" }),
    enabled: !!market,
    staleTime: 10_000,
  });

  if (isLoading) {
    return (
      <Flex justify="center" py={20}>
        <Spinner color="primary" size="lg" />
      </Flex>
    );
  }

  if (isError || !market) {
    return (
      <VStack py={20} spacing={3}>
        <Text color="error">Market not found.</Text>
        <Button as={NextLink} href="/prediction-markets" variant="outline" borderColor="border" color="text">
          Back to markets
        </Button>
      </VStack>
    );
  }

  const { yes, no, yesPct, noPct, total } = poolNumbers(market);
  const canBet = market.status === "active";
  const predictions = predictionsData?.predictions ?? [];

  return (
    <Box maxW="820px" mx="auto" px={4} py={6}>
      <Button
        as={NextLink}
        href="/prediction-markets"
        variant="link"
        color="primary"
        mb={4}
        size="sm"
      >
        ← All markets
      </Button>

      <HStack mb={3} spacing={2}>
        <Badge bg="subtle" color="text" textTransform="capitalize">
          {market.category || "market"}
        </Badge>
        <Badge bg={market.token === "HBD" ? "accent" : "primary"} color="background">
          {market.token}
        </Badge>
        <Badge bg={statusColor(market.status)} color="background" textTransform="capitalize">
          {market.status}
        </Badge>
      </HStack>

      <Heading size="lg" color="text" mb={2}>
        {market.title}
      </Heading>
      {market.description && (
        <Text color="muted" mb={4} whiteSpace="pre-wrap">
          {market.description}
        </Text>
      )}

      {/* Pool split */}
      <Box bg="panel" border="1px solid" borderColor="border" borderRadius="lg" p={4} mb={4}>
        <Flex justify="space-between" mb={1}>
          <Text color="success" fontWeight={700}>
            {outcomeLabel(market, "YES")} · {yesPct}%
          </Text>
          <Text color="error" fontWeight={700}>
            {outcomeLabel(market, "NO")} · {noPct}%
          </Text>
        </Flex>
        <Flex h="10px" borderRadius="full" overflow="hidden" bg="subtle" mb={2}>
          <Box w={`${yesPct}%`} bg="success" />
          <Box w={`${noPct}%`} bg="error" />
        </Flex>
        <Flex justify="space-between">
          <Text fontSize="sm" color="muted">
            {yes.toFixed(3)} {market.token}
          </Text>
          <Text fontSize="sm" color="muted">
            {no.toFixed(3)} {market.token}
          </Text>
        </Flex>
        <Divider my={3} borderColor="border" />
        <Flex justify="space-between">
          <Text fontSize="sm" color="dim">
            Total pool {total.toFixed(3)} {market.token}
          </Text>
          <Text fontSize="sm" color="dim">
            {closesLabel(market.bettingClosesAt, new Date())}
          </Text>
        </Flex>
      </Box>

      {/* Bet action */}
      {canBet ? (
        user ? (
          <Button bg="primary" color="background" onClick={() => setBetOpen(true)} mb={6}>
            Place a bet
          </Button>
        ) : (
          <Box mb={6}>
            <ConnectWalletPrompt action="bet" />
          </Box>
        )
      ) : (
        <Text color="muted" mb={6}>
          This market is {market.status} and not open for betting.
        </Text>
      )}

      {/* Recent predictions */}
      {predictions.length > 0 && (
        <>
          <Heading size="sm" color="text" mb={2}>
            Recent predictions
          </Heading>
          <VStack align="stretch" spacing={1}>
            {predictions.map((p) => (
              <Flex
                key={p.id}
                justify="space-between"
                bg="panel"
                border="1px solid"
                borderColor="border"
                borderRadius="md"
                px={3}
                py={2}
              >
                <Text color="text" fontSize="sm">
                  @{p.hiveUsername}
                </Text>
                <HStack spacing={2}>
                  <Badge bg={p.outcome === "NO" ? "error" : "success"} color="background">
                    {p.outcome}
                  </Badge>
                  <Text color="muted" fontSize="sm">
                    {p.amount} {p.token}
                  </Text>
                </HStack>
              </Flex>
            ))}
          </VStack>
        </>
      )}

      <PlaceBetModal market={market} isOpen={betOpen} onClose={() => setBetOpen(false)} />
    </Box>
  );
}
