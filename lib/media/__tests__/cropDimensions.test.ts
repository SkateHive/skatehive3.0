/**
 * Unit tests for crop-output sizing.
 * Run with: npx tsx lib/media/__tests__/cropDimensions.test.ts
 */

import { computeCropOutput } from "../cropDimensions";

const tests: Array<() => void | Promise<void>> = [];
let hasFailures = false;

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

console.log("\n📦 computeCropOutput");

it("square (1:1) at 1080 → 1080x1080", () => {
  const o = computeCropOutput(1, 1080);
  assertEqual(o.width, 1080);
  assertEqual(o.height, 1080);
});

it("portrait 4:5 at 1080 → 864x1080 (long side = height)", () => {
  const o = computeCropOutput(4 / 5, 1080);
  assertEqual(o.width, 864);
  assertEqual(o.height, 1080);
});

it("landscape 16:9 at 1080 → 1080x608 (long side = width)", () => {
  const o = computeCropOutput(16 / 9, 1080);
  assertEqual(o.width, 1080);
  assertEqual(o.height, 608);
});

it("magazine cover (1000/1300) at 1300 → 1000x1300 (EditProfile back-compat)", () => {
  const o = computeCropOutput(1000 / 1300, 1300);
  assertEqual(o.width, 1000);
  assertEqual(o.height, 1300);
});

it("9:16 at 1080 → 608x1080", () => {
  const o = computeCropOutput(9 / 16, 1080);
  assertEqual(o.width, 608);
  assertEqual(o.height, 1080);
});

it("bad aspect falls back to square", () => {
  const o = computeCropOutput(0, 1080);
  assertEqual(o.width, 1080);
  assertEqual(o.height, 1080);
});

(async () => {
  for (const t of tests) await t();
  if (hasFailures) {
    console.error("\n❌ Some tests failed");
    process.exit(1);
  }
  console.log("\n✅ All tests passed");
})();
