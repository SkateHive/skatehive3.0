/**
 * Unit tests for cofrinhos Hive-signature auth (pure logic only).
 * Run with: npx tsx lib/cofrinhos/__tests__/auth.test.ts
 *
 * Covers the challenge lifecycle (build → verify → parsed fields) and the
 * posting-authority weight rule. The paths that need infrastructure are
 * exercised manually instead: nonce consumption (needs Postgres, migration
 * 0027) via the curl-replay check, and the Aioha account-switch flow in the
 * browser — see PR #206.
 */

// The auth module reads JWT_SECRET lazily (inside hmac(), at call time), so
// setting it before the first buildChallenge call is enough for tests.
process.env.JWT_SECRET = "cofrinhos-test-secret";

import type { Authority } from "@hiveio/dhive";
import {
  buildChallenge,
  verifyChallenge,
  keySatisfiesPostingAuthority,
} from "../auth";

// Simple test runner (same pattern as lib/utils/__tests__)
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

function assertTrue(condition: boolean, message?: string) {
  if (!condition) {
    throw new Error(message || "Expected condition to be true");
  }
}

// Tests
describe("challenge lifecycle", () => {
  it("verifies a fresh challenge and returns its fields", () => {
    const { message } = buildChallenge("MtLouzada");
    const fields = verifyChallenge("mtlouzada", message);

    assertTrue(fields !== null, "Fresh challenge should verify");
    assertTrue(
      /^[0-9a-f]{24}$/.test(fields!.nonce),
      "Nonce should be 24 hex chars (12 random bytes)"
    );
    assertTrue(
      Math.abs(Date.now() - fields!.ts) < 5000,
      "Timestamp should be recent"
    );
  });

  it("returns the same nonce that appears in the message", () => {
    const { message } = buildChallenge("mtlouzada");
    const fields = verifyChallenge("mtlouzada", message);
    const nonceLine = message.match(/^Nonce: ([0-9a-f]+)$/m);

    assertTrue(!!fields && !!nonceLine, "Both should parse");
    assertEqual(
      fields!.nonce,
      nonceLine![1],
      "Parsed nonce must match the message — the verify route consumes it for replay protection"
    );
  });

  it("rejects a challenge presented for a different account", () => {
    const { message } = buildChallenge("mtlouzada");
    assertEqual(
      verifyChallenge("otheruser", message),
      null,
      "A challenge is bound to the account it was issued for"
    );
  });

  it("rejects a tampered stamp", () => {
    const { message } = buildChallenge("mtlouzada");
    const tampered = message.replace(/^Stamp: (.)/m, (_, c: string) =>
      `Stamp: ${c === "a" ? "b" : "a"}`
    );
    assertEqual(verifyChallenge("mtlouzada", tampered), null);
  });

  it("rejects tampering with the human-readable prose", () => {
    // The whole message is HMAC'd, not just the machine fields — otherwise an
    // attacker could reword what the user thinks they are signing.
    const { message } = buildChallenge("mtlouzada");
    const tampered = message.replace("prove you control", "PROVE YOU CONTROL");
    assertEqual(verifyChallenge("mtlouzada", tampered), null);
  });

  it("rejects an expired challenge (past the 10-min TTL)", () => {
    const { message } = buildChallenge("mtlouzada");
    const realNow = Date.now;
    try {
      Date.now = () => realNow() + 11 * 60 * 1000;
      assertEqual(verifyChallenge("mtlouzada", message), null);
    } finally {
      Date.now = realNow;
    }
  });
});

describe("posting authority weight rule", () => {
  const KEY_A = "STM7abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef1";
  const KEY_B = "STM8abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef2";

  function posting(
    threshold: number,
    keys: [string, number][]
  ): Authority {
    return {
      weight_threshold: threshold,
      account_auths: [],
      key_auths: keys,
    } as unknown as Authority;
  }

  it("accepts a normal single-key account (weight 1, threshold 1)", () => {
    assertTrue(keySatisfiesPostingAuthority(posting(1, [[KEY_A, 1]]), KEY_A));
  });

  it("rejects a low-weight key in a multisig setup (the CodeRabbit #16 fix)", () => {
    // Two keys of weight 1 with threshold 2: neither may act alone.
    assertEqual(
      keySatisfiesPostingAuthority(
        posting(2, [[KEY_A, 1], [KEY_B, 1]]),
        KEY_A
      ),
      false,
      "A key below the threshold must not unlock cofrinhos alone"
    );
  });

  it("accepts a key whose own weight meets a multisig threshold", () => {
    assertTrue(
      keySatisfiesPostingAuthority(posting(2, [[KEY_A, 2], [KEY_B, 1]]), KEY_A)
    );
  });

  it("rejects a key that is not in key_auths at all", () => {
    assertEqual(
      keySatisfiesPostingAuthority(posting(1, [[KEY_A, 1]]), KEY_B),
      false
    );
  });

  it("rejects when the authority object is missing", () => {
    assertEqual(keySatisfiesPostingAuthority(undefined, KEY_A), false);
  });

  it("rejects a malformed zero/negative threshold instead of passing everyone", () => {
    assertEqual(
      keySatisfiesPostingAuthority(posting(0, [[KEY_A, 1]]), KEY_A),
      false
    );
  });

  it("trims whitespace around the supplied key", () => {
    assertTrue(
      keySatisfiesPostingAuthority(posting(1, [[KEY_A, 1]]), `  ${KEY_A}  `)
    );
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
    console.log("\n✨ All cofrinhos auth tests completed!\n");
  }
})();
