"use client";
import { useCallback, useState } from "react";
import { useAioha } from "@aioha/react-ui";
import { useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { predictionKeys } from "@/lib/predictions/api";
import { buildCreateMarketOps, newMarketId } from "@/lib/predictions/operations";
import { validateCreateMarket } from "@/lib/predictions/validation";
import { selectBroadcaster } from "@/lib/predictions/broadcast";
import type { CreateMarketFields } from "@/lib/predictions/types";

type Status = "idle" | "pending" | "success" | "error";

// Wallet-only market creation. Same active-auth constraint as betting: builds
// the [custom_json, transfer] pair (opening stake) in one transaction.
export default function useCreateMarket() {
  const { user, aioha } = useAioha();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const dryRun = searchParams?.get("dryRun") === "1";

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [marketId, setMarketId] = useState<string | null>(null);

  const needsWallet = !user;

  const createMarket = useCallback(
    async (fields: CreateMarketFields) => {
      setError(null);
      setTxId(null);
      setMarketId(null);

      if (!user) {
        setStatus("error");
        setError("Connect a Hive wallet to create a market.");
        return { success: false };
      }

      const check = validateCreateMarket({ fields, now: new Date() });
      if (!check.ok) {
        setStatus("error");
        setError(check.error || "Invalid market.");
        return { success: false };
      }

      setStatus("pending");
      const id = newMarketId();
      const ops = buildCreateMarketOps({ user, marketId: id, ...fields });

      const broadcast = selectBroadcaster({ dryRun, aioha, username: user });
      const result = await broadcast(ops);

      if (!result.success) {
        setStatus("error");
        setError(result.error || "Broadcast failed.");
        return result;
      }

      setStatus("success");
      setTxId(result.txId || null);
      setMarketId(id);

      if (!result.dryRun) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: predictionKeys.all });
        }, 4000);
      }

      return { ...result, marketId: id };
    },
    [user, aioha, dryRun, queryClient]
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setTxId(null);
    setMarketId(null);
  }, []);

  return {
    createMarket,
    reset,
    status,
    error,
    txId,
    marketId,
    needsWallet,
    isPending: status === "pending",
    dryRun,
  };
}
