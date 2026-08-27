/**
 * Unit tests for redactIdentityMetadata / redactIdentityRows
 * Run with tsx: npx tsx lib/userbase/__tests__/identityMetadata.test.ts
 *
 * The whole risk of the redaction change is one mistake: dropping
 * `signer_status` along with `signer_uuid`. `signer_status` has two live
 * client consumers (SnapComposer, AppAccountSetupChecklist) and losing it
 * leaves the composer unable to tell an approved signer from a missing one —
 * trading a low-risk exposure for a broken app. That case is pinned first and
 * is the reason this file exists.
 */

import {
  redactIdentityMetadata,
  redactIdentityRows,
} from "../identityMetadata";

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
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(message || `Expected ${b}, but got ${a}`);
  }
}

describe("redactIdentityMetadata — the signer pair", () => {
  it("removes signer_uuid and KEEPS signer_status", () => {
    const result = redactIdentityMetadata({
      signer_uuid: "b1e7c0de-0000-4000-8000-000000000000",
      signer_status: "approved",
    }) as Record<string, unknown>;

    assertEqual(
      "signer_uuid" in result,
      false,
      "signer_uuid must not survive redaction"
    );
    assertEqual(
      result.signer_status,
      "approved",
      "signer_status must survive — SnapComposer reads it"
    );
  });

  it("keeps signer_status for every status value, not just approved", () => {
    for (const status of ["approved", "pending_approval", "revoked", null]) {
      const result = redactIdentityMetadata({
        signer_uuid: "x",
        signer_status: status,
      }) as Record<string, unknown>;
      assertEqual(result.signer_status, status, `status ${String(status)}`);
      assertEqual("signer_uuid" in result, false);
    }
  });

  it("leaves every unrelated key untouched", () => {
    const result = redactIdentityMetadata({
      signer_uuid: "secret",
      signer_status: "approved",
      verifications: ["0xabc"],
      pfp_url: "https://example.invalid/a.png",
      display_name: "Skater",
      bio: "kickflip",
    });

    assertDeepEqual(result, {
      signer_status: "approved",
      verifications: ["0xabc"],
      pfp_url: "https://example.invalid/a.png",
      display_name: "Skater",
      bio: "kickflip",
    });
  });
});

describe("redactIdentityMetadata — inputs that must not explode", () => {
  it("passes null through", () => {
    assertEqual(redactIdentityMetadata(null), null);
  });

  it("passes undefined through", () => {
    assertEqual(redactIdentityMetadata(undefined), undefined);
  });

  it("handles metadata with no signer_uuid at all", () => {
    const result = redactIdentityMetadata({ pfp_url: "x", bio: "y" });
    assertDeepEqual(result, { pfp_url: "x", bio: "y" });
  });

  it("handles an empty object", () => {
    assertDeepEqual(redactIdentityMetadata({}), {});
  });

  it("passes a scalar through rather than coercing it", () => {
    // jsonb does not guarantee an object; an older write could have left one.
    assertEqual(redactIdentityMetadata("just a string"), "just a string");
    assertEqual(redactIdentityMetadata(42), 42);
  });

  it("passes an array through", () => {
    assertDeepEqual(redactIdentityMetadata([1, 2]), [1, 2]);
  });

  it("does not mutate its input", () => {
    const input = { signer_uuid: "secret", signer_status: "approved" };
    redactIdentityMetadata(input);
    assertEqual(
      input.signer_uuid,
      "secret",
      "the caller's object must be untouched"
    );
  });
});

describe("redactIdentityRows", () => {
  it("redacts every row and preserves the other columns", () => {
    const rows = [
      {
        id: "1",
        type: "farcaster",
        handle: "skater",
        metadata: { signer_uuid: "secret", signer_status: "approved" },
      },
      {
        id: "2",
        type: "hive",
        handle: "skateuser",
        metadata: { some: "thing" },
      },
    ];

    const result = redactIdentityRows(rows);

    assertDeepEqual(result, [
      {
        id: "1",
        type: "farcaster",
        handle: "skater",
        metadata: { signer_status: "approved" },
      },
      { id: "2", type: "hive", handle: "skateuser", metadata: { some: "thing" } },
    ]);
  });

  it("handles an empty list and a row with null metadata", () => {
    assertDeepEqual(redactIdentityRows([]), []);
    assertDeepEqual(redactIdentityRows([{ id: "1", metadata: null }]), [
      { id: "1", metadata: null },
    ]);
  });

  it("does not mutate the original rows", () => {
    const rows = [{ metadata: { signer_uuid: "secret" } }];
    redactIdentityRows(rows);
    assertEqual(rows[0].metadata.signer_uuid, "secret");
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
    console.log("\n✨ All identity metadata redaction tests completed!\n");
  }
})();
