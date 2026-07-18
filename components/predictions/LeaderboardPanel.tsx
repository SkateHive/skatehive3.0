"use client";
import React, { useState } from "react";
import {
  Box,
  Button,
  Flex,
  HStack,
  Spinner,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "@/lib/i18n/hooks";
import { predictionKeys, predictionsApi } from "@/lib/predictions/api";
import type {
  LeaderboardBoard,
  LeaderboardEntry,
} from "@/lib/predictions/types";

const BOARDS: { value: LeaderboardBoard; labelKey: string }[] = [
  { value: "accuracy", labelKey: "boardAccuracy" },
  { value: "profit", labelKey: "boardProfit" },
  { value: "volume", labelKey: "boardVolume" },
  { value: "creators", labelKey: "boardCreators" },
];

// The headline metric shown per board.
function metric(board: LeaderboardBoard, e: LeaderboardEntry, mktsLabel: string): string {
  switch (board) {
    case "creators":
      return `${e.marketsCreated ?? 0} ${mktsLabel}`;
    case "profit":
      return `+${Number(e.profit ?? 0).toFixed(2)}`;
    case "accuracy":
      return `${Math.round(Number(e.winRate ?? 0) * 100)}%`;
    case "volume":
      return `${Number(e.volume ?? 0).toFixed(0)}`;
  }
}

export default function LeaderboardPanel() {
  const t = useTranslations("predictions");
  const [board, setBoard] = useState<LeaderboardBoard>("accuracy");

  const { data, isLoading } = useQuery({
    queryKey: predictionKeys.leaderboard(board),
    queryFn: () => predictionsApi.getLeaderboard(board, 10),
    staleTime: 60_000,
  });
  const entries = data?.entries ?? [];

  return (
    <Box bg="panel" border="1px solid" borderColor="border" borderRadius="lg" p={4}>
      <Text fontWeight={700} color="text" mb={3}>
        {t("leaderboard")}
      </Text>

      <Wrap spacing={1} mb={3}>
        {BOARDS.map((b) => (
          <WrapItem key={b.value}>
            <Button
              size="xs"
              variant={board === b.value ? "solid" : "outline"}
              bg={board === b.value ? "primary" : "transparent"}
              color={board === b.value ? "background" : "text"}
              borderColor="border"
              onClick={() => setBoard(b.value)}
            >
              {t(b.labelKey)}
            </Button>
          </WrapItem>
        ))}
      </Wrap>

      {isLoading ? (
        <Flex justify="center" py={6}>
          <Spinner color="primary" size="sm" />
        </Flex>
      ) : entries.length === 0 ? (
        <Text color="dim" fontSize="sm">
          {t("noRanked")}
        </Text>
      ) : (
        <VStack align="stretch" spacing={1}>
          {entries.map((e) => (
            <Flex key={e.username} justify="space-between" align="center" py={1}>
              <HStack spacing={2} minW={0}>
                <Text color="dim" fontSize="sm" w="1.5rem" flexShrink={0}>
                  {e.rank}
                </Text>
                <Text color="text" fontSize="sm" noOfLines={1}>
                  @{e.username}
                </Text>
              </HStack>
              <Text color="primary" fontWeight={600} fontSize="sm" flexShrink={0}>
                {metric(board, e, t("mkts"))}
              </Text>
            </Flex>
          ))}
        </VStack>
      )}
    </Box>
  );
}
