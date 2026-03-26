"use client";
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import { PortfolioData } from "../types/portfolio";
import { localCacheGet, localCacheSet, localCacheDelete } from "@/lib/utils/localCache";

// ── In-memory session cache (prevents duplicate fetches within same page session) ──
const sessionCache = new Map<string, { data: PortfolioData; ts: number }>();
const SESSION_TTL_MS = 5 * 60 * 1000; // 5 min — don't re-fetch within same session

// ── localStorage cache key ──
const lsKey = (address: string) => `portfolio_${address.toLowerCase()}`;
// Show localStorage data up to 24h old while re-fetching in background
const LS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function getSessionCached(address: string): PortfolioData | null {
  const entry = sessionCache.get(address.toLowerCase());
  if (!entry) return null;
  if (Date.now() - entry.ts > SESSION_TTL_MS) {
    sessionCache.delete(address.toLowerCase());
    return null;
  }
  return entry.data;
}

function setSessionCache(address: string, data: PortfolioData) {
  sessionCache.set(address.toLowerCase(), { data, ts: Date.now() });
}

// ─────────────────────────────────────────────────────────────────────────────

interface PortfolioContextType {
  portfolio: PortfolioData | null;
  farcasterPortfolio: PortfolioData | null;
  farcasterVerifiedPortfolios: Record<string, PortfolioData>;
  aggregatedPortfolio: PortfolioData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

interface PortfolioProviderProps {
  children: ReactNode;
  address: string | undefined;
  farcasterAddress?: string | undefined;
  farcasterVerifiedAddresses?: string[];
}

// Returns true only when net worth differs by more than $0.01 — avoids
// re-renders when cached and fresh data are effectively identical.
function portfolioChanged(prev: PortfolioData | null, next: PortfolioData | null): boolean {
  if (!prev && !next) return false;
  if (!prev || !next) return true;
  return Math.abs((prev.totalNetWorth ?? 0) - (next.totalNetWorth ?? 0)) > 0.01;
}

export function PortfolioProvider({
  children,
  address,
  farcasterAddress,
  farcasterVerifiedAddresses,
}: PortfolioProviderProps) {
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [farcasterPortfolio, setFarcasterPortfolio] = useState<PortfolioData | null>(null);
  const [farcasterVerifiedPortfolios, setFarcasterVerifiedPortfolios] = useState<Record<string, PortfolioData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs mirror current state so fetchAllPortfolios can compare without stale closures.
  const portfolioRef = useRef<PortfolioData | null>(null);
  const farcasterPortfolioRef = useRef<PortfolioData | null>(null);
  const verifiedPortfoliosRef = useRef<Record<string, PortfolioData>>({});
  useEffect(() => { portfolioRef.current = portfolio; }, [portfolio]);
  useEffect(() => { farcasterPortfolioRef.current = farcasterPortfolio; }, [farcasterPortfolio]);
  useEffect(() => { verifiedPortfoliosRef.current = farcasterVerifiedPortfolios; }, [farcasterVerifiedPortfolios]);

  // AbortController ref — cancel in-flight requests if addresses change
  const abortRef = useRef<AbortController | null>(null);

  // Stable key from addresses — prevents refetch when parent re-renders with same values
  const addressKey = useMemo(() => {
    const parts = [
      address || "",
      farcasterAddress || "",
      ...(farcasterVerifiedAddresses || []).slice().sort(),
    ];
    return parts.join("|");
  }, [address, farcasterAddress, farcasterVerifiedAddresses]);

  const fetchPortfolio = useCallback(
    async (walletAddress: string, signal: AbortSignal): Promise<PortfolioData | null> => {
      // Session cache — skip network if we already fetched this session
      const inSession = getSessionCached(walletAddress);
      if (inSession) return inSession;

      try {
        const response = await fetch(`/api/portfolio/${walletAddress}`, { signal });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Failed to fetch portfolio");
        }

        setSessionCache(walletAddress, data);
        localCacheSet(lsKey(walletAddress), data);
        return data;
      } catch (err: any) {
        if (err.name === "AbortError") return null;
        console.error(`Error fetching portfolio for ${walletAddress}:`, err);
        return null;
      }
    },
    []
  );

