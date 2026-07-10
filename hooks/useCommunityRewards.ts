"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import { HIVE_CONFIG } from "@/config/app.config";

// Live community-rewards figures for the /home rewards card. Extracts the two
// fetches already used by components/shared/CommunityTotalPayout.tsx: the Hive
// community total payout (stats.hivehub.dev, a "$"-prefixed string) plus open
// poidh bounty USD (/api/poidh/bounties open + /api/prices for ETH→USD). Never
// stored in the config — always fetched fresh so no stale dollar figure ships.
const TAG = HIVE_CONFIG.COMMUNITY_TAG;

export function useCommunityRewards(): { totalUsd: number; openBountyUsd: number; loading: boolean } {
  const [totalUsd, setTotalUsd] = useState(0);
  const [openBountyUsd, setOpenBountyUsd] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`https://stats.hivehub.dev/communities?c=${TAG}`);
        const data = await res.json();
        const payout = parseFloat(String(data?.[TAG]?.total_payouts_hbd ?? "").replace("$", "") || "0");
        if (live && payout > 0) setTotalUsd(payout);
      } catch {
        /* leave 0 */
      }
    })();
    (async () => {
      try {
        const [bRes, pRes] = await Promise.all([
          fetch("/api/poidh/bounties?status=open&limit=100&filterSkate=true"),
          fetch("/api/prices"),
        ]);
        const bData = await bRes.json();
        const pData = await pRes.json();
        const ethPrice = pData?.ethereum?.usd ?? 2500;
        const bounties: Array<{ amount?: string }> = Array.isArray(bData?.bounties) ? bData.bounties : [];
        let usd = 0;
        for (const b of bounties) {
          try {
            usd += parseFloat(formatEther(BigInt(b.amount ?? "0"))) * ethPrice;
          } catch {
            /* skip malformed */
          }
        }
        if (live) setOpenBountyUsd(usd);
      } catch {
        /* leave 0 */
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  return { totalUsd, openBountyUsd, loading };
}
