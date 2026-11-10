/**
 * Feed API timeout + Hive fallback, without real long waits.
 * Run with tsx: npx tsx lib/feed/__tests__/feedApiFallback.test.ts
 */
import assert from "node:assert";
import { FEED_API_TIMEOUT_MS, fetchWithTimeout, loadWithFallback } from "../feedApiFallback";

// A fetch that never answers on its own, only honors the abort signal: the
// stand-in for an API stuck for ~50s.
const hangingFetch = (_url: string, init?: { signal?: AbortSignal }) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
  });

async function main() {
  assert.strictEqual(FEED_API_TIMEOUT_MS, 20_000, "API leg budget");

  // 1. A hanging API request is cut off by the timeout.
  const t0 = Date.now();
  await assert.rejects(fetchWithTimeout("https://api.example/feed", 20, hangingFetch), (e: any) =>
    ["TimeoutError", "AbortError"].includes(e?.name)
  );
  assert.ok(Date.now() - t0 < 1000, "aborted quickly, no real wait");

  // 2. A fast API answer goes through untouched.
  const ok = await fetchWithTimeout("https://api.example/feed", 20, async () => new Response("[]", { status: 200 }));
  assert.strictEqual(ok.status, 200);

  // 3. Timeout -> fallback runs once, failure reported.
  let fallbackCalls = 0;
  let reported: unknown = null;
  const viaTimeout = await loadWithFallback(
    async () => {
      await fetchWithTimeout("https://api.example/feed", 20, hangingFetch);
      return ["api"];
    },
    async () => {
      fallbackCalls++;
      return ["hive"];
    },
    (r) => (reported = r)
  );
  assert.deepStrictEqual(viaTimeout, ["hive"]);
  assert.strictEqual(fallbackCalls, 1);
  assert.ok(reported, "timeout reported");

  // 4. API error response (null) -> fallback.
  fallbackCalls = 0;
  const viaError = await loadWithFallback(async () => null, async () => (fallbackCalls++, ["hive"]));
  assert.deepStrictEqual(viaError, ["hive"]);
  assert.strictEqual(fallbackCalls, 1);

  // 5. API success -> no fallback.
  fallbackCalls = 0;
  const viaApi = await loadWithFallback(async () => ["api"], async () => (fallbackCalls++, ["hive"]));
  assert.deepStrictEqual(viaApi, ["api"]);
  assert.strictEqual(fallbackCalls, 0);

  // 6. API error response (null) + failing fallback: the fallback runs exactly
  //    once and its error reaches the caller. (The old hook ran it a second
  //    time from its catch block.)
  fallbackCalls = 0;
  await assert.rejects(
    loadWithFallback(async () => null, async () => {
      fallbackCalls++;
      throw new Error("hive down");
    }),
    /hive down/
  );
  assert.strictEqual(fallbackCalls, 1, "fallback must not run twice");

  // 7. Both fail -> the fallback's error reaches the caller (hook logs it).
  await assert.rejects(
    loadWithFallback(async () => {
      throw new Error("api down");
    }, async () => {
      throw new Error("hive down");
    }),
    /hive down/
  );

  console.log("feedApiFallback: all tests passed");
}

// AbortSignal.timeout uses an unref'd timer: without something holding the
// event loop, Node would exit mid-test with code 0 and skip the assertions.
const keepAlive = setInterval(() => {}, 1000);
main()
  .then(() => clearInterval(keepAlive))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
