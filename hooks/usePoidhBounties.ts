import { useState, useEffect } from "react";
import type { PoidhBounty, BountyFilter, BountyStatus } from "@/types/poidh";

export function usePoidhBounties(filter?: BountyFilter) {
  const [bounties, setBounties] = useState<PoidhBounty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchBounties();
  }, [filter]);

  const fetchBounties = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Build query params
      const params = new URLSearchParams();
      if (filter?.chains && filter.chains.length > 0) {
        params.append("chainId", filter.chains[0].toString());
      }
      if (filter?.status && filter.status.length > 0) {
        params.append("status", filter.status[0]);
      }

      // Fetch from API route (server-side to avoid CORS)
      const response = await fetch(`/api/poidh/bounties?${params}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Convert string amounts back to bigint
      const bountiesWithBigInt = data.bounties.map((b: any) => ({
        ...b,
        amount: BigInt(b.amount),
      }));

      // Filter by search term if specified
      let filtered = bountiesWithBigInt;
      if (filter?.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase();
        filtered = filtered.filter((bounty: PoidhBounty) => {
          const text = `${bounty.name} ${bounty.description}`.toLowerCase();
          return text.includes(searchLower);
        });
      }

      setBounties(filtered);
    } catch (err) {
      console.error("Error fetching POIDH bounties:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    bounties,
    isLoading,
    error,
    refetch: fetchBounties,
  };
}

// Helper: Get chain name
export function getChainName(chainId: number): string {
  switch (chainId) {
    case 42161:
      return "Arbitrum";
    case 8453:
      return "Base";
    case 666666666:
      return "Degen";
    default:
      return `Chain ${chainId}`;
  }
}

// Helper: Format amount in ETH
export function formatBountyAmount(amount: bigint): string {
  const eth = Number(amount) / 1e18;
  if (eth < 0.001) return `${(eth * 1000).toFixed(2)} mETH`;
  return `${eth.toFixed(4)} ETH`;
}
