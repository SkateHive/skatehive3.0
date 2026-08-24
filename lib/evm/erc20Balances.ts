import { formatUnits, type Address } from "viem";

/**
 * ERC-20 balances straight from the chain (Alchemy), for the same three
 * chains as lib/evm/nativeEthBalances.ts.
 *
 * Why: the portfolio upstream (api.keepkey.info → Zapper) has no mainnet
 * ERC-20 coverage for some addresses and serves stale balances. Verified on
 * 2026-08-22 with the treasury Safe: upstream returned 29 Base tokens, zero
 * mainnet tokens, and native ETH numbers from days earlier, while
 * alchemy_getTokenBalances showed 1.01286565 stETH (~$2.45k) on mainnet.
 *
 * Contract: one result per chain. `ok: false` means the lookup FAILED — the
 * caller must keep whatever the upstream had for that chain and must not
 * treat it as "no tokens". Tokens without a price come back with price 0 so
 * the client's Hide Dust filter hides them like any other unpriced token.
 */

export type Erc20Network = "arbitrum" | "base" | "ethereum";

export interface Erc20Balance {
  chainId: number;
  network: Erc20Network;
  address: string; // lowercase contract address
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  balanceRaw: string;
  price: number; // USD, 0 when unknown
  balanceUSD: number;
  logo?: string;
}

export interface Erc20ChainResult {
  chainId: number;
  network: Erc20Network;
  ok: boolean;
  tokens: Erc20Balance[];
  error?: string;
}

const erc20Chains = [
  { chainId: 1, network: "ethereum" as const, alchemySubdomain: "eth-mainnet", coingeckoPlatform: "ethereum" },
  { chainId: 8453, network: "base" as const, alchemySubdomain: "base-mainnet", coingeckoPlatform: "base" },
  { chainId: 42161, network: "arbitrum" as const, alchemySubdomain: "arb-mainnet", coingeckoPlatform: "arbitrum-one" },
] as const;

/** Lido stETH tracks ETH ~1:1; used ONLY when CoinGecko has no price for it. */
const STETH_MAINNET = "0xae7ab96520de3a18e5e111b5eaab095312d7fe84";

const ZERO_32 = "0x" + "0".repeat(64);

async function rpc<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    // Balances change on every tx; never serve a cached answer here.
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Alchemy HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface TokenBalanceEntry { contractAddress: string; tokenBalance: string | null; error?: string | null }
interface TokenMetadata { symbol?: string | null; name?: string | null; decimals?: number | null; logo?: string | null }

async function fetchTokenPricesUsd(platform: string, addresses: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  // Small batches: one bad/unknown contract in a long list makes CoinGecko
  // answer 400 for the whole request. Free tier; on failure the caller falls
  // back to the upstream price, then to USD 0 (hidden by the dust filter).
  const CHUNK = 10;
  for (let i = 0; i < addresses.length; i += CHUNK) {
    const chunk = addresses.slice(i, i + CHUNK);
    try {
      const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${chunk.join(",")}&vs_currencies=usd`;
      const res = await fetch(url, { headers: { accept: "application/json" }, next: { revalidate: 60 } });
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
      const data = (await res.json()) as Record<string, { usd?: number }>;
      for (const [addr, v] of Object.entries(data)) {
        if (typeof v?.usd === "number" && v.usd > 0) out[addr.toLowerCase()] = v.usd;
      }
    } catch (error) {
      console.warn(`[Portfolio API] CoinGecko token prices failed on ${platform} (batch ${i / CHUNK + 1}):`, error instanceof Error ? error.message : error);
    }
  }
  return out;
}

/**
 * @param ethPriceUsd used only for the explicit stETH≈ETH fallback.
 */
export async function fetchErc20Balances(
  address: Address,
  alchemyApiKey: string | undefined,
  ethPriceUsd: number,
): Promise<Erc20ChainResult[]> {
  if (!alchemyApiKey) {
    console.error("[Portfolio API] No Alchemy key — ERC-20 on-chain lookup skipped, upstream only");
    return erc20Chains.map((c) => ({ chainId: c.chainId, network: c.network, ok: false, tokens: [], error: "no alchemy key" }));
  }

  return Promise.all(
    erc20Chains.map(async ({ chainId, network, alchemySubdomain, coingeckoPlatform }): Promise<Erc20ChainResult> => {
      const url = `https://${alchemySubdomain}.g.alchemy.com/v2/${alchemyApiKey}`;
      try {
        // 1) balances (paginated)
        const entries: TokenBalanceEntry[] = [];
        let pageKey: string | undefined;
        for (let page = 0; page < 5; page++) {
          const r = await rpc<{ result?: { tokenBalances: TokenBalanceEntry[]; pageKey?: string }; error?: { message: string } }>(url, {
            jsonrpc: "2.0", id: 1, method: "alchemy_getTokenBalances",
            params: pageKey ? [address, "erc20", { pageKey }] : [address, "erc20"],
          });
          if (r.error) throw new Error(r.error.message);
          entries.push(...(r.result?.tokenBalances ?? []));
          pageKey = r.result?.pageKey;
          if (!pageKey) break;
        }
        const nonZero = entries.filter((e) => e.tokenBalance && e.tokenBalance !== "0x0" && e.tokenBalance !== ZERO_32 && !e.error);
        if (nonZero.length === 0) return { chainId, network, ok: true, tokens: [] };

        // 2) metadata — one batched JSON-RPC request
        const metaRes = await rpc<Array<{ id: number; result?: TokenMetadata; error?: { message: string } }>>(
          url,
          nonZero.map((e, i) => ({ jsonrpc: "2.0", id: i, method: "alchemy_getTokenMetadata", params: [e.contractAddress] })),
        );
        const metaById = new Map<number, TokenMetadata>();
        for (const m of Array.isArray(metaRes) ? metaRes : []) if (m.result) metaById.set(m.id, m.result);

        // 3) prices
        const addrs = nonZero.map((e) => e.contractAddress.toLowerCase());
        const prices = await fetchTokenPricesUsd(coingeckoPlatform, addrs);

        const tokens: Erc20Balance[] = [];
        nonZero.forEach((e, i) => {
          const meta = metaById.get(i);
          const decimals = typeof meta?.decimals === "number" ? meta.decimals : 18;
          const contract = e.contractAddress.toLowerCase();
          const raw = BigInt(e.tokenBalance as string);
          const balance = Number(formatUnits(raw, decimals));
          let price = prices[contract] ?? 0;
          if (price === 0 && chainId === 1 && contract === STETH_MAINNET && ethPriceUsd > 0) {
            // EXPLICIT approximation: stETH ≈ ETH (Lido rebasing token, trades
            // within ~0.5% of ETH). Only used when CoinGecko gave no price.
            price = ethPriceUsd;
          }
          // Names/symbols are untrusted on-chain strings (spam tokens embed
          // URLs). They are rendered as plain text only — never as links.
          const symbol = (meta?.symbol || "UNKNOWN").slice(0, 32);
          const name = (meta?.name || symbol).slice(0, 80);
          tokens.push({
            chainId, network, address: contract, symbol, name, decimals,
            balance, balanceRaw: raw.toString(), price, balanceUSD: balance * price,
            logo: meta?.logo ?? undefined,
          });
        });
        return { chainId, network, ok: true, tokens };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Loud: a failed chain means the list for that chain is upstream-only.
        console.error(`[Portfolio API] ERC-20 on-chain lookup FAILED on ${network} — keeping upstream tokens for that chain: ${message}`);
        return { chainId, network, ok: false, tokens: [], error: message };
      }
    }),
  );
}
