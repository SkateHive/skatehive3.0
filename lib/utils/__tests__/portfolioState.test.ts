/**
 * Unit tests for resolvePortfolioState / mergeVerifiedPortfolios
 * Run with tsx: npx tsx lib/utils/__tests__/portfolioState.test.ts
 *
 * The bug being fixed: PortfolioContext treated a failed fetch as a result.
 * fetchPortfolio returned null on any error, and the caller then did
 * `if (portfolioChanged(prev, next)) setPortfolio(next)` — so a network
 * failure set the portfolio to null and blanked a wallet that was sitting
 * valid in localStorage. A failed read is "I don't know right now", not
 * "you have nothing", and the two must never render the same.
 */

import {
  resolvePortfolioState,
  mergeVerifiedPortfolios,
  type FetchOutcome,
} from "../portfolioState";

// Simple test runner
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
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message?: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(message || `Expected ${e}, but got ${a}`);
}

const CACHED = { totalNetWorth: 2440 } as any;
const FRESH = { totalNetWorth: 2483 } as any;

describe("resolvePortfolioState — the regression this fixes", () => {
  it("keeps the cached portfolio when the fetch fails", () => {
    const outcome: FetchOutcome<any> = { status: "failed", message: "network down" };
    assertEqual(resolvePortfolioState(CACHED, outcome), CACHED);
  });

  it("keeps the cached portfolio when the fetch is aborted", () => {
    // Abort happens on unmount and on address change — never a reason to blank.
    assertEqual(resolvePortfolioState(CACHED, { status: "aborted" }), CACHED);
  });

  it("replaces the cached portfolio on success", () => {
    assertEqual(resolvePortfolioState(CACHED, { status: "success", data: FRESH }), FRESH);
  });
});

describe("resolvePortfolioState — an empty wallet is still a result", () => {
  it("commits a genuinely empty portfolio, because that is an answer", () => {
    // A successful read of a wallet that really holds nothing must replace the
    // old value. Only FAILURE is barred from writing — not emptiness.
    const empty = { totalNetWorth: 0 } as any;
    assertEqual(resolvePortfolioState(CACHED, { status: "success", data: empty }), empty);
  });

  it("leaves null alone when there was nothing cached and the fetch failed", () => {
    assertEqual(resolvePortfolioState(null, { status: "failed", message: "boom" }), null);
  });
});

describe("mergeVerifiedPortfolios — per-address, same rule", () => {
  it("keeps an address's previous data when only that address failed", () => {
    const prev = { "0xaaa": CACHED, "0xbbb": CACHED };
    const merged = mergeVerifiedPortfolios(prev, [
      { address: "0xaaa", outcome: { status: "success", data: FRESH } },
      { address: "0xbbb", outcome: { status: "failed", message: "429" } },
    ]);
    assertEqual(merged["0xaaa"], FRESH, "the one that succeeded updates");
    assertEqual(merged["0xbbb"], CACHED, "the one that failed keeps its cache");
  });

  it("does not resurrect an address that is no longer in the list", () => {
    // Addresses drop out when the user unlinks them — that is not a failure.
    const prev = { "0xaaa": CACHED, "0xold": CACHED };
    const merged = mergeVerifiedPortfolios(prev, [
      { address: "0xaaa", outcome: { status: "success", data: FRESH } },
    ]);
    assertDeepEqual(Object.keys(merged), ["0xaaa"]);
  });

  it("adds an address that had no previous data", () => {
    const merged = mergeVerifiedPortfolios({}, [
      { address: "0xnew", outcome: { status: "success", data: FRESH } },
    ]);
    assertEqual(merged["0xnew"], FRESH);
  });

  it("omits an address that failed and had nothing cached", () => {
    const merged = mergeVerifiedPortfolios({}, [
      { address: "0xnew", outcome: { status: "failed", message: "timeout" } },
    ]);
    assertDeepEqual(Object.keys(merged), []);
  });

  it("keeps every address's cache when the whole batch fails", () => {
    // The shape of a full outage: nothing should disappear from the screen.
    const prev = { "0xaaa": CACHED, "0xbbb": CACHED };
    const merged = mergeVerifiedPortfolios(prev, [
      { address: "0xaaa", outcome: { status: "failed", message: "down" } },
      { address: "0xbbb", outcome: { status: "failed", message: "down" } },
    ]);
    assertDeepEqual(merged, prev);
  });
});

// Run all tests
(async () => {
  for (const test of tests) {
    await test();
  }

  if (hasFailures) {
    console.log("\n❌ Some tests failed!\n");
    process.exit(1);
  } else {
    console.log("\n✨ All portfolio state tests passed!\n");
  }
})();
