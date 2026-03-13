import { useState, useEffect, useCallback } from 'react';

interface MarketPrices {
  hivePrice: number | null;
  hbdPrice: number | null;
  ethPrice: number | null;
  isPriceLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

interface UseMarketPricesOptions {
  refreshInterval?: number; // in milliseconds, default 5 minutes
  enableAutoRefresh?: boolean; // default true
}

/**
 * Custom hook to fetch and manage Hive and HBD market prices from CoinGecko
 * 
 * Features:
 * - Automatic price fetching with configurable intervals
 * - Error handling with fallback prices
 * - Loading states
 * - Manual refresh capability
 * - Centralized price management to reduce API calls
 * 
 * @param options Configuration options
 * @returns Market prices, loading state, error, and refresh function
 */
export function useMarketPrices(options: UseMarketPricesOptions = {}): MarketPrices & { refreshPrices: () => Promise<void> } {
  const {
    refreshInterval = 300000, // 5 minutes default
    enableAutoRefresh = true
  } = options;

  const [hivePrice, setHivePrice] = useState<number | null>(null);
  const [hbdPrice, setHbdPrice] = useState<number | null>(null);
  const [ethPrice, setEthPrice] = useState<number | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchPrices = useCallback(async () => {
    try {
      setIsPriceLoading(true);
      setError(null);

      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=hive,hive_dollar,ethereum&vs_currencies=usd"
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Set prices with fallbacks
      const newHivePrice = data["hive"]?.usd || 0.21;
      const newHbdPrice = data["hive_dollar"]?.usd || 1.0;
      const newEthPrice = data["ethereum"]?.usd || 2500;

      setHivePrice(newHivePrice);
      setHbdPrice(newHbdPrice);
      setEthPrice(newEthPrice);
      setLastUpdated(new Date());

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);

      // Set fallback prices if we don't have any prices yet
      if (hivePrice === null || hbdPrice === null || ethPrice === null) {
        setHivePrice(0.21);
        setHbdPrice(1.0);
        setEthPrice(2500);
      }
    } finally {
      setIsPriceLoading(false);
    }
  }, [hivePrice, hbdPrice, ethPrice]);

  // Initial price fetch
  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  // Set up auto-refresh interval
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
