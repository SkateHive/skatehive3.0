import { useState, useEffect } from "react";
import { createPublicClient, http } from "viem";
import { arbitrum, base } from "viem/chains";
import { POIDH_ABI, POIDH_CONTRACT_ADDRESS } from "@/lib/contracts/poidhAbi";
import type { PoidhBounty, BountyFilter, BountyStatus } from "@/types/poidh";

// Degen chain config
const degen = {
  id: 666666666,
  name: "Degen",
  network: "degen",
  nativeCurrency: { name: "Degen", symbol: "DEGEN", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.degen.tips"] },
    public: { http: ["https://rpc.degen.tips"] },
  },
  blockExplorers: {
    default: { name: "Degen Explorer", url: "https://explorer.degen.tips" },
  },
} as const;

// Skate-related keywords for filtering
const SKATE_KEYWORDS = [
  "skate",
  "skateboard",
  "trick",
  "kickflip",
  "ollie",
  "grind",
  "rail",
  "ledge",
  "park",
  "street",
  "vert",
  "bowl",
  "ramp",
  "deck",
  "board",
  "skatehive",
];

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
      const chains = filter?.chains || [arbitrum.id, base.id, degen.id];
      const allBounties: PoidhBounty[] = [];

      // Fetch from each chain
      for (const chainId of chains) {
        const chainBounties = await fetchBountiesFromChain(chainId);
        allBounties.push(...chainBounties);
      }

      // Filter by skate keywords
      const skateBounties = allBounties.filter((bounty) => {
        const text = `${bounty.name} ${bounty.description}`.toLowerCase();
        return SKATE_KEYWORDS.some((keyword) => text.includes(keyword));
      });

      // Filter by status if specified
      let filtered = skateBounties;
      if (filter?.status && filter.status.length > 0) {
        filtered = skateBounties.filter((bounty) => {
          const status = getBountyStatus(bounty);
          return filter.status!.includes(status);
        });
      }

      // Filter by search term if specified
      if (filter?.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase();
        filtered = filtered.filter((bounty) => {
          const text = `${bounty.name} ${bounty.description}`.toLowerCase();
          return text.includes(searchLower);
        });
      }

      // Sort by creation date (newest first)
      filtered.sort((a, b) => b.createdAt - a.createdAt);

      setBounties(filtered);
    } catch (err) {
      console.error("Error fetching POIDH bounties:", err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBountiesFromChain = async (
    chainId: number
  ): Promise<PoidhBounty[]> => {
    const chain = getChainConfig(chainId);
    if (!chain) return [];

    const client = createPublicClient({
      chain,
      transport: http(),
    });

    try {
      // Get total bounty count
      const counter = (await client.readContract({
        address: POIDH_CONTRACT_ADDRESS,
        abi: POIDH_ABI,
        functionName: "bountyCounter",
      })) as bigint;

      const count = Number(counter);
      if (count === 0) return [];

      // Fetch recent bounties (last 100 max to avoid too many RPC calls)
      const maxBounties = Math.min(count, 100);
      const startId = Math.max(1, count - maxBounties + 1);

      const promises = [];
      for (let id = startId; id <= count; id++) {
        promises.push(fetchBountyById(client, id, chainId));
      }

      const results = await Promise.allSettled(promises);
      return results
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<PoidhBounty>).value);
    } catch (err) {
      console.error(`Error fetching from chain ${chainId}:`, err);
      return [];
    }
  };

  const fetchBountyById = async (
    client: any,
    id: number,
    chainId: number
  ): Promise<PoidhBounty> => {
    const bounty = (await client.readContract({
      address: POIDH_CONTRACT_ADDRESS,
      abi: POIDH_ABI,
      functionName: "getBounty",
      args: [BigInt(id)],
    })) as any;

    // Try to fetch claim IDs (may fail if bounty has no claims)
    let claimIds: number[] = [];
    try {
      const claims = (await client.readContract({
        address: POIDH_CONTRACT_ADDRESS,
        abi: POIDH_ABI,
        functionName: "bountyClaims",
        args: [BigInt(id)],
      })) as bigint[];
      claimIds = claims.map((c) => Number(c));
    } catch {
      // No claims yet
    }

    return {
      id,
      issuer: bounty.issuer,
      name: bounty.name,
      description: bounty.description,
      amount: bounty.amount,
      createdAt: Number(bounty.createdAt),
      isOpen: bounty.isOpen,
      isCancelled: bounty.isCancelled,
      hasActiveClaim: bounty.hasActiveClaim,
      chainId,
      claimIds,
    };
  };

  return {
    bounties,
    isLoading,
    error,
    refetch: fetchBounties,
  };
}

// Helper: Get chain config
function getChainConfig(chainId: number) {
  switch (chainId) {
    case arbitrum.id:
      return arbitrum;
    case base.id:
      return base;
    case degen.id:
      return degen;
    default:
      return null;
  }
}

// Helper: Determine bounty status
function getBountyStatus(bounty: PoidhBounty): BountyStatus {
  if (bounty.isCancelled) return "cancelled";
  if (bounty.hasActiveClaim || bounty.amount === 0n) return "completed";
  return "active";
}

// Helper: Get chain name
export function getChainName(chainId: number): string {
  switch (chainId) {
    case arbitrum.id:
      return "Arbitrum";
    case base.id:
      return "Base";
    case degen.id:
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
