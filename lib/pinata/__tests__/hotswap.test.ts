/**
 * Unit tests for the Pinata Hot Swap actions.
 * Run with: npx tsx lib/pinata/__tests__/hotswap.test.ts
 *
 * These pin two things that were found the hard way, by auditing 159 CIDs
 * that had really been swapped:
 *
 *  1. The read endpoint NEEDS `?domain=`. Without it Pinata answers 400, the
 *     catch swallowed it, and getSwapHistory() returned [] — a value
 *     indistinguishable from "this CID has no swap". Every one of those 159
 *     read back as unswapped while all 159 were registered. A bug that
 *     answers with a plausible value is worse than one that throws.
 *
 *  2. removeSwap() must not answer `false`. Pinata answers 500 for DELETE on
 *     this account, and a bare boolean made "Pinata refused" look identical
 *     to "we never asked" — so a caller could not tell a live swap from an
 *     unknown one.
 */

import { getSwapHistory, removeSwap, swapCid } from "../hotswap";

const tests: Array<() => void | Promise<void>> = [];
let hasFailures = false;

function describe(name: string, fn: () => void) {
  console.log(`\n📦 ${name}`);
  fn();
}

function it(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      await fn();
      console.log(`  ✅ ${name}`);
    } catch (error) {
      console.error(`  ❌ ${name}`);
      console.error(`     ${error}`);
      hasFailures = true;
    }
  });
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) throw new Error(message || "Expected condition to be true");
}

process.env.PINATA_JWT = "test-jwt";

const realFetch = globalThis.fetch;
const realError = console.error;
const realLog = console.log;

interface Call {
  url: string;
  init?: RequestInit;
}

/** Swap fetch for a stub and capture what the module asked for. */
async function withFetch(
  responder: () => Response | Promise<Response> | never,
  run: (calls: Call[]) => Promise<void>
) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return await responder();
  }) as typeof fetch;
  // The module logs on every failure path; keep the test output readable.
  console.error = () => {};
  console.log = () => {};
  try {
    await run(calls);
  } finally {
    globalThis.fetch = realFetch;
    console.error = realError;
    console.log = realLog;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const CID = "QmQJtqoCZNLdE8ornkGJ7NZLxcEARMa3kCD9X5SnsFg9gT";
const OTHER = "Qma9LzuD9UnCfCL2eJqiS3zaz7A5vmk9i4MBk2CSvMZwAW";

describe("swap requests carry the gateway domain", () => {
  it("getSwapHistory sends ?domain= — without it Pinata answers 400", async () => {
    await withFetch(
      () => json({ data: [] }),
      async (calls) => {
        await getSwapHistory(CID);
        assertEqual(calls.length, 1);
        const url = new URL(calls[0].url);
        assertEqual(
          url.searchParams.get("domain"),
          "ipfs.skatehive.app",
          "the domain query param is what makes this endpoint answer at all"
        );
        assertTrue(url.pathname.endsWith(`/v3/ipfs/swap/${CID}`));
      }
    );
  });

  it("swapCid sends it too, so read and write address the same gateway", async () => {
    await withFetch(
      () => json({}),
      async (calls) => {
        await swapCid({ originalCid: CID, newCid: OTHER });
        assertEqual(
          new URL(calls[0].url).searchParams.get("domain"),
          "ipfs.skatehive.app"
        );
        assertEqual(calls[0].init?.method, "PUT");
        assertEqual(String(calls[0].init?.body), JSON.stringify({ swapCid: OTHER }));
      }
    );
  });

  it("removeSwap sends it too", async () => {
    await withFetch(
      () => json({}),
      async (calls) => {
        await removeSwap(CID);
        assertEqual(
          new URL(calls[0].url).searchParams.get("domain"),
          "ipfs.skatehive.app"
        );
        assertEqual(calls[0].init?.method, "DELETE");
      }
    );
  });
});

describe("getSwapHistory", () => {
  it("returns the registered swaps", async () => {
    const row = { mapped_cid: OTHER, created_at: "2026-08-27T20:34:49.780848Z" };
    await withFetch(
      () => json({ data: [row] }),
      async () => {
        const h = await getSwapHistory(CID);
        assertEqual(h.length, 1);
        assertEqual(h[0].mapped_cid, OTHER);
      }
    );
  });

  it("treats `data: null` as no swap — that is the real shape, not []", async () => {
    await withFetch(
      () => json({ data: null }),
      async () => assertEqual((await getSwapHistory(CID)).length, 0)
    );
  });

  it("does not throw when the API rejects the request", async () => {
    await withFetch(
      () => json({ error: { code: 400 } }, 400),
      async () => assertEqual((await getSwapHistory(CID)).length, 0)
    );
  });

  it("does not throw when the request never completes", async () => {
    await withFetch(
      () => {
        throw new Error("network down");
      },
      async () => assertEqual((await getSwapHistory(CID)).length, 0)
    );
  });
});

describe("removeSwap distinguishes its three outcomes", () => {
  it("reports a real removal", async () => {
    await withFetch(
      () => new Response("", { status: 200 }),
      async () => {
        const out = await removeSwap(CID);
        assertEqual(out.removed, true);
      }
    );
  });

  it("reports Pinata's 500 as a REFUSAL, with the status", async () => {
    // The known-broken case. The swap is still live after this.
    await withFetch(
      () => new Response("", { status: 500 }),
      async () => {
        const out = await removeSwap(CID);
        assertEqual(out.removed, false);
        assertTrue(!out.removed && out.reason === "rejected");
        assertTrue(!out.removed && out.reason === "rejected" && out.status === 500);
      }
    );
  });

  it("reports a request that never left as UNREACHABLE, not a refusal", async () => {
    // The distinction that a bare `false` destroyed: nobody refused anything
    // here, so the swap's state is unknown rather than known-still-there.
    await withFetch(
      () => {
        throw new Error("network down");
      },
      async () => {
        const out = await removeSwap(CID);
        assertEqual(out.removed, false);
        assertTrue(!out.removed && out.reason === "unreachable");
        assertTrue(!out.removed && out.error.includes("network down"));
      }
    );
  });

  it("reports a missing JWT as unreachable rather than throwing at the caller", async () => {
    const saved = process.env.PINATA_JWT;
    delete process.env.PINATA_JWT;
    try {
      await withFetch(
        () => new Response("", { status: 200 }),
        async () => {
          const out = await removeSwap(CID);
          assertEqual(out.removed, false);
          assertTrue(!out.removed && out.reason === "unreachable");
        }
      );
    } finally {
      process.env.PINATA_JWT = saved;
    }
  });
});

(async () => {
  for (const test of tests) await test();
  if (hasFailures) {
    console.log("\n❌ Some hot swap tests failed!\n");
    process.exit(1);
  } else {
    console.log("\n✨ All hot swap tests completed!\n");
  }
})();
