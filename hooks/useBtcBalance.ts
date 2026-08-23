import { useState, useEffect } from "react";
import { validateBtcAddress } from "@/lib/utils/validateBtcAddress";

interface BtcBalanceState {
  /** Confirmed balance in BTC, or null while loading / when no address. */
  balanceBtc: number | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Fetches the confirmed on-chain BTC balance for a self-claimed address via
 * the app's `/api/bitcoin/balance/[address]` proxy (mempool.space).
 * Returns null balance when the address is empty or invalid.
 */
export function useBtcBalance(address?: string | null): BtcBalanceState {
  const [balanceBtc, setBalanceBtc] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const addr = (address || "").trim();
    if (!addr || !validateBtcAddress(addr)) {
      setBalanceBtc(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/bitcoin/balance/${encodeURIComponent(addr)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setBalanceBtc(typeof data?.balanceBtc === "number" ? data.balanceBtc : 0);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch BTC balance");
        setBalanceBtc(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [address]);

  return { balanceBtc, isLoading, error };
}

export default useBtcBalance;
