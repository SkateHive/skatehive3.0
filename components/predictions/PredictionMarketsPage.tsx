"use client";
import React, { useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
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

  const query = useMemo(() => {
    const q: Record<string, string> = {
      ...PREDICTIONS_CONFIG.upstreamQuery,
      page: String(page),
      limit: String(PAGE_SIZE),
    };
    if (status !== "all") q.status = status;
    return q;
  }, [status, page]);

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
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Box maxW="1100px" mx="auto" px={4} py={6}>
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
      <Text color="muted" mb={5}>
        Parimutuel prediction markets on Hive, powered by hivepredict.
      </Text>

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
          <Text color="muted" fontSize="sm">
            {(error as Error)?.message}
          </Text>
        </VStack>
      ) : markets.length === 0 ? (
        <VStack py={16} spacing={2}>
          <Text color="muted">No markets found.</Text>
        </VStack>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={4}>
          {markets.map((m) => (
            <MarketCard key={m.id} market={m} />
          ))}
        </SimpleGrid>
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
          <Text color="muted" fontSize="sm">
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

      <CreateMarketModal isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </Box>
  );
}
