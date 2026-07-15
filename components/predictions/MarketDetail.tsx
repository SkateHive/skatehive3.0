"use client";
import React from "react";
import NextLink from "next/link";
import {
  Badge,
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  HStack,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { predictionKeys, predictionsApi } from "@/lib/predictions/api";
import type { Market } from "@/lib/predictions/types";
import {
  closesLabel,
  outcomeBreakdown,
  sliceColor,
  statusColor,
  totalPoolOf,
} from "./marketDisplay";
import PlaceBetPanel from "./PlaceBetPanel";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Box bg="panel" border="1px solid" borderColor="border" borderRadius="md" p={3}>
      <Text fontSize="xs" color="dim" mb={1}>
        {label}
      </Text>
      <Text fontWeight={700} color="text" fontSize="sm">
        {value}
      </Text>
    </Box>
  );
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MarketInfoCard({ market }: { market: Market }) {
  const rows: [string, React.ReactNode][] = [
    ["Category", <Text as="span" textTransform="capitalize" key="c">{market.category || "—"}</Text>],
    ["Token", market.token],
    ["Resolution", market.resolutionType === "auto" ? "Auto" : "Manual"],
    [
      "Creator",
      market.creatorUsername ? `@${market.creatorUsername}` : "—",
    ],
    ["Min Participants", String(market.minParticipants ?? "—")],
    [
      "Stake Cap",
      market.stakeCap ? `${Number(market.stakeCap).toFixed(3)} ${market.token}` : "—",
    ],
  ];
  return (
    <Box bg="panel" border="1px solid" borderColor="border" borderRadius="lg" p={4}>
      <Text fontWeight={700} color="text" mb={3}>
        Market Info
      </Text>
      <VStack align="stretch" spacing={2}>
        {rows.map(([k, v]) => (
          <Flex key={k} justify="space-between" gap={3}>
            <Text fontSize="sm" color="dim">
              {k}
            </Text>
            <Text fontSize="sm" color="text" fontWeight={600} textAlign="right">
              {v}
            </Text>
          </Flex>
        ))}
      </VStack>
    </Box>
  );
}

export default function MarketDetail({ id }: { id: string }) {
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

  const slices = [...outcomeBreakdown(market)].sort((a, b) => b.pct - a.pct);
  const total = totalPoolOf(market);
  const predictions = predictionsData?.predictions ?? [];
  const forming =
    market.status === "pending" &&
    (market.minParticipants ?? 0) > 0 &&
    market.participantCount != null;

  return (
    <Box maxW="1280px" mx="auto" px={4} py={6}>
      <Button
        as={NextLink}
        href="/prediction-markets"
        variant="link"
        color="primary"
        mb={4}
        size="sm"
        sx={{ "&:hover": { textDecoration: "none !important" } }}
      >
        ← All markets
      </Button>

      <Flex gap={6} align="start" direction={{ base: "column", lg: "row" }}>
        {/* Main column */}
        <Box flex="1" minW={0} w="full">
          <HStack mb={3} spacing={2}>
            <Badge bg="subtle" color="text" textTransform="capitalize">
              {market.category || "market"}
            </Badge>
            <Badge bg={market.token === "HBD" ? "accent" : "primary"} color="background">
              {market.token}
            </Badge>
            <Badge bg={statusColor(market.status)} color="background" textTransform="capitalize">
              {market.status === "pending" ? "forming" : market.status}
            </Badge>
          </HStack>

          <Heading size="lg" color="text" mb={2}>
            {market.title}
          </Heading>
          {market.description && (
            <Text color="dim" mb={4} whiteSpace="pre-wrap">
              {market.description}
            </Text>
          )}

          {/* Outcome bar rows */}
          <VStack align="stretch" spacing={2} mb={4}>
            {slices.map((s, i) => {
              const color = sliceColor(
                market,
                s.code,
                outcomeBreakdown(market).findIndex((x) => x.code === s.code)
              );
              return (
                <Flex
                  key={s.code}
                  align="center"
                  gap={3}
                  bg="panel"
                  border="1px solid"
                  borderColor="border"
                  borderRadius="md"
                  px={4}
                  py={2.5}
                >
                  <Text
                    color="text"
                    fontWeight={600}
                    fontSize="sm"
                    w={{ base: "38%", md: "30%" }}
                    noOfLines={1}
                    flexShrink={0}
                  >
                    {s.label}
                  </Text>
                  <Flex flex="1" h="8px" borderRadius="full" overflow="hidden" bg="subtle">
                    <Box w={`${s.pct}%`} bg={color} />
                  </Flex>
                  <Text color={color} fontWeight={700} w="3.2rem" textAlign="right" flexShrink={0}>
                    {s.pct}%
                  </Text>
                  <Text color="dim" fontSize="xs" w="5.5rem" textAlign="right" flexShrink={0} display={{ base: "none", md: "block" }}>
                    {s.pool.toFixed(3)} {market.token}
                  </Text>
                </Flex>
              );
            })}
          </VStack>

          {/* Stat tiles */}
          <Grid templateColumns={{ base: "1fr 1fr", md: "repeat(4, 1fr)" }} gap={3} mb={4}>
            <StatTile label="Pool" value={`${total.toFixed(3)} ${market.token}`} />
            <StatTile
              label="Participants"
              value={market.participantCount != null ? String(market.participantCount) : "—"}
            />
            <StatTile
              label="Cutoff"
              value={closesLabel(market.bettingClosesAt, new Date()).replace("Closes in ", "") || "—"}
            />
            <StatTile label="Resolves At" value={fmtDate(market.resolvesAt)} />
          </Grid>

          {/* Forming notice */}
          {forming && (
            <Box
              bg="subtle"
              border="1px solid"
              borderColor="warning"
              borderRadius="md"
              p={3}
              mb={4}
            >
              <Text color="text" fontSize="sm">
                This market is forming. It activates at {market.minParticipants}+ unique
                participants.{" "}
                <b>
                  Current: {market.participantCount}/{market.minParticipants}
                </b>
                {(market.participantCount ?? 0) < (market.minParticipants ?? 0) &&
                  ` — needs ${(market.minParticipants ?? 0) - (market.participantCount ?? 0)} more.`}
              </Text>
            </Box>
          )}

          {/* Bet panel inline on mobile (sidebar hosts it on desktop) */}
          <Box display={{ base: "block", lg: "none" }} mb={4}>
            <PlaceBetPanel market={market} />
          </Box>

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
                        {market.outcomeLabels?.[p.outcome] || p.outcome}
                      </Badge>
                      <Text color="dim" fontSize="sm">
                        {p.amount} {p.token}
                      </Text>
                    </HStack>
                  </Flex>
                ))}
              </VStack>
            </>
          )}
        </Box>

        {/* Right sidebar: bet panel + market info */}
        <VStack
          as="aside"
          w={{ base: "full", lg: "340px" }}
          flexShrink={0}
          display={{ base: "none", lg: "flex" }}
          position="sticky"
          top="1rem"
          align="stretch"
          spacing={4}
        >
          <PlaceBetPanel market={market} />
          <MarketInfoCard market={market} />
        </VStack>
      </Flex>
    </Box>
  );
}
