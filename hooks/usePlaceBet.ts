"use client";
import { useCallback, useRef, useState } from "react";
import { useAioha } from "@aioha/react-ui";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { predictionKeys, predictionsApi } from "@/lib/predictions/api";
import { buildPlaceBetOps } from "@/lib/predictions/operations";
import { validateBet } from "@/lib/predictions/validation";
import { selectBroadcaster } from "@/lib/predictions/broadcast";
import type { Market, MarketOutcome } from "@/lib/predictions/types";

type Status = "idle" | "pending" | "success" | "error";

export interface PlaceBetInput {
  outcome: MarketOutcome;
  stake: number;
}

// Wallet-only bet flow. Gated on an Aioha wallet (active-auth is required to
// move funds — lite/posting-only accounts cannot bet). Runs the pure preflight
// before broadcasting the [transfer, custom_json] pair in one transaction.
export default function usePlaceBet(market: Market) {
  const { user, aioha } = useAioha();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const dryRun = searchParams?.get("dryRun") === "1";

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  // Synchronous in-flight guard: React state updates are async, so a fast
  // double-click could otherwise start two broadcasts before `status` flips.
  const inFlightRef = useRef(false);

  const needsWallet = !user;

  const placeBet = useCallback(
    async ({ outcome, stake }: PlaceBetInput) => {
      if (inFlightRef.current) {
        return { success: false };
      }
      inFlightRef.current = true;
      setStatus("pending");
      setError(null);
      setTxId(null);

      try {
        if (!user) {
          setStatus("error");
          setError("Connect a Hive wallet to place a bet.");
          return { success: false };
        }

        // The outcome comes from UI state — never build ops for an outcome
        // this market doesn't have.
        if (!market.outcomes?.includes(outcome)) {
          setStatus("error");
          setError("Invalid outcome for this market.");
          return { success: false };
        }

        // Balance preflight (best-effort). The upstream can't read native
        // HIVE/HBD balances (source "native-unsupported", balance "0"); in that
        // case treat the balance as unknown and skip the ceiling — let the chain
        // reject if truly insufficient rather than blocking every bet.
        let balance = Number.POSITIVE_INFINITY;
        try {
          const bal = await predictionsApi.getBalance(user, market.token);
          const parsed = Number(bal?.balance);
          if (bal?.source !== "native-unsupported" && Number.isFinite(parsed)) {
            balance = parsed;
          }
        } catch {
          /* keep infinity */
        }

        const check = validateBet({ market, stake, balance, now: new Date() });
        if (!check.ok) {
          setStatus("error");
          setError(check.error || "Invalid bet.");
          return { success: false };
        }

        const ops = buildPlaceBetOps({
          user,
          marketId: market.onChainId || market.id,
          outcome,
          amount: stake,
          token: market.token,
        });

        const broadcast = selectBroadcaster({ dryRun, aioha, username: user });
        const result = await broadcast(ops);

        if (!result.success) {
          setStatus("error");
          setError(result.error || "Broadcast failed.");
          return result;
        }

        setStatus("success");
        setTxId(result.txId || null);

        // Indexer lag: refetch market + predictions after a short delay.
        if (!result.dryRun) {
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: predictionKeys.market(market.id) });
            queryClient.invalidateQueries({ queryKey: predictionKeys.predictions(market.id) });
            queryClient.invalidateQueries({ queryKey: predictionKeys.all });
          }, 4000);
        }

        return result;
      } finally {
        inFlightRef.current = false;
      }
    },
    [user, aioha, market, dryRun, queryClient]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTxId(null);
  }, []);

  return {
    placeBet,
    reset,
    status,
    error,
    txId,
    needsWallet,
    isPending: status === "pending",
    dryRun,
  };
}
