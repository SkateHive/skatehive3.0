import { useCallback, useEffect, useState } from "react";
import HiveClient from "@/lib/hive/hiveclient";
import type { FeedHistory, RawOrderBook } from "@/lib/hive/swapQuotes";

const REFRESH_MS = 30_000;
const BOOK_DEPTH = 100;

export interface HiveSwapMarket {
  book: RawOrderBook | null;
  feed: FeedHistory | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Live internal-market order book and price feed, the inputs the chain itself
 * uses to settle market orders and conversions. Polls while mounted.
 */
export function useHiveSwapMarket(enabled = true): HiveSwapMarket {
  const [book, setBook] = useState<RawOrderBook | null>(null);
  const [feed, setFeed] = useState<FeedHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [nextBook, nextFeed] = await Promise.all([
        HiveClient.call("condenser_api", "get_order_book", [BOOK_DEPTH]),
        HiveClient.call("condenser_api", "get_feed_history", []),
      ]);
      setBook(nextBook as RawOrderBook);
      setFeed(nextFeed as FeedHistory);
      setError(null);
    } catch (err) {
      // Keep the last good snapshot; the next poll may recover.
      setError(err instanceof Error ? err.message : "Failed to load Hive market");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
  }, [enabled, refresh]);

  return { book, feed, isLoading, error, refresh };
}
