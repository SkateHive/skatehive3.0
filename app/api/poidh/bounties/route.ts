import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { arbitrum, base } from "viem/chains";
import { POIDH_ABI, POIDH_CONTRACT_ADDRESSES } from "@/lib/contracts/poidhAbi";

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
} as const;

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

// Cache in memory (resets on server restart)
let cache: {
  bounties: any[];
  timestamp: number;
} | null = null;

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chainIdParam = searchParams.get("chainId");
    const statusParam = searchParams.get("status");
    const forceRefresh = searchParams.get("refresh") === "true";

    // Check cache
    if (
      !forceRefresh &&
      cache &&
      Date.now() - cache.timestamp < CACHE_TTL
    ) {
      return NextResponse.json({
        bounties: cache.bounties,
        cached: true,
        cachedAt: new Date(cache.timestamp).toISOString(),
      });
    }

    // Determine which chains to fetch
    const chainIds = chainIdParam
      ? [parseInt(chainIdParam)]
      : [arbitrum.id, base.id, degen.id];

    const allBounties = [];

    // Fetch from each chain
    for (const chainId of chainIds) {
      try {
        console.log(`[POIDH API] Fetching from chain ${chainId}...`);
        const chainBounties = await fetchBountiesFromChain(chainId);
        console.log(`[POIDH API] Chain ${chainId}: found ${chainBounties.length} bounties`);
        allBounties.push(...chainBounties);
      } catch (err) {
        console.error(`[POIDH API] Error fetching from chain ${chainId}:`, err);
        // Continue with other chains
      }
    }

    console.log(`[POIDH API] Total bounties before filter: ${allBounties.length}`);

    // Filter by skate keywords
    const skateBounties = allBounties.filter((bounty: any) => {
      const text = `${bounty.name} ${bounty.description}`.toLowerCase();
      return SKATE_KEYWORDS.some((keyword) => text.includes(keyword));
    });

    // Filter by status if provided
    let filtered = skateBounties;
    if (statusParam) {
      filtered = skateBounties.filter((bounty: any) => {
        if (statusParam === "active")
          return !bounty.isCancelled && bounty.amount > 0;
        if (statusParam === "completed")
          return bounty.hasActiveClaim || bounty.amount === 0n;
        if (statusParam === "cancelled") return bounty.isCancelled;
        return true;
      });
    }

    // Sort by creation date
    filtered.sort((a: any, b: any) => b.createdAt - a.createdAt);

    // Update cache
    cache = {
      bounties: filtered,
      timestamp: Date.now(),
    };

    return NextResponse.json({
      bounties: filtered,
      cached: false,
      count: filtered.length,
    });
  } catch (error: any) {
    console.error("Error in /api/poidh/bounties:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch POIDH bounties",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

async function fetchBountiesFromChain(chainId: number): Promise<any[]> {
  const chain = getChainConfig(chainId);
  if (!chain) return [];

  const rpcUrl = getRpcUrl(chainId);
  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  try {
    // Get contract address for this chain
    const contractAddress = POIDH_CONTRACT_ADDRESSES[
      chainId as keyof typeof POIDH_CONTRACT_ADDRESSES
    ];

    // Get total bounty count
    const counter = (await client.readContract({
      address: contractAddress as `0x${string}`,
      abi: POIDH_ABI,
      functionName: "bountyCounter",
    })) as bigint;

    const count = Number(counter);
    if (count === 0) return [];

    // Try to fetch up to 5 valid bounties (reduced to minimize rate limits)
    // Search in last 20 to account for cancelled/deleted ones
    const searchRange = Math.min(count, 20);
    const startId = Math.max(1, count - searchRange + 1);

    const bounties = [];

    // Fetch one by one, stop when we have 5 valid bounties
    for (let id = count; id >= startId && bounties.length < 5; id--) {
      try {
        const bounty = await fetchBountyById(client, id, chainId);
        bounties.push(bounty);
        console.log(`[POIDH API] Successfully fetched bounty ${id}`);

        // Delay between requests to avoid rate limits (500ms)
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err: any) {
        // Skip cancelled/non-existent bounties silently
        if (err.message?.includes("reverted")) {
          console.log(`[POIDH API] Bounty ${id} reverted (likely cancelled), skipping`);
        } else if (err.message?.includes("429") || err.message?.includes("rate limit")) {
          console.log(`[POIDH API] Rate limited on bounty ${id}, stopping search on this chain`);
          break; // Stop searching this chain if rate limited
        } else {
          console.error(`[POIDH API] Error fetching bounty ${id}:`, err.message);
        }
        // Delay even on errors to avoid hammering RPC
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }

    return bounties;
  } catch (err) {
    console.error(`Error fetching from chain ${chainId}:`, err);
    return [];
  }
}

async function fetchBountyById(
  client: any,
  id: number,
  chainId: number
): Promise<any> {
  const contractAddress = POIDH_CONTRACT_ADDRESSES[
    chainId as keyof typeof POIDH_CONTRACT_ADDRESSES
  ] as `0x${string}`;

  const bounty = (await client.readContract({
    address: contractAddress,
    abi: POIDH_ABI,
    functionName: "getBounty",
    args: [BigInt(id)],
  })) as any;

  // Try to fetch claims (optional)
  let claimIds: number[] = [];
  try {
    const claims = (await client.readContract({
      address: contractAddress,
      abi: POIDH_ABI,
      functionName: "bountyClaims",
      args: [BigInt(id)],
    })) as bigint[];
    claimIds = claims.map((c: bigint) => Number(c));
  } catch {
    // No claims
  }

  return {
    id,
    issuer: bounty.issuer,
    name: bounty.name,
    description: bounty.description,
    amount: bounty.amount.toString(), // Convert bigint to string for JSON
    createdAt: Number(bounty.createdAt),
    isOpen: bounty.isOpen,
    isCancelled: bounty.isCancelled,
    hasActiveClaim: bounty.hasActiveClaim,
    chainId,
    claimIds,
  };
}

function getRpcUrl(chainId: number): string {
  switch (chainId) {
    case arbitrum.id:
      return "https://arb1.arbitrum.io/rpc";
    case base.id:
      return "https://mainnet.base.org";
    case degen.id:
      return "https://rpc.degen.tips";
    default:
      return "";
  }
}

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
