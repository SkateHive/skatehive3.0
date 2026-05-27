/**
 * Poll the Hive blockchain for a freshly-broadcast comment until it shows
 * up on `condenser_api.get_content`, or the timeout expires.
 *
 * Why this exists: `aioha.comment()` / our /api/userbase/hive/comment route
 * return as soon as the operation is accepted by the relay node — that's
 * BEFORE it lands in a block (~3 s typical). If we fire downstream
 * cross-posts (Farcaster, Instagram) immediately, scrapers and the Warpcast
 * frame renderer can hit our /post/{author}/{permlink} page during the
 * confirmation window, get "Snap not found" metadata back, and cache that
 * empty response.
 *
 * Polling get_content gates the cross-post fires on the snap actually
 * being indexable, so embeds always render correctly on first scrape.
 */

import HiveClient from "@/lib/hive/hiveclient";

interface WaitForHivePostOptions {
  /** How long to keep polling before giving up. Default 5 s. */
  timeoutMs?: number;
  /** Delay between attempts. Default 750 ms — Hive blocks are ~3 s, so
   *  we hit at most ~4 attempts in a typical 3 s confirmation window. */
  intervalMs?: number;
}

/**
 * Returns true if the comment was confirmed within the timeout. Returns
 * false on timeout. Never throws — network/RPC errors are treated like
 * "not yet" and we keep polling.
 */
export async function waitForHivePost(
  author: string,
  permlink: string,
  options: WaitForHivePostOptions = {}
): Promise<boolean> {
  const { timeoutMs = 5_000, intervalMs = 750 } = options;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const post: any = await HiveClient.database.call("get_content", [
        author,
        permlink,
      ]);
      // get_content returns an object with empty author/permlink when the
      // post doesn't exist yet — that's the "not yet" signal, not an error.
      if (post && post.author && post.permlink === permlink) {
        return true;
      }
    } catch {
      // Network blip — fall through and try again next tick.
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(intervalMs, remaining)));
  }

  return false;
}