  const fetchAllPortfolios = useCallback(
    async (forceRefresh = false) => {
      if (!address && !farcasterAddress && (!farcasterVerifiedAddresses?.length)) {
        setPortfolio(null);
        setFarcasterPortfolio(null);
        setFarcasterVerifiedPortfolios({});
        return;
      }

      // Cancel any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const { signal } = controller;

      // On force refresh, clear both caches
      if (forceRefresh) {
        if (address) { sessionCache.delete(address.toLowerCase()); localCacheDelete(lsKey(address)); }
        if (farcasterAddress) { sessionCache.delete(farcasterAddress.toLowerCase()); localCacheDelete(lsKey(farcasterAddress)); }
        farcasterVerifiedAddresses?.forEach((a) => { sessionCache.delete(a.toLowerCase()); localCacheDelete(lsKey(a)); });
      }

      setIsLoading(true);
      setError(null);

      try {
        const ethVerifiedAddresses =
          farcasterVerifiedAddresses?.filter(
            (addr) =>
              addr.startsWith("0x") &&
              addr.toLowerCase() !== address?.toLowerCase() &&
              addr.toLowerCase() !== farcasterAddress?.toLowerCase()
          ) || [];

        const [ethPortfolio, fcPortfolio, ...verifiedPortfolios] = await Promise.all([
          address ? fetchPortfolio(address, signal) : Promise.resolve(null),
          farcasterAddress ? fetchPortfolio(farcasterAddress, signal) : Promise.resolve(null),
          ...ethVerifiedAddresses.map((addr) => fetchPortfolio(addr, signal)),
        ]);

        // Ignore result if request was aborted (component unmounted / addresses changed)
        if (signal.aborted) return;

        // Only update state when data actually changed — avoids a redundant
        // re-render when fresh API data matches what was already loaded from cache.
        if (portfolioChanged(portfolioRef.current, ethPortfolio)) setPortfolio(ethPortfolio);
        if (portfolioChanged(farcasterPortfolioRef.current, fcPortfolio)) setFarcasterPortfolio(fcPortfolio);

        const verifiedRecord: Record<string, PortfolioData> = {};
        ethVerifiedAddresses.forEach((addr, i) => {
          const p = verifiedPortfolios[i];
          if (p && p.totalNetWorth > 0) verifiedRecord[addr] = p;
        });
        const prevVerified = verifiedPortfoliosRef.current;
        const verifiedChanged = Object.keys(verifiedRecord).some(
          addr => portfolioChanged(prevVerified[addr] ?? null, verifiedRecord[addr])
        ) || Object.keys(prevVerified).length !== Object.keys(verifiedRecord).length;
        if (verifiedChanged) setFarcasterVerifiedPortfolios(verifiedRecord);
      } catch (err) {
        if (!signal.aborted) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!signal.aborted) setIsLoading(false);
      }
    },
    [address, farcasterAddress, farcasterVerifiedAddresses, fetchPortfolio]
  );

  // On address change: show localStorage data immediately, then fetch fresh
  useEffect(() => {
    // Pre-populate state from localStorage so the UI is never blank on refresh
    const ethCached   = address         ? localCacheGet<PortfolioData>(lsKey(address),         LS_MAX_AGE_MS) : null;
    const fcCached    = farcasterAddress ? localCacheGet<PortfolioData>(lsKey(farcasterAddress), LS_MAX_AGE_MS) : null;
    if (ethCached)  setPortfolio(ethCached);
    if (fcCached)   setFarcasterPortfolio(fcCached);

    const verifiedAddresses = (farcasterVerifiedAddresses || []).filter(
      (a) => a.startsWith("0x") &&
        a.toLowerCase() !== address?.toLowerCase() &&
        a.toLowerCase() !== farcasterAddress?.toLowerCase()
    );
    if (verifiedAddresses.length > 0) {
      const cachedVerified: Record<string, PortfolioData> = {};
      verifiedAddresses.forEach((a) => {
        const c = localCacheGet<PortfolioData>(lsKey(a), LS_MAX_AGE_MS);
        if (c) cachedVerified[a] = c;
      });
      if (Object.keys(cachedVerified).length > 0) setFarcasterVerifiedPortfolios(cachedVerified);
    }

    // Then always fetch fresh in the background
    fetchAllPortfolios();
    return () => { abortRef.current?.abort(); };
  }, [addressKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const aggregatedPortfolio = useMemo((): PortfolioData | null => {
    if (!portfolio && !farcasterPortfolio && Object.keys(farcasterVerifiedPortfolios).length === 0)
      return null;

    const toArray = (value: any[] | undefined): any[] => (Array.isArray(value) ? value : []);

    const tagToken = (
      token: any,
      source: "ethereum" | "farcaster" | "verified",
      sourceAddress: string
    ) => ({ ...token, source, sourceAddress });

    const combinedTokens = [
      ...toArray(portfolio?.tokens).map((t) => tagToken(t, "ethereum", address || "")),
      ...toArray(farcasterPortfolio?.tokens).map((t) => tagToken(t, "farcaster", farcasterAddress || "")),
      ...Object.entries(farcasterVerifiedPortfolios).flatMap(([addr, p]) =>
        toArray(p.tokens).map((t) => tagToken(t, "verified", addr))
      ),
    ];

    const combinedNfts = [
      ...toArray(portfolio?.nfts),
      ...toArray(farcasterPortfolio?.nfts),
      ...Object.values(farcasterVerifiedPortfolios).flatMap((p) => toArray(p.nfts)),
    ];

    const sum = (key: keyof PortfolioData) =>
      (portfolio?.[key] as number || 0) +
      (farcasterPortfolio?.[key] as number || 0) +
      Object.values(farcasterVerifiedPortfolios).reduce((s, p) => s + (p[key] as number || 0), 0);

    return {
      totalNetWorth: sum("totalNetWorth"),
      totalBalanceUsdTokens: sum("totalBalanceUsdTokens"),
      totalBalanceUSDApp: sum("totalBalanceUSDApp"),
      nftUsdNetWorth: {
        ...(portfolio?.nftUsdNetWorth || {}),
        ...(farcasterPortfolio?.nftUsdNetWorth || {}),
        ...Object.values(farcasterVerifiedPortfolios).reduce(
          (acc, p) => ({ ...acc, ...(p.nftUsdNetWorth || {}) }),
          {}
        ),
      },
      tokens: combinedTokens,
      nfts: combinedNfts,
    };
  }, [portfolio, farcasterPortfolio, farcasterVerifiedPortfolios, address, farcasterAddress]);

  const contextValue = useMemo(
    () => ({
      portfolio,
      farcasterPortfolio,
      farcasterVerifiedPortfolios,
      aggregatedPortfolio,
      isLoading,
      error,
      // refetch always bypasses cache
      refetch: () => fetchAllPortfolios(true),
    }),
    [portfolio, farcasterPortfolio, farcasterVerifiedPortfolios, aggregatedPortfolio, isLoading, error, fetchAllPortfolios]
  );

  return (
    <PortfolioContext.Provider value={contextValue}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolioContext() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error("usePortfolioContext must be used within a PortfolioProvider");
  }
  return context;
}
