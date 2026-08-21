/**
 * Unit tests for isValidAmount.
 * Run with tsx: npx tsx components/shared/TipModal/__tests__/validateAmount.test.ts
 */

import assert from "node:assert";
import { isValidAmount } from "../validateAmount";

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

console.log("\n📦 isValidAmount");

it("accepts a plain integer", () => {
  assert.strictEqual(isValidAmount("5"), true);
});

it("accepts a decimal", () => {
  assert.strictEqual(isValidAmount("0.001"), true);
});

it("rejects trailing garbage — the exact BaseTipTab crash case", () => {
  // parseFloat("1abc") === 1, which used to slip past validation and reach
  // viem's parseUnits with the untouched string, throwing uncaught.
  assert.strictEqual(isValidAmount("1abc"), false);
});

it("rejects leading garbage", () => {
  assert.strictEqual(isValidAmount("abc1"), false);
});

it("rejects zero", () => {
  assert.strictEqual(isValidAmount("0"), false);
});

it("rejects negative numbers", () => {
  assert.strictEqual(isValidAmount("-5"), false);
});

it("rejects empty string", () => {
  assert.strictEqual(isValidAmount(""), false);
});

it("rejects whitespace-only", () => {
  assert.strictEqual(isValidAmount("   "), false);
});

it("tolerates surrounding whitespace on an otherwise valid amount", () => {
  assert.strictEqual(isValidAmount("  1.5  "), true);
});

it("rejects multiple decimal points", () => {
  assert.strictEqual(isValidAmount("1.2.3"), false);
});

(async () => {
  for (const run of tests) run();
  if (hasFailures) {
    console.error("\n❌ isValidAmount tests failed\n");
    process.exit(1);
  }
  console.log("\n✅ isValidAmount tests passed\n");
})();
