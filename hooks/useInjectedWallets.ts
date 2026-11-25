"use client";

import { useEffect, useState } from "react";
import {
  hasSkateWalletHiveFlag,
  isKeepKeyIdentity,
  isSkateWalletIdentity,
  type Eip6963ProviderInfo,
} from "@/lib/wallet/injectedWallets";

interface AnnounceEvent extends Event {
  detail?: { info?: Eip6963ProviderInfo };
}

export interface InjectedWallets {
  /** Every wallet that announced itself through EIP-6963. */
  announced: Eip6963ProviderInfo[];
  /** The Skate Wallet extension is installed (Hive flag or EIP-6963 rdns). */
  skateWallet: Eip6963ProviderInfo | null;
  skateWalletDetected: boolean;
  /** A KeepKey extension (KeepKey Client) announced itself. */
  keepKey: Eip6963ProviderInfo | null;
}

/**
 * Listens for EIP-6963 announcements and checks the Skate Wallet Hive flag.
 * Only listens while `enabled` (e.g. while the connect modal is open).
 */
export function useInjectedWallets(enabled = true): InjectedWallets {
  const [announced, setAnnounced] = useState<Eip6963ProviderInfo[]>([]);
  const [hiveFlag, setHiveFlag] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const onAnnounce = (event: Event) => {
      const info = (event as AnnounceEvent).detail?.info;
      if (!info?.uuid) return;
      setAnnounced((prev) =>
        prev.some((p) => p.uuid === info.uuid) ? prev : [...prev, info]
      );
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setHiveFlag(hasSkateWalletHiveFlag(window));

    return () => window.removeEventListener("eip6963:announceProvider", onAnnounce);
  }, [enabled]);

  const skateWallet = announced.find((w) => isSkateWalletIdentity(w)) ?? null;
  const keepKey = announced.find((w) => isKeepKeyIdentity(w)) ?? null;

  return {
    announced,
    skateWallet,
    skateWalletDetected: hiveFlag || !!skateWallet,
    keepKey,
  };
}
