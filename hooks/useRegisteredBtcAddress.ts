"use client";

import { useEffect, useState } from "react";

/**
 * The user's saved BTC address, reconciled across both storage paths so the
 * outbound Magi swap / Claim-to-BTC always sees it:
 *  1. on-chain Hive metadata (`extensions.wallets.btc_address`) — the source the
 *     swap historically read; pass it in as `metaAddress`.
 *  2. userbase DB (`GET /api/userbase/profile/btc`) — the keyless "self-claim"
 *     path; used as a fallback when the Hive metadata has none.
 *
 * Hive metadata wins when present; the DB is only queried when it's missing.
 */
export function useRegisteredBtcAddress(
  username: string | null | undefined,
  metaAddress: string
): string {
  const [dbAddr, setDbAddr] = useState("");

  useEffect(() => {
    // Metadata already has an address, or no session to query — nothing to do.
    if (metaAddress || !username) {
      setDbAddr("");
      return;
    }
    let cancelled = false;
    fetch("/api/userbase/profile/btc", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.address) setDbAddr(d.address as string);
      })
      .catch(() => {
        /* fallback is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, [username, metaAddress]);

  return metaAddress || dbAddr;
}
