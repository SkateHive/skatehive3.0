/**
 * Unit tests for resolveEthPriceUsd
 * Run with tsx: npx tsx lib/evm/__tests__/ethPriceUsd.test.ts
 *
 * These pin the source priority for the native-ETH USD price. The bug being
 * fixed: /api/portfolio passed the upstream indexer's ETH price into a
 * parameter named `fallbackPrice` and returned it whenever it was > 0, so
 * CoinGecko was never consulted. The upstream price was stale — it reported
 * ETH near $2,032 while the market was near $2,483, understating every native
 * ETH balance by ~18%.
 *
 * The order here matches what lib/evm/erc20Balances.ts already does for
 * ERC-20s: the trusted price source wins, the upstream is only a fallback,
 * and a price nobody can determine is null — never 0, which the UI would
 * render as a real $0.00.
 */

import { resolveEthPriceUsd } from "../ethPriceUsd";

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

describe("resolveEthPriceUsd — the regression this fixes", () => {
  it("prefers CoinGecko over a stale upstream price", () => {
    // The exact shape of the reported bug: upstream $2,032 vs market $2,483.
    const resolved = resolveEthPriceUsd({
      coingeckoUsd: 2482.94,
      upstreamUsd: 2032.11,
    });
    assertEqual(resolved.priceUsd, 2482.94);
    assertEqual(resolved.source, "coingecko");
  });

  it("does not let a higher upstream price win either — priority is by source, not by value", () => {
    // Guards against "fix" by picking the max, which would be wrong the moment
    // the upstream is stale on the way down instead of on the way up.
    const resolved = resolveEthPriceUsd({
      coingeckoUsd: 2000,
      upstreamUsd: 9999,
    });
    assertEqual(resolved.priceUsd, 2000);
    assertEqual(resolved.source, "coingecko");
  });
});

describe("resolveEthPriceUsd — falling back", () => {
  it("uses the upstream price when CoinGecko is unavailable", () => {
    const resolved = resolveEthPriceUsd({
      coingeckoUsd: null,
      upstreamUsd: 2032.11,
    });
    assertEqual(resolved.priceUsd, 2032.11);
    assertEqual(resolved.source, "upstream");
  });

  it("uses the upstream price when CoinGecko answers with zero", () => {
    // CoinGecko returning 0 is not a claim that ETH is free — it is a failed read.
    const resolved = resolveEthPriceUsd({ coingeckoUsd: 0, upstreamUsd: 2032.11 });
    assertEqual(resolved.priceUsd, 2032.11);
    assertEqual(resolved.source, "upstream");
  });
});

describe("resolveEthPriceUsd — undeterminable is null, never zero", () => {
  it("returns null when neither source has a price", () => {
    const resolved = resolveEthPriceUsd({ coingeckoUsd: null, upstreamUsd: null });
    assertEqual(resolved.priceUsd, null);
    assertEqual(resolved.source, null);
  });

  it("returns null when both sources report zero", () => {
    const resolved = resolveEthPriceUsd({ coingeckoUsd: 0, upstreamUsd: 0 });
    assertEqual(resolved.priceUsd, null);
    assertEqual(resolved.source, null);
  });

  it("rejects a negative price instead of passing it through", () => {
    const resolved = resolveEthPriceUsd({ coingeckoUsd: -1, upstreamUsd: null });
    assertEqual(resolved.priceUsd, null);
    assertEqual(resolved.source, null);
  });

  it("rejects NaN instead of letting it poison every balanceUSD", () => {
    // Number(undefined) is NaN, and NaN * balance is NaN, which renders as
    // "$NaN" across the whole wallet.
    const resolved = resolveEthPriceUsd({ coingeckoUsd: NaN, upstreamUsd: NaN });
    assertEqual(resolved.priceUsd, null);
    assertEqual(resolved.source, null);
  });

  it("rejects Infinity", () => {
    const resolved = resolveEthPriceUsd({ coingeckoUsd: Infinity, upstreamUsd: null });
    assertEqual(resolved.priceUsd, null);
    assertEqual(resolved.source, null);
  });

  it("falls through a bad CoinGecko value to a good upstream one", () => {
    const resolved = resolveEthPriceUsd({ coingeckoUsd: NaN, upstreamUsd: 2032.11 });
    assertEqual(resolved.priceUsd, 2032.11);
    assertEqual(resolved.source, "upstream");
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
    console.log("\n✨ All ETH price tests passed!\n");
  }
})();
