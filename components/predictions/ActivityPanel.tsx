"use client";
import React from "react";
import {
  Badge,
  Box,
  Flex,
  Link,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { predictionKeys, predictionsApi } from "@/lib/predictions/api";
import type { ActivityEvent } from "@/lib/predictions/types";

// Human label + badge text for each event type.
const EVENT_LABEL: Record<string, string> = {
  bet_placed: "Bet Placed",
  market_created: "Market Created",
  cash_out: "Cash-Out",
  cashout: "Cash-Out",
  refund: "Refund",
  market_resolved: "Resolved",
  resolved: "Resolved",
  payout: "Payout",
};

function line(e: ActivityEvent): string {
  const who = `@${e.account ?? "someone"}`;
  const amt = e.amount ? `${e.amount} ${e.token ?? ""}`.trim() : "";
  const title = e.marketTitle ? `"${e.marketTitle}"` : "a market";
  switch (e.eventType) {
    case "bet_placed":
      return `${who} placed ${amt} on ${e.outcome ?? "?"} in ${title}`;
    case "market_created":
      return `${who} created market ${title}`;
    case "cash_out":
    case "cashout":
      return `${who} cashed out ${amt} from ${title}`;
    case "refund":
      return `${who} was refunded ${amt} from ${title}`;
    case "market_resolved":
    case "resolved":
      return `${title} resolved${e.resolvedOutcome ? `: ${e.resolvedOutcome}` : ""}`;
    case "payout":
      return `${who} received ${amt} from ${title}`;
    default:
      return `${who} — ${title}`;
  }
}

function fmtTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityPanel() {
  const { data, isLoading } = useQuery({
    queryKey: predictionKeys.activity(),
    queryFn: () => predictionsApi.getActivity(10),
    staleTime: 15_000,
  });
  const events = data?.events ?? [];

  return (
    <Box bg="panel" border="1px solid" borderColor="border" borderRadius="lg" p={4}>
      <Text fontWeight={700} color="text" mb={3}>
        Platform activity
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
        <VStack align="stretch" spacing={3}>
          {events.map((e) => (
            <Box key={e.id} borderBottom="1px solid" borderColor="border" pb={2}>
              <Text color="text" fontSize="sm" mb={1}>
                {line(e)}
              </Text>
              <Flex justify="space-between" align="center" gap={2}>
                <Badge bg="subtle" color="text" fontSize="0.6rem">
                  {EVENT_LABEL[e.eventType] ?? e.eventType}
                </Badge>
                <Flex gap={2} align="center" flexShrink={0}>
                  <Text color="dim" fontSize="xs">
                    {fmtTime(e.createdAt)}
                  </Text>
                  {e.txId && (
                    <Link
                      href={`https://hivehub.dev/tx/${e.txId}`}
                      isExternal
                      color="primary"
                      fontSize="xs"
                    >
                      tx
                    </Link>
                  )}
                </Flex>
              </Flex>
            </Box>
          ))}
        </VStack>
      )}
    </Box>
  );
}
