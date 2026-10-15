/**
 * Unit tests for the leaderboard sort configuration.
 * Run with tsx: npx tsx app/leaderboard/__tests__/sortOptions.test.ts
 */

import assert from "node:assert";
import {
  SORT_OPTIONS,
  SORT_GROUPS,
  getSortConfig,
  isCheckSort,
  type SortOption,
} from "../sortOptions";
import { SkaterData } from "@/types/leaderboard";
import { ETH_ADDRESSES } from "@/config/app.config";

const tests: Array<() => void> = [];
let hasFailures = false;

function it(name: string, fn: () => void) {
  tests.push(() => {
    try {
      fn();
      console.log(`  ✅ ${name}`);
    } catch (error) {
      hasFailures = true;
      console.error(`  ❌ ${name}`);
      console.error(`     ${error}`);
    }
  });
}

function skater(overrides: Partial<SkaterData> = {}): SkaterData {
  return {
    id: 1,
    hive_author: "someskater",
    hive_balance: 0,
    hp_balance: 0,
    hbd_balance: 0,
    hbd_savings_balance: 0,
    has_voted_in_witness: false,
    eth_address: ETH_ADDRESSES.ZERO,
    gnars_balance: 0,
    gnars_votes: 0,
    skatehive_nft_balance: 0,
    max_voting_power_usd: 0,
    last_updated: "2026-09-12T00:00:00.000",
    last_post: "2026-09-01T00:00:00.000",
    post_count: 0,
    posts_score: 0,
    snaps_count: 0,
    delegated_curator: 0,
    points: 0,
    giveth_donations_usd: 0,
    giveth_donations_amount: 0,
    ...overrides,
  };
}

console.log("\n📦 leaderboard sort options");

it("every option is unique - a duplicate is what the old list shipped", () => {
  const values = SORT_OPTIONS.map((option) => option.value);
  assert.strictEqual(new Set(values).size, values.length);
});

it("every option sits in a declared group", () => {
  const groups = new Set(SORT_GROUPS.map((entry) => entry.group));
  for (const option of SORT_OPTIONS) {
    assert.ok(groups.has(option.group), `${option.value} has no group shelf`);
  }
});

it("every declared group renders at least one option", () => {
  for (const { group } of SORT_GROUPS) {
    assert.ok(
      SORT_OPTIONS.some((option) => option.group === group),
      `group ${group} would render empty`
    );
  }
});

it("every option carries a label and a description to show", () => {
  for (const option of SORT_OPTIONS) {
    assert.ok(option.labelKey.length > 0, `${option.value} has no label`);
    assert.ok(
      option.descriptionKey.length > 0,
      `${option.value} has no description`
    );
  }
});

it("options that report coverage know how to count it", () => {
  for (const option of SORT_OPTIONS) {
    if (option.coverage === "none") continue;
    assert.strictEqual(
      typeof option.countsSkater,
      "function",
      `${option.value} promises a count it cannot compute`
    );
  }
});

it("getSortConfig finds each option by value", () => {
  for (const option of SORT_OPTIONS) {
    assert.strictEqual(getSortConfig(option.value).value, option.value);
  }
});

it("getSortConfig falls back rather than returning undefined", () => {
  const config = getSortConfig("not-a-sort" as SortOption);
  assert.ok(config);
  assert.strictEqual(config.value, SORT_OPTIONS[0].value);
});

it("only the two checklists are check sorts", () => {
  const checks = SORT_OPTIONS.filter((option) => isCheckSort(option.value));
  assert.deepStrictEqual(
    checks.map((option) => option.value).sort(),
    ["eth", "witness"]
  );
});

console.log("\n📦 coverage counting");

it("a hasValue option counts only skaters above zero", () => {
  const nfts = getSortConfig("nfts");
  assert.strictEqual(nfts.coverage, "hasValue");
  assert.strictEqual(nfts.countsSkater!(skater({ skatehive_nft_balance: 3 })), true);
  assert.strictEqual(nfts.countsSkater!(skater({ skatehive_nft_balance: 0 })), false);
});

it("missing ETH counts the zero address as missing, not as a wallet", () => {
  const eth = getSortConfig("eth");
  assert.strictEqual(eth.coverage, "pending");
  assert.strictEqual(eth.countsSkater!(skater({ eth_address: ETH_ADDRESSES.ZERO })), true);
  assert.strictEqual(eth.countsSkater!(skater({ eth_address: "" })), true);
  assert.strictEqual(
    eth.countsSkater!(skater({ eth_address: "0x1234567890123456789012345678901234567890" })),
    false
  );
});

it("missing witness counts the skaters who have not voted", () => {
  const witness = getSortConfig("witness");
  assert.strictEqual(witness.coverage, "pending");
  assert.strictEqual(witness.countsSkater!(skater({ has_voted_in_witness: false })), true);
  assert.strictEqual(witness.countsSkater!(skater({ has_voted_in_witness: true })), false);
});

it("last updated reports no coverage - it ranks everyone", () => {
  assert.strictEqual(getSortConfig("last_updated").coverage, "none");
});

(async () => {
  for (const run of tests) run();
  if (hasFailures) {
    console.error("\n❌ leaderboard sortOptions tests failed\n");
    process.exit(1);
  }
  console.log("\n✅ leaderboard sortOptions tests passed\n");
})();
