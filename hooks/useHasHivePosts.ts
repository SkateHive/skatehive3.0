"use client";

import { useEffect, useState } from "react";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";

// Cap the Hive post_count lookup so a stalled RPC node never leaves the hook
// stuck at null (which would silently prevent onboarding from showing).
const REQUEST_TIMEOUT_MS = 5000;

/**
 * Detects whether the viewer's linked Hive account already has on-chain
 * activity (posts or comments).
 *
 * Used to skip the onboarding intro-post step for users who linked an existing
 * Hive account that already has history — they don't need to introduce
 * themselves to the feed again.
 *
 * Return value:
 *   null  → still resolving the check (a Hive account is linked but post_count
 *           hasn't been fetched yet). Callers should not show onboarding while
 *           the value is null to avoid a flash of the post step.
 *   false → no linked Hive account, or the account has zero activity.
 *   true  → linked Hive account with post_count > 0.
 */
export function useHasHivePosts(): boolean | null {
  const { hiveIdentity } = useLinkedIdentities();
  const handle = hiveIdentity?.handle ?? null;
  const [hasPosts, setHasPosts] = useState<boolean | null>(null);

  useEffect(() => {
    // No linked Hive account → nothing to skip, resolve immediately.
    if (!handle) {
      setHasPosts(false);
      return;
    }

    let cancelled = false;
    setHasPosts(null);

    // Abort the request if it stalls, so hasPosts never stays stuck at null
    // (which would silently block onboarding from ever appearing).
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    (async () => {
      try {
        const res = await fetch("https://api.hive.blog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "condenser_api.get_accounts",
            params: [[handle]],
            id: 1,
          }),
          signal: controller.signal,
        });
        const data = await res.json();
        const postCount: number = data?.result?.[0]?.post_count ?? 0;
        if (!cancelled) setHasPosts(postCount > 0);
      } catch {
        // On failure/timeout/abort, fail open by resolving to false: showing
        // one extra (skippable) step is better than blocking the onboarding.
        if (!cancelled) setHasPosts(false);
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [handle]);

  return hasPosts;
}

export default useHasHivePosts;
