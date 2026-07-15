"use client";
import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Link,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useAioha } from "@aioha/react-ui";
import { predictionKeys, predictionsApi } from "@/lib/predictions/api";
import { PREDICTIONS_CONFIG, applyTitleFilter } from "@/lib/predictions/config";
import type { MarketStatus } from "@/lib/predictions/types";
import MarketCard from "./MarketCard";
import CreateMarketModal from "./CreateMarketModal";
import LeaderboardPanel from "./LeaderboardPanel";
import ActivityPanel from "./ActivityPanel";

const PAGE_SIZE = 24;

const STATUS_FILTERS: { label: string; value: MarketStatus | "all" }[] = [
  { label: "Active", value: "active" },
  { label: "Upcoming", value: "pending" },
  { label: "Resolved", value: "resolved" },
  { label: "All", value: "all" },
];

export default function PredictionMarketsPage() {
  const { user } = useAioha();
  const [status, setStatus] = useState<MarketStatus | "all">("active");
  const [page, setPage] = useState(1);
  const [isCreateOpen, setCreateOpen] = useState(false);

  // Resolved shows a compact recent set (last 12); other views paginate fully.
  const pageSize = status === "resolved" ? 12 : PAGE_SIZE;

  const query = useMemo(() => {
    const q: Record<string, string> = {
      ...PREDICTIONS_CONFIG.upstreamQuery,
      page: String(page),
      limit: String(pageSize),
    };
    if (status !== "all") q.status = status;
    return q;
  }, [status, page, pageSize]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: predictionKeys.markets(query),
    queryFn: () => predictionsApi.listMarkets(query),
    staleTime: 15_000,
  });

  const markets = useMemo(
    () => applyTitleFilter(data?.markets ?? []),
    [data]
  );
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // When the Active list is short, fill the page with an "Upcoming" section
  // (pending markets) instead of leaving it blank.
  const showUpcoming =
    status === "active" && !isLoading && !isError && markets.length < 9;
  const upcomingQuery = useMemo(
    () => ({
      ...PREDICTIONS_CONFIG.upstreamQuery,
      status: "pending",
      page: "1",
      limit: "9",
    }),
    []
  );
  const { data: upcomingData } = useQuery({
    queryKey: predictionKeys.markets(upcomingQuery),
    queryFn: () => predictionsApi.listMarkets(upcomingQuery),
    enabled: showUpcoming,
    staleTime: 30_000,
  });
  const upcoming = useMemo(
    () => applyTitleFilter(upcomingData?.markets ?? []),
    [upcomingData]
  );

  return (
    <Box maxW="1280px" mx="auto" px={4} py={6}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={3} mb={2}>
        <Heading size="lg" color="text">
          Prediction Markets
        </Heading>
        {user && (
          <Button
            size="sm"
            bg="primary"
            color="background"
            _hover={{ opacity: 0.9 }}
            onClick={() => setCreateOpen(true)}
          >
            Create market
          </Button>
        )}
      </Flex>
      <Text color="dim" mb={5}>
        Parimutuel prediction markets on Hive, powered by{" "}
        <Link
          href="https://hivepredict.app/"
          isExternal
          fontWeight={600}
          sx={{
            // HivePredict brand red in every state — the global anchor styles
            // would otherwise recolor it on hover/visited and underline it.
            color: "#E31337 !important",
            "&:hover": {
              textDecoration: "none !important",
              color: "#E31337 !important",
              opacity: 0.85,
            },
            "&:visited": { color: "#E31337 !important" },
          }}
        >
          HivePredict
        </Link>
        .
      </Text>

      <Flex gap={6} align="start">
        {/* Markets — center column */}
        <Box flex="1" minW={0}>
          <HStack spacing={2} mb={5} wrap="wrap">
            {STATUS_FILTERS.map((f) => (
              <Button
                key={f.value}
                size="sm"
                variant={status === f.value ? "solid" : "outline"}
                bg={status === f.value ? "primary" : "transparent"}
                color={status === f.value ? "background" : "text"}
                borderColor="border"
                onClick={() => {
                  setStatus(f.value);
                  setPage(1);
                }}
              >
                {f.label}
              </Button>
            ))}
          </HStack>

          {isLoading ? (
            <Flex justify="center" py={16}>
              <Spinner color="primary" size="lg" />
            </Flex>
          ) : isError ? (
            <VStack py={16} spacing={2}>
              <Text color="error">Failed to load markets.</Text>
              <Text color="dim" fontSize="sm">
                {(error as Error)?.message}
              </Text>
            </VStack>
          ) : markets.length === 0 ? (
            <VStack py={16} spacing={2}>
              <Text color="dim">No markets found.</Text>
            </VStack>
          ) : (
            <VStack align="stretch" spacing={3}>
              {markets.map((m) => (
                <MarketCard key={m.id} market={m} />
              ))}
            </VStack>
          )}

          {showUpcoming && upcoming.length > 0 && (
            <Box mt={8}>
              <Flex justify="space-between" align="center" mb={3}>
                <Heading size="sm" color="text">
                  Upcoming
                </Heading>
                <Button
                  size="xs"
                  variant="link"
                  color="primary"
                  onClick={() => {
                    setStatus("pending");
                    setPage(1);
                  }}
                >
                  View all
                </Button>
              </Flex>
              <VStack align="stretch" spacing={3}>
                {upcoming.map((m) => (
                  <MarketCard key={m.id} market={m} />
                ))}
              </VStack>
            </Box>
          )}

          {totalPages > 1 && (
            <Flex justify="center" align="center" gap={4} mt={8}>
              <Button
                size="sm"
                variant="outline"
                borderColor="border"
                color="text"
                isDisabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Text color="dim" fontSize="sm">
                Page {page} of {totalPages}
              </Text>
              <Button
                size="sm"
                variant="outline"
                borderColor="border"
                color="text"
                isDisabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </Flex>
          )}
        </Box>

        {/* Right sidebar (wide screens): Activity + Leaderboard widgets. */}
        <VStack
          as="aside"
          w="300px"
          flexShrink={0}
          display={{ base: "none", lg: "flex" }}
          position="sticky"
          top="1rem"
          align="stretch"
          spacing={4}
        >
          <ActivityPanel />
          <LeaderboardPanel />
        </VStack>
      </Flex>

      <CreateMarketModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  );
}
