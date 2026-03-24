import { useState, useEffect, useCallback, useRef } from 'react';

interface MarketPrices {
  hivePrice: number | null;
  hbdPrice: number | null;
  ethPrice: number | null;
  isPriceLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface UseMarketPricesOptions {
  refreshInterval?: number;
  enableAutoRefresh?: boolean;
}

export function useMarketPrices(options: UseMarketPricesOptions = {}): MarketPrices & { refreshPrices: () => Promise<void> } {
  const {
    refreshInterval = 300000, // 5 minutes
    enableAutoRefresh = true
  } = options;

  const [hivePrice, setHivePrice] = useState<number | null>(null);
  const [hbdPrice, setHbdPrice] = useState<number | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track whether we've ever loaded prices — avoids putting prices in callback deps
  const hasPrices = useRef(false);

  // Stable callback — no state in deps, no re-fetch loop
  const fetchPrices = useCallback(async () => {
    try {
      setIsPriceLoading(true);
      setError(null);

      const response = await fetch("/api/prices");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      setHivePrice(data["hive"]?.usd || 0.21);
      setHbdPrice(data["hive_dollar"]?.usd || 1.0);
      setEthPrice(data["ethereum"]?.usd || 2500);
      setLastUpdated(new Date());
      hasPrices.current = true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Only apply fallbacks on first load failure — keep stale prices on refresh failure
      if (!hasPrices.current) {
        setHivePrice(0.21);
        setHbdPrice(1.0);
        setEthPrice(2500);
        hasPrices.current = true;
      }
    } finally {
      setIsPriceLoading(false);
    }
  }, []); // Stable — no deps

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  useEffect(() => {
    if (!enableAutoRefresh) return;
    const interval = setInterval(fetchPrices, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchPrices, refreshInterval, enableAutoRefresh]);

  return {
    hivePrice,
    hbdPrice,
    ethPrice,
    isPriceLoading,
    error,
    lastUpdated,
    refreshPrices: fetchPrices,
  };
}

export default useMarketPrices;
