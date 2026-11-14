import { useEffect, useState } from "react";
import { fetchHbdInterestRate } from "@/lib/hive/savingsHistory";

/** Shown until the chain answers (and if it never does). */
export const HBD_RATE_FALLBACK = 0.1;

// One fetch per page load, shared by every component that shows the rate.
let cached: number | null = null;
let inflight: Promise<number | null> | null = null;

/**
 * Live HBD savings APR set by the witnesses (hbd_interest_rate), as a
 * fraction. Never hardcode it: it is a governance parameter and changes.
 */
export function useHbdSavingsRate(): number {
  const [rate, setRate] = useState(cached ?? HBD_RATE_FALLBACK);
  useEffect(() => {
    if (cached != null) return;
    let alive = true;
    inflight ??= fetchHbdInterestRate();
    inflight.then((r) => {
      if (r != null) cached = r;
      else inflight = null; // allow a retry on the next mount
      if (alive && r != null) setRate(r);
    });
    return () => {
      alive = false;
    };
  }, []);
  return rate;
}

/** "10%" — whole numbers without decimals, otherwise up to 2. */
export const formatRate = (rate: number) => `${+(rate * 100).toFixed(2)}%`;
