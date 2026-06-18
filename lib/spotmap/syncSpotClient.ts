/**
 * Client-side helper that tells the spot map backend to ingest a freshly
 * posted Hive skatespot. Called by `SpotSnapComposer` right after the
 * broadcast succeeds so the new spot lands on /map within seconds
 * instead of waiting for the next 00:00 UTC bulk sync.
 *
 * The Hive RPC node we read from might not have propagated the new post
 * yet at the moment of broadcast, so we retry on a small backoff. If
 * everything fails the nightly cron is the reconciliation backstop and
 * the spot will appear by the next day at worst.
 *
 * Fire-and-forget — don't await this from the UI thread or the composer
 * modal will stay open for ~20s.
 */

const RETRY_DELAYS_MS = [3_000, 6_000, 12_000];

export function triggerSpotmapSyncOne(author: string, permlink: string): void {
  // Floating promise on purpose — we never want this to block the UI.
  void runWithRetry(author, permlink);
}

async function runWithRetry(author: string, permlink: string): Promise<void> {
  for (const delay of RETRY_DELAYS_MS) {
    await sleep(delay);
    try {
      const res = await fetch("/api/spotmap/sync-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ author, permlink }),
      });
      // 200 = upserted; everything else means the post wasn't ingestible
      // yet (RPC propagation delay, not-yet-a-spot, no coords, etc.) —
      // try again. 4xx with a permanent reason (e.g. validation 400)
      // we also retry — cheap, and the worst case is three wasted POSTs.
      if (res.ok) return;
    } catch {
      // Network blip — fall through to next retry.
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
