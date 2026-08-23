import {
  createPublicClient,
  formatEther,
  http,
  type Address,
} from "viem";
import { arbitrum, base, mainnet } from "viem/chains";

export interface NativeEthBalance {
  balance: number;
  balanceRaw: string;
  chainId: number;
  network: "arbitrum" | "base" | "ethereum";
}

const nativeEthChains = [
  {
    chain: mainnet,
    network: "ethereum" as const,
    alchemySubdomain: "eth-mainnet",
  },
  {
    chain: base,
    network: "base" as const,
    alchemySubdomain: "base-mainnet",
  },
  {
    chain: arbitrum,
    network: "arbitrum" as const,
    alchemySubdomain: "arb-mainnet",
  },
] as const;

function getRpcUrl(alchemySubdomain: string, alchemyApiKey?: string) {
  if (!alchemyApiKey) return undefined;
  return `https://${alchemySubdomain}.g.alchemy.com/v2/${alchemyApiKey}`;
}

/**
 * Reads native ETH directly from each chain RPC. Portfolio indexers can lag or
 * omit small native balances, while eth_getBalance is the chain source of truth.
 */
export async function fetchNativeEthBalances(
  address: Address,
  alchemyApiKey?: string,
): Promise<NativeEthBalance[]> {
  const results = await Promise.all(
    nativeEthChains.map(async ({ chain, network, alchemySubdomain }) => {
      try {
        const client = createPublicClient({
          chain,
          transport: http(getRpcUrl(alchemySubdomain, alchemyApiKey)),
        });
        const balanceRaw = await client.getBalance({ address });

        return {
          balance: Number(formatEther(balanceRaw)),
          balanceRaw: balanceRaw.toString(),
          chainId: chain.id,
          network,
        } satisfies NativeEthBalance;
      } catch (error) {
        console.warn(
          `[Portfolio API] Native ETH lookup failed on ${network}`,
          error instanceof Error ? error.message : error,
        );
        return null;
      }
    }),
  );

  return results.filter(
    (result): result is Exclude<typeof result, null> => result !== null,
  );
}
