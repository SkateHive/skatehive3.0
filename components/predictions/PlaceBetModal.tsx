"use client";
import React, { useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Flex,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  NumberInput,
  NumberInputField,
  Select,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import usePlaceBet from "@/hooks/usePlaceBet";
import type { Market, MarketOutcome } from "@/lib/predictions/types";
import { isBinaryMarket, outcomeBreakdown, outcomeLabel, totalPoolOf } from "./marketDisplay";
import ConnectWalletPrompt from "./ConnectWalletPrompt";

interface PlaceBetModalProps {
  market: Market;
  isOpen: boolean;
  onClose: () => void;
}

// Rough parimutuel payout estimate if `outcome` wins: your stake back plus a
// proportional share of the rest of the pool. Works for binary and
// multi-outcome markets (lose pool = total pool minus the chosen outcome).
function estimatePayout(
  market: Market,
  outcome: MarketOutcome,
  stake: number
): number {
  const slices = outcomeBreakdown(market);
  const winPool = slices.find((s) => s.code === outcome)?.pool ?? 0;
  const losePool = Math.max(0, totalPoolOf(market) - winPool);
  const newWinPool = winPool + stake;
  if (newWinPool <= 0) return stake;
  return stake + (stake / newWinPool) * losePool;
}

export default function PlaceBetModal({ market, isOpen, onClose }: PlaceBetModalProps) {
  const { user } = useAioha();
  const { placeBet, status, error, txId, isPending, dryRun, reset } =
    usePlaceBet(market);
  const binary = isBinaryMarket(market);
  const [outcome, setOutcome] = useState<MarketOutcome>(market.outcomes?.[0] ?? "YES");
  const [stake, setStake] = useState<number>(1);

  const payout = useMemo(
    () => estimatePayout(market, outcome, stake || 0),
    [market, outcome, stake]
  );

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = async () => {
    const res = await placeBet({ outcome, stake });
    if (res?.success && !res.dryRun) {
      // Leave the success state visible briefly, then close.
      setTimeout(handleClose, 1500);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered>
      <ModalOverlay />
      <ModalContent bg="panel" color="text">
        <ModalHeader>
          Place a bet
          {dryRun && (
            <Badge ml={2} bg="warning" color="background">
              DRY RUN
            </Badge>
          )}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {!user ? (
            <ConnectWalletPrompt action="bet" />
          ) : (
            <VStack align="stretch" spacing={4}>
              <Text fontWeight={600}>{market.title}</Text>

              {binary ? (
                <HStack spacing={2}>
                  {market.outcomes.map((o) => (
                    <Button
                      key={o}
                      flex={1}
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
                <Box>
                  <Text fontSize="sm" color="muted" mb={1}>
                    Choose an outcome
                  </Text>
                  <Select
                    value={outcome}
                    onChange={(e) => setOutcome(e.target.value)}
                    bg="inputBg"
                    borderColor="inputBorder"
                  >
                    {outcomeBreakdown(market).map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.label} — {s.pct}%
                      </option>
                    ))}
                  </Select>
                </Box>
              )}

              <Box>
                <Text fontSize="sm" color="muted" mb={1}>
                  Stake ({market.token})
                </Text>
                <NumberInput
                  min={0}
                  precision={3}
                  value={stake}
                  onChange={(_, n) => setStake(Number.isNaN(n) ? 0 : n)}
                >
                  <NumberInputField bg="inputBg" borderColor="inputBorder" />
                </NumberInput>
              </Box>

              <Flex justify="space-between">
                <Text color="muted" fontSize="sm">
                  Est. payout if {outcomeLabel(market, outcome)} wins
                </Text>
                <Text fontWeight={700} color="success">
                  {payout.toFixed(3)} {market.token}
                </Text>
              </Flex>

              {error && (
                <Text color="error" fontSize="sm">
                  {error}
                </Text>
              )}
              {status === "success" && (
                <Text color="success" fontSize="sm">
                  {dryRun
                    ? "Dry run complete — see console for the transaction ops."
                    : `Bet placed!${txId ? ` (${txId})` : ""}`}
                </Text>
              )}
            </VStack>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose} color="text">
            Close
          </Button>
          {user && (
            <Button
              bg="primary"
              color="background"
              isLoading={isPending}
              isDisabled={!stake || stake <= 0}
              onClick={handleConfirm}
            >
              {dryRun ? "Simulate bet" : "Confirm bet"}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
