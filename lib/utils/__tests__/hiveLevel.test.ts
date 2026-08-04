/**
 * Unit tests for getHiveLevel.
 * Run with tsx: npx tsx lib/utils/__tests__/hiveLevel.test.ts
 */

import assert from "node:assert";
import { getHiveLevel, MAX_LEVEL_HP } from "../hiveLevel";

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

console.log("\n📦 getHiveLevel");

it("hp 0 → level 0, aiming for Grom (L1) at 100", () => {
  const r = getHiveLevel(0);
  assert.strictEqual(r.level, 0);
  assert.strictEqual(r.name, null);
  assert.strictEqual(r.nextLevel, 1);
  assert.strictEqual(r.nextName, "Grom");
  assert.strictEqual(r.hpToNext, 100);
  assert.strictEqual(r.isMax, false);
});

it("hp 99 → still level 0, 1 HP to Grom", () => {
  const r = getHiveLevel(99);
  assert.strictEqual(r.level, 0);
  assert.strictEqual(r.hpToNext, 1);
});

it("hp 100 → exactly Grom (L1), next Local (L2) at 500", () => {
  const r = getHiveLevel(100);
  assert.strictEqual(r.level, 1);
  assert.strictEqual(r.name, "Grom");
  assert.strictEqual(r.nextLevel, 2);
  assert.strictEqual(r.nextName, "Local");
  assert.strictEqual(r.hpToNext, 400);
  assert.strictEqual(r.isMax, false);
});

it("hp 750 → Local (L2), 250 HP to Ripper (L3)", () => {
  const r = getHiveLevel(750);
  assert.strictEqual(r.level, 2);
  assert.strictEqual(r.name, "Local");
  assert.strictEqual(r.nextName, "Ripper");
  assert.strictEqual(r.hpToNext, 250);
});

it("hp 1500 → Shredder (L4), 500 HP to Nirvana (L5)", () => {
  const r = getHiveLevel(1500);
  assert.strictEqual(r.level, 4);
  assert.strictEqual(r.name, "Shredder");
  assert.strictEqual(r.nextName, "Nirvana");
  assert.strictEqual(r.hpToNext, 500);
});

it("hp 2000 → Nirvana (L5), maxed", () => {
  const r = getHiveLevel(2000);
  assert.strictEqual(r.level, 5);
  assert.strictEqual(r.name, "Nirvana");
  assert.strictEqual(r.nextLevel, null);
  assert.strictEqual(r.nextName, null);
  assert.strictEqual(r.hpToNext, null);
  assert.strictEqual(r.isMax, true);
});

it("hp above max → still Nirvana, maxed", () => {
  const r = getHiveLevel(9999);
  assert.strictEqual(r.level, 5);
  assert.strictEqual(r.isMax, true);
  assert.strictEqual(r.hpToNext, null);
});

it("fractional hp rounds HP-to-next up to a whole number", () => {
  const r = getHiveLevel(99.2);
  assert.strictEqual(r.level, 0);
  assert.strictEqual(r.hpToNext, 1); // ceil(100 - 99.2) = 1
});

it("negative / NaN hp treated as 0", () => {
  assert.strictEqual(getHiveLevel(-50).level, 0);
  assert.strictEqual(getHiveLevel(NaN).level, 0);
  assert.strictEqual(getHiveLevel(NaN).hpToNext, 100);
});

it("MAX_LEVEL_HP is 2000", () => {
  assert.strictEqual(MAX_LEVEL_HP, 2000);
});

(async () => {
  for (const run of tests) run();
  if (hasFailures) {
    console.error("\n❌ hiveLevel tests failed\n");
    process.exit(1);
  }
  console.log("\n✅ hiveLevel tests passed\n");
})();
