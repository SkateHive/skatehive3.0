"use client";

import { useEffect, useState } from "react";
import { fetchMorphoVaultApy, MORPHO_USDC_VAULT } from "@/lib/evm/earn";
import { useHbdSavingsRate } from "./useHbdSavingsRate";
import type { JarCurrency } from "./useSavingsJars";

/**
 * Yearly rate a jar's money earns, for display only: the Hive HBD savings APR,
 * or the Morpho USDC vault APY (null until it loads or if the API fails).
 */
export function useJarRate(currency: JarCurrency | undefined): number | null {
  const hbdRate = useHbdSavingsRate();
  const [usdcApy, setUsdcApy] = useState<number | null>(null);
  const needsUsdc = currency === "USDC";

  useEffect(() => {
    if (!needsUsdc) return;
    let cancelled = false;
    fetchMorphoVaultApy(MORPHO_USDC_VAULT.address).then((apy) => {
      if (!cancelled) setUsdcApy(apy);
    });
    return () => {
      cancelled = true;
    };
  }, [needsUsdc]);

  if (currency === "USDC") return usdcApy;
  return hbdRate;
}
