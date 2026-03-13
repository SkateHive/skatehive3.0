"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PoidhApiStatus, PoidhBounty } from "@/types/poidh";

interface UsePoidhBountiesOptions {
  status: PoidhApiStatus;
}

interface ApiResponse {
  items: PoidhBounty[];
  count?: number;
}

export function usePoidhBounties({ status }: UsePoidhBountiesOptions) {
  const [bounties, setBounties] = useState<PoidhBounty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBounties = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/poidh/bounties?status=${status}&filterSkate=true`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to load POIDH bounties (${response.status})`);
      }

      const data = (await response.json()) as ApiResponse;
      setBounties(data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load POIDH bounties");
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchBounties();
  }, [fetchBounties]);

  const stats = useMemo(() => {
    const totalRewardEth = bounties.reduce((sum, bounty) => sum + parsePoidhAmountToEth(bounty.amount), 0);
    return {
      count: bounties.length,
      totalRewardEth,
    };
  }, [bounties]);

  return {
    bounties,
    isLoading,
    error,
    refetch: fetchBounties,
    stats,
  };
}

export function getPoidhChainName(chainId: number) {
  if (chainId === 8453) return "Base";
  if (chainId === 42161) return "Arbitrum";
  return `Chain ${chainId}`;
}

export function getPoidhChainColor(chainId: number) {
  if (chainId === 8453) return "blue";
  if (chainId === 42161) return "purple";
  return "gray";
}

export function parsePoidhAmountToEth(amount: string) {
  const value = Number(amount) / 1e18;
  if (!Number.isFinite(value)) return 0;
  return value;
}

export function formatPoidhAmount(amount: string) {
  const value = parsePoidhAmountToEth(amount);
  if (!Number.isFinite(value)) return "—";
  if (value >= 1) return `${value.toFixed(2)} ETH`;
  if (value >= 0.01) return `${value.toFixed(3)} ETH`;
  return `${value.toFixed(4)} ETH`;
}

export function formatPoidhDate(timestamp: number | null | undefined) {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp * 1000));
}

export function getPoidhUrl(bounty: Pick<PoidhBounty, "chainId" | "id">) {
  return `https://poidh.xyz/bounty/${bounty.chainId}/${bounty.id}`;
}
