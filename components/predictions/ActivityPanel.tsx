"use client";
import React from "react";
import {
  Box,
  Flex,
  HStack,
  Link,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { predictionKeys, predictionsApi } from "@/lib/predictions/api";
import type { ActivityEvent } from "@/lib/predictions/types";

// Compact one-glance icon per event type.
const EVENT_ICON: Record<string, string> = {
  bet_placed: "🎯",
  market_created: "✨",
  cash_out: "💸",
  cashout: "💸",
  refund: "↩️",
  market_resolved: "✅",
  resolved: "✅",
  payout: "💰",
};

// Bold headline: who did what (without the market title — that gets its own
// dim line below, so long titles don't drown the action).
function headline(e: ActivityEvent): string {
  const who = `@${e.account ?? "someone"}`;
  const amt = e.amount ? `${e.amount} ${e.token ?? ""}`.trim() : "";
  switch (e.eventType) {
    case "bet_placed":
      return `${who} · ${amt} on ${e.outcome ?? "?"}`;
    case "market_created":
      return `${who} created a market`;
    case "cash_out":
    case "cashout":
      return `${who} cashed out ${amt}`;
    case "refund":
      return `${who} refunded ${amt}`;
    case "market_resolved":
    case "resolved":
      return `Resolved${e.resolvedOutcome ? `: ${e.resolvedOutcome}` : ""}`;
    case "payout":
      return `${who} won ${amt}`;
    default:
      return who;
  }
}

// Short relative time: "2h", "3d", "35m".
function ago(iso?: string): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export default function ActivityPanel() {
  const { data, isLoading } = useQuery({
    queryKey: predictionKeys.activity(),
    queryFn: () => predictionsApi.getActivity(10),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
  const events = data?.events ?? [];

  return (
    <Box bg="panel" border="1px solid" borderColor="border" borderRadius="lg" p={4}>
      <Text fontWeight={700} color="text" mb={3}>
        Activity
      </Text>

      {isLoading ? (
        <Flex justify="center" py={6}>
          <Spinner color="primary" size="sm" />
        </Flex>
      ) : events.length === 0 ? (
        <Text color="dim" fontSize="sm">
          No recent activity.
        </Text>
      ) : (
        <VStack align="stretch" spacing={2.5}>
          {events.map((e) => (
            <HStack key={e.id} align="start" spacing={2}>
              <Text as="span" fontSize="sm" lineHeight="1.4" flexShrink={0}>
                {EVENT_ICON[e.eventType] ?? "•"}
              </Text>
              <Box minW={0} flex="1">
                <Flex justify="space-between" align="baseline" gap={2}>
                  <Text color="text" fontSize="xs" fontWeight={600} noOfLines={1}>
                    {headline(e)}
                  </Text>
                  <HStack spacing={1.5} flexShrink={0}>
                    <Text color="dim" fontSize="2xs">
                      {ago(e.createdAt)}
                    </Text>
                    {e.txId && (
                      <Link
                        href={`https://hivehub.dev/tx/${e.txId}`}
                        isExternal
                        color="primary"
                        fontSize="2xs"
                        sx={{ "&:hover": { textDecoration: "none !important" } }}
                      >
                        tx
                      </Link>
                    )}
                  </HStack>
                </Flex>
                {e.marketTitle && (
                  <Text color="dim" fontSize="2xs" noOfLines={1}>
                    {e.marketTitle}
                  </Text>
                )}
              </Box>
            </HStack>
          ))}
        </VStack>
      )}
    </Box>
  );
}
