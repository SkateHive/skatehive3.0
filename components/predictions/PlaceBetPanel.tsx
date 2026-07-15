"use client";
import React, { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  HStack,
  NumberInput,
  NumberInputField,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import usePlaceBet from "@/hooks/usePlaceBet";
import type { Market, MarketOutcome } from "@/lib/predictions/types";
import {
  estimatePayout,
  isBinaryMarket,
  outcomeBreakdown,
  outcomeLabel,
} from "./marketDisplay";
import ConnectWalletPrompt from "./ConnectWalletPrompt";

// Platform-wide minimum bet (matches hivepredict.app's UI).
const MIN_BET = 1;

// Always-visible bet card (hivepredict-style sidebar panel): outcome selector,
// amount, live Est. Return / Net Profit / Multiplier, then the broadcast CTA.
export default function PlaceBetPanel({ market }: { market: Market }) {
  const { user } = useAioha();
  const { placeBet, status, error, txId, isPending, dryRun, reset } =
    usePlaceBet(market);
  const binary = isBinaryMarket(market);
  const [outcome, setOutcome] = useState<MarketOutcome>(
    market.outcomes?.[0] ?? "YES"
  );
  const [stake, setStake] = useState<number>(1);

  const est = useMemo(
    () => estimatePayout(market, outcome, stake || 0),
    [market, outcome, stake]
  );

  const bettable = market.status === "active" || market.status === "pending";
  const belowMin = !stake || stake < MIN_BET;
  const cap = Number(market.stakeCap ?? 0) || 0;

  const handleConfirm = async () => {
    if (status === "success") reset();
    await placeBet({ outcome, stake });
  };

  if (!bettable) {
    return (
      <Box bg="panel" border="1px solid" borderColor="border" borderRadius="lg" p={4}>
        <Text fontWeight={700} color="text" mb={1}>
          Place Prediction
        </Text>
        <Text color="dim" fontSize="sm">
          This market is {market.status} and not open for betting.
        </Text>
      </Box>
    );
  }

  return (
    <Box bg="panel" border="1px solid" borderColor="border" borderRadius="lg" p={4}>
      <Flex justify="space-between" align="center" mb={3}>
        <Text fontWeight={700} color="text">
          Place Prediction
        </Text>
        {dryRun && (
          <Badge bg="warning" color="background">
            DRY RUN
          </Badge>
        )}
      </Flex>

      {!user ? (
        <ConnectWalletPrompt action="bet" />
      ) : (
        <VStack align="stretch" spacing={3}>
          {binary ? (
            <HStack spacing={2}>
              {market.outcomes.map((o) => (
                <Button
                  key={o}
                  flex={1}
                  size="sm"
                  variant={outcome === o ? "solid" : "outline"}
                  bg={outcome === o ? (o === "NO" ? "error" : "success") : "transparent"}
                  color={outcome === o ? "background" : "text"}
                  borderColor="border"
                  onClick={() => setOutcome(o)}
                >
                  {outcomeLabel(market, o)}
                </Button>
              ))}
            </HStack>
          ) : (
            <Select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              bg="inputBg"
              borderColor="inputBorder"
              size="sm"
            >
              {outcomeBreakdown(market).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label} — {s.pct}%
                </option>
              ))}
            </Select>
          )}

          <Box>
            <Text fontSize="sm" color="dim" mb={1}>
              Amount ({market.token})
            </Text>
            <NumberInput
              min={0}
              precision={3}
              value={stake}
              onChange={(_, n) => setStake(Number.isNaN(n) ? 0 : n)}
              size="sm"
            >
              <NumberInputField bg="inputBg" borderColor="inputBorder" />
            </NumberInput>
            <Flex justify="space-between" mt={1}>
              <Text fontSize="xs" color="dim">
                Minimum bet: {MIN_BET.toFixed(3)} {market.token}
              </Text>
              {cap > 0 && (
                <Text fontSize="xs" color="dim">
                  Cap: {cap.toFixed(3)} {market.token}
                </Text>
              )}
            </Flex>
          </Box>

          {/* Payout estimate */}
          <Box bg="subtle" borderRadius="md" p={3}>
            <Flex justify="space-between" mb={1}>
              <Text fontSize="sm" color="dim">
                Est. Return
              </Text>
              <Text fontSize="sm" color="text" fontWeight={700}>
                {est.payout.toFixed(3)} {market.token}
              </Text>
            </Flex>
            <Flex justify="space-between" mb={1}>
              <Text fontSize="sm" color="dim">
                Net Profit
              </Text>
              <Text
                fontSize="sm"
                fontWeight={700}
                color={est.profit >= 0 ? "success" : "error"}
              >
                {est.profit >= 0 ? "+" : ""}
                {est.profit.toFixed(3)} {market.token}
              </Text>
            </Flex>
            <Flex justify="space-between">
              <Text fontSize="sm" color="dim">
                Multiplier
              </Text>
              <Text fontSize="sm" color="text" fontWeight={700}>
                {est.multiplier.toFixed(2)}x
              </Text>
            </Flex>
            <Divider my={2} borderColor="border" />
            <Text fontSize="xs" color="dim">
              Based on current pools. Actual payout may vary.
            </Text>
          </Box>

          <Button
            bg="primary"
            color="background"
            size="md"
            isLoading={isPending}
            isDisabled={belowMin}
            onClick={handleConfirm}
          >
            {dryRun
              ? "Simulate bet"
              : `Bet ${outcomeLabel(market, outcome)}`}
          </Button>

          {error && (
            <Text color="error" fontSize="sm">
              {error}
            </Text>
          )}
          {status === "success" && (
            <VStack align="stretch" spacing={2}>
              <Text color="success" fontSize="sm">
                {dryRun
                  ? "Dry run complete — see console for the transaction ops."
                  : `Bet placed!${txId ? ` (${txId})` : ""}`}
              </Text>
              {!dryRun && (
                <Button
                  size="xs"
                  variant="outline"
                  borderColor="border"
                  color="text"
                  onClick={() => {
                    const url = `${window.location.origin}/prediction-markets/${encodeURIComponent(market.id)}`;
                    navigator.clipboard.writeText(
                      `I just bet ${stake.toFixed(3)} ${market.token} on "${outcomeLabel(market, outcome)}" 🎯\n${url}`
                    );
                  }}
                >
                  Copy bet to share in a snap
                </Button>
              )}
            </VStack>
          )}
        </VStack>
      )}
    </Box>
  );
}
