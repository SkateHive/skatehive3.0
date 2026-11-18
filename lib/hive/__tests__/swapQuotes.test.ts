/**
 * Unit tests for HIVE <-> HBD swap quotes.
 * Run with tsx: npx tsx lib/hive/__tests__/swapQuotes.test.ts
 *
 * These pin what the swap screen promises: the market route walks the real order
 * book, and the protocol routes follow hived's integer math (half converted now at
 * the minimum price minus 5%, the rest locked 3.5 days and charged 5% again).
 */

import assert from "assert";
import {
  buildMarketOrder,
  formatMilli,
  parseAsset,
  parseFeedPrice,
  quoteCollateralizedConvert,
  quoteConvert,
  quoteMarketSwap,
  toMilli,
  type FeedHistory,
  type RawOrderBook,
} from "../swapQuotes";

const tests: Array<[string, () => void]> = [];
const it = (name: string, fn: () => void) => tests.push([name, fn]);

const feed: FeedHistory = {
  current_median_history: { base: "0.039 HBD", quote: "1.000 HIVE" },
  market_median_history: { base: "0.039 HBD", quote: "1.000 HIVE" },
  current_min_history: { base: "0.038 HBD", quote: "1.000 HIVE" },
};

// Shape of condenser_api.get_order_book: bids pay HBD for HIVE, asks sell HIVE for HBD.
const book: RawOrderBook = {
  bids: [
    { hive: 20000, hbd: 800, order_price: { base: "0.800 HBD", quote: "20.000 HIVE" } }, // 0.040
    { hive: 100000, hbd: 3800, order_price: { base: "3.800 HBD", quote: "100.000 HIVE" } }, // 0.038
  ],
  asks: [
    { hive: 25000, hbd: 1000, order_price: { base: "25.000 HIVE", quote: "1.000 HBD" } }, // 0.040
    { hive: 50000, hbd: 2500, order_price: { base: "50.000 HIVE", quote: "2.500 HBD" } }, // 0.050
  ],
};

it("parses assets and prices in either orientation", () => {
  assert.strictEqual(parseAsset("0.039 HBD").amount, 39n);
  assert.strictEqual(parseAsset("12.5 HIVE").amount, 12500n);
  assert.deepStrictEqual(parseFeedPrice({ base: "0.039 HBD", quote: "1.000 HIVE" }), { hbd: 39n, hive: 1000n });
  assert.deepStrictEqual(parseFeedPrice({ base: "25.000 HIVE", quote: "1.000 HBD" }), { hbd: 1000n, hive: 25000n });
});

it("converts user input to milli-units and back", () => {
  assert.strictEqual(toMilli("100"), 100000n);
  assert.strictEqual(toMilli("0.1"), 100n);
  assert.strictEqual(toMilli("1.2345"), 1234n);
  assert.strictEqual(toMilli(""), 0n);
  assert.strictEqual(toMilli("-3"), 0n);
  assert.strictEqual(formatMilli(1809n, "HBD"), "1.809 HBD");
});

it("HIVE -> HBD collateralized: half now at min price minus 5%, rest returned after settlement", () => {
  const q = quoteCollateralizedConvert(100000n, feed);
  // 50 HIVE * 0.038 / 1.05 = 1.8095 -> 1.809 HBD
  assert.strictEqual(q.hbdNow, 1809n);
  // 1.809 HBD / 0.039 * 1.05 = 48.7038 -> 48.703 HIVE kept
  assert.strictEqual(q.hiveRequired, 48703n);
  assert.strictEqual(q.hiveReturned, 51297n);
  // Not 0.5%: with the fee charged twice and the min price, ~4.8% here.
  assert.ok(q.effectiveCost > 0.045 && q.effectiveCost < 0.05, `cost ${q.effectiveCost}`);
});

it("collateralized cost is the 5% fee (1 - 1/1.05) when prices hold", () => {
  const flat: FeedHistory = { ...feed, current_min_history: feed.current_median_history };
  const q = quoteCollateralizedConvert(1000000n, flat);
  assert.ok(Math.abs(q.effectiveCost - (1 - 1 / 1.05)) < 0.001, `cost ${q.effectiveCost}`);
  // The chain keeps about half the collateral and returns the rest.
  assert.ok(q.hiveReturned >= 499000n && q.hiveReturned <= 501000n, `returned ${q.hiveReturned}`);
});

it("HBD -> HIVE convert uses the median price with no fee", () => {
  assert.strictEqual(quoteConvert(3900n, feed).hiveOut, 100000n);
});

it("market HIVE -> HBD walks bids from the best price", () => {
  const q = quoteMarketSwap(book, "HIVE", 50000n);
  // 20 HIVE @ 0.040 + 30 HIVE @ 0.038 = 0.800 + 1.140
  assert.strictEqual(q.amountOut, 1940n);
  assert.ok(q.filled);
  assert.strictEqual(q.bestPrice, 0.04);
  assert.ok(Math.abs(q.averagePrice - 0.0388) < 1e-9);
  assert.ok(Math.abs(q.priceImpact - 0.03) < 1e-9);
  assert.strictEqual(q.minToReceive, 1930n); // 0.5% tolerance
});

it("market HBD -> HIVE walks asks from the best price", () => {
  const q = quoteMarketSwap(book, "HBD", 2000n);
  // 1 HBD buys 25 HIVE @ 0.040, the next 1 HBD buys 20 HIVE @ 0.050
  assert.strictEqual(q.amountOut, 45000n);
  assert.ok(q.filled);
  assert.ok(q.priceImpact > 0);
});

it("market quote reports when the book is too thin", () => {
  const q = quoteMarketSwap(book, "HIVE", 500000n);
  assert.strictEqual(q.filled, false);
});

it("market order is fill-or-kill with the slippage floor", () => {
  const q = quoteMarketSwap(book, "HIVE", 50000n);
  const [type, op] = buildMarketOrder("alice", q, Date.UTC(2026, 10, 17, 12, 0, 0), 42);
  assert.strictEqual(type, "limit_order_create");
  assert.deepStrictEqual(op, {
    owner: "alice",
    orderid: 42,
    amount_to_sell: "50.000 HIVE",
    min_to_receive: "1.930 HBD",
    fill_or_kill: true,
    expiration: "2026-11-17T13:00:00",
  });
});

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${name}\n    ${(err as Error).message}`);
  }
}
if (failed) {
  console.error(`\n${failed} failing`);
  process.exit(1);
}
console.log(`\nswapQuotes: ${tests.length} passing`);
