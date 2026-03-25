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
  change24h: number | null;
  volume24h: string | null;
}

export interface ZoraCreatedCoin {
  address: string;
  chainId: number;
  name: string;
  symbol: string;
  logo: string | null;
  marketCap: string | null;
  change24h: number | null;
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

/**
 * Fetches Zora profile balances and created coins for a list of EVM addresses.
 *
 * Side effects:
 *  - Populates zoraEnrichment cache so TokenLogo and getEnhancedTokenData
 *    automatically pick up better logos and 24h price changes.
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
        const heldMap = new Map<string, ZoraHeldCoin>();

        balanceResults.forEach((res) => {
          const edges: any[] = (res as any)?.data?.profile?.coinBalances?.edges ?? [];
          edges.forEach((edge) => {
            const coin = edge.node?.coin;
            const rawBalance = edge.node?.balance;
            if (!coin?.address || !rawBalance) return;

            const logo = extractLogo(coin.mediaContent);
            const change24h = coin.marketCapDelta24h
              ? parseFloat(coin.marketCapDelta24h)
              : null;
            const formattedBalance =
              edge.node?.formattedBalance ?? rawBalance;

            // Populate enrichment cache (logo + 24h for main token table)
            setZoraToken(coin.address, {
              logo,
              change24h,
              name: coin.name ?? "",
              symbol: coin.symbol ?? "",
              marketCap: coin.marketCap ?? null,
            });

            const key = coin.address.toLowerCase();
            const existing = heldMap.get(key);
            if (existing) {
              // Merge balance from another address
              existing.balance = (
                parseFloat(existing.balance) + parseFloat(formattedBalance)
              ).toString();
            } else {
              heldMap.set(key, {
                address: coin.address,
                chainId: coin.chainId ?? 8453,
                name: coin.name ?? "",
                symbol: coin.symbol ?? "",
                logo,
                balance: formattedBalance,
                valueUsd: edge.node?.valueUsd ?? null,
                marketCap: coin.marketCap ?? null,
                change24h,
                volume24h: coin.volume24h ?? null,
              });
            }
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
            const change24h = coin.marketCapDelta24h
              ? parseFloat(coin.marketCapDelta24h)
              : null;

            setZoraToken(coin.address, {
              logo,
              change24h,
              name: coin.name ?? "",
              symbol: coin.symbol ?? "",
              marketCap: coin.marketCap ?? null,
            });

            const key = coin.address.toLowerCase();
            if (!createdMap.has(key)) {
              createdMap.set(key, {
                address: coin.address,
                chainId: coin.chainId ?? 8453,
                name: coin.name ?? "",
                symbol: coin.symbol ?? "",
                logo,
                marketCap: coin.marketCap ?? null,
                change24h,
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
