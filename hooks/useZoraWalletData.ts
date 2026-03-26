"use client";

import { useState, useEffect } from "react";
import { getProfileBalances, getProfileCoins } from "@zoralabs/coins-sdk";
import { setZoraToken } from "@/lib/utils/zoraEnrichment";
import { notifyLogoUpdates } from "@/lib/utils/geckoTerminal";

export interface ZoraHeldCoin {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  logo: string | null;
  balance: string;       // human-readable decimal
  valueUsd: string | null;
  marketCap: string | null;
  volume24h: string | null;
}

export interface ZoraCreatedCoin {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  logo: string | null;
  marketCap: string | null;
  uniqueHolders: number;
  volume24h: string | null;
}

function extractLogo(mediaContent: any): string | null {
  return (
    mediaContent?.previewImage?.medium ??
    mediaContent?.previewImage?.small ??
    mediaContent?.originalUri ??
    null
  );
}

// All Zora coins use 18 decimals. balance is raw wei as a string.
function fromWei(raw: string): string {
  try {
    const divisor = BigInt("1000000000000000000"); // 1e18
    const big = BigInt(raw);
    const whole = big / divisor;
    const remainder = big % divisor;
    const frac = Number(remainder) / 1e18;
    return (Number(whole) + frac).toString();
  } catch {
    return "0";
  }
}

/**
 * Fetches Zora profile balances and created coins for a list of EVM addresses.
 *
 * Side effects:
 *  - Populates zoraEnrichment cache so TokenLogo and getEnhancedTokenData
 *    automatically pick up better logos.
 *  - Calls notifyLogoUpdates() so the wallet table re-renders.
 */
export function useZoraWalletData(addresses: string[]): {
  heldCoins: ZoraHeldCoin[];
  createdCoins: ZoraCreatedCoin[];
  isLoading: boolean;
} {
  const [heldCoins, setHeldCoins] = useState<ZoraHeldCoin[]>([]);
  const [createdCoins, setCreatedCoins] = useState<ZoraCreatedCoin[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const key = [...new Set(addresses.filter((a) => a?.startsWith("0x")))].join(",");

  useEffect(() => {
    if (!key) return;

    const uniqueAddresses = key.split(",");
    setIsLoading(true);

    Promise.all([
      Promise.all(
        uniqueAddresses.map((addr) =>
          getProfileBalances({ identifier: addr, count: 50 }).catch(() => null)
        )
      ),
      Promise.all(
        uniqueAddresses.map((addr) =>
          getProfileCoins({ identifier: addr, count: 50 }).catch(() => null)
        )
      ),
    ])
      .then(([balanceResults, coinResults]) => {
        // ── Held coins ─────────────────────────────────────────────────────
        // Track raw wei per address so multi-address merge stays precise
        const heldMap = new Map<string, ZoraHeldCoin>();
        const rawWeiMap = new Map<string, bigint>();

        balanceResults.forEach((res) => {
          const edges: any[] = (res as any)?.data?.profile?.coinBalances?.edges ?? [];
          edges.forEach((edge) => {
            const coin = edge.node?.coin;
            const rawBalance = edge.node?.balance;
            if (!coin?.address || !rawBalance) return;

            const logo = extractLogo(coin.mediaContent);
            const priceInUsdc = coin.tokenPrice?.priceInUsdc
              ? parseFloat(coin.tokenPrice.priceInUsdc)
              : null;
            const marketCapUsd = coin.marketCap ?? null;

            setZoraToken(coin.address, {
              logo,
              change24h: null,
              name: coin.name ?? "",
              symbol: coin.symbol ?? "",
              marketCap: marketCapUsd,
            });

            const mapKey = coin.address.toLowerCase();
            const existingRaw = rawWeiMap.get(mapKey) ?? 0n;
            let rawBig: bigint;
            try { rawBig = BigInt(rawBalance); } catch { rawBig = 0n; }
            const totalRaw = existingRaw + rawBig;
            rawWeiMap.set(mapKey, totalRaw);

            const humanBalance = fromWei(totalRaw.toString());
            const valueUsd =
              priceInUsdc !== null
                ? (parseFloat(humanBalance) * priceInUsdc).toString()
                : null;

            heldMap.set(mapKey, {
              address: coin.address,
              chainId: coin.chainId ?? 8453,
              name: coin.name ?? "",
              symbol: coin.symbol ?? "",
              logo,
              balance: humanBalance,
              valueUsd,
              marketCap: marketCapUsd,
              volume24h: coin.volume24h ?? null,
            });
          });
        });

        // ── Created coins ───────────────────────────────────────────────────
        const createdMap = new Map<string, ZoraCreatedCoin>();

        coinResults.forEach((res) => {
          const edges: any[] = (res as any)?.data?.profile?.createdCoins?.edges ?? [];
          edges.forEach((edge) => {
            const coin = edge.node;
            if (!coin?.address) return;

            const logo = extractLogo(coin.mediaContent);
            const createdMarketCapUsd = coin.marketCap ?? null;

            setZoraToken(coin.address, {
              logo,
              change24h: null,
              name: coin.name ?? "",
              symbol: coin.symbol ?? "",
              marketCap: createdMarketCapUsd,
            });

            const key = coin.address.toLowerCase();
            if (!createdMap.has(key)) {
              createdMap.set(key, {
                address: coin.address,
                chainId: coin.chainId ?? 8453,
                name: coin.name ?? "",
                symbol: coin.symbol ?? "",
                logo,
                marketCap: createdMarketCapUsd,
                uniqueHolders: coin.uniqueHolders ?? 0,
                volume24h: coin.volume24h ?? null,
              });
            }
          });
        });

        setHeldCoins(
          [...heldMap.values()].sort(
            (a, b) =>
              parseFloat(b.valueUsd ?? "0") - parseFloat(a.valueUsd ?? "0")
          )
        );
        setCreatedCoins(
          [...createdMap.values()].sort(
            (a, b) =>
              parseFloat(b.marketCap ?? "0") - parseFloat(a.marketCap ?? "0")
          )
        );

        // Trigger re-render of token rows so Zora logos appear immediately
        notifyLogoUpdates();
      })
      .catch(() => {
        // Silently ignore — Zora enrichment is best-effort
      })
      .finally(() => {
        setIsLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { heldCoins, createdCoins, isLoading };
}
