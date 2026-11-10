// Home feed: api.skatehive.app first, Hive nodes as the fallback.
//
// FEED_API_TIMEOUT_MS budgets only the API request. When it runs out (or the
// API answers with an error) the feed falls back to reading the Hive nodes,
// which has its own, separate cost, so the worst case for a page is this
// budget plus the fallback, not 8s in total.
export const FEED_API_TIMEOUT_MS = 8000;

type FetchLike = (input: string, init?: { signal?: AbortSignal }) => Promise<Response>;

/** fetch() that rejects once `timeoutMs` passes (TimeoutError / AbortError). */
export function fetchWithTimeout(
  url: string,
  timeoutMs: number = FEED_API_TIMEOUT_MS,
  fetchImpl: FetchLike = fetch
): Promise<Response> {
  return fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
}

/**
 * Run `primary`; if it throws or returns null (API error), run `fallback`.
 * Errors from the fallback propagate to the caller.
 */
export async function loadWithFallback<T>(
  primary: () => Promise<T | null>,
  fallback: () => Promise<T>,
  onPrimaryFailure: (reason: unknown) => void = () => {}
): Promise<T> {
  try {
    const result = await primary();
    if (result !== null) return result;
    onPrimaryFailure(new Error("feed API returned an error response"));
  } catch (error) {
    onPrimaryFailure(error);
  }
  return fallback();
}
