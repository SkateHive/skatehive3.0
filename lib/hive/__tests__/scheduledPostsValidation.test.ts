/**
 * Unit tests for scheduled-posts validation and utility functions.
 * Run with: pnpm exec tsx lib/hive/__tests__/scheduledPostsValidation.test.ts
 */

import {
  validateScheduledAt,
  canCancelPost,
  buildScheduledPostOps,
} from "../../userbase/scheduledPostUtils";
import {
  hasGrantedPostingAuthority,
  PostingAuthorityError,
} from "../postingAuthorityBroadcast";
import HiveClient from "../hiveclient";

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
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) throw new Error(message || "Expected condition to be true");
}

function assertFalse(condition: boolean, message?: string) {
  if (condition) throw new Error(message || "Expected condition to be false");
}

async function assertThrows(
  fn: () => Promise<any>,
  check: (err: unknown) => void
): Promise<void> {
  try {
    await fn();
    throw new Error("Expected function to throw but it did not");
  } catch (err) {
    check(err);
  }
}

async function withMockedGetAccounts<T>(
  mock: (usernames: string[]) => Promise<any[]>,
  run: () => Promise<T>
): Promise<T> {
  const original = HiveClient.database.getAccounts.bind(HiveClient.database);
  (HiveClient.database as any).getAccounts = mock;
  try {
    return await run();
  } finally {
    (HiveClient.database as any).getAccounts = original;
  }
}

async function withEnv<T>(
  vars: Record<string, string | undefined>,
  run: () => Promise<T>
): Promise<T> {
  const saved: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    return await run();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

// Ensure env vars are set for authority-check tests
process.env.DEFAULT_HIVE_POSTING_ACCOUNT = "skateuser";
process.env.DEFAULT_HIVE_POSTING_KEY = "mock-posting-key-not-real";

// ---------------------------------------------------------------------------
describe("validateScheduledAt", () => {
  it("accepts a valid ISO date in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const result = validateScheduledAt(future);
    assertTrue(result.valid, "Should accept a future date");
  });

  it("rejects a date in the past", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = validateScheduledAt(past);
    assertFalse(result.valid, "Should reject a past date");
    assertTrue(
      (result.error ?? "").includes("future"),
      "Error should mention 'future'"
    );
  });

  it("rejects an invalid date string", () => {
    const result = validateScheduledAt("not-a-date");
    assertFalse(result.valid);
    assertTrue((result.error ?? "").toLowerCase().includes("valid"));
  });

  it("rejects missing value", () => {
    const result = validateScheduledAt(undefined);
    assertFalse(result.valid);
    assertEqual(result.error, "scheduled_at is required");
  });

  it("rejects non-string value", () => {
    const result = validateScheduledAt(12345);
    assertFalse(result.valid);
  });
});

// ---------------------------------------------------------------------------
describe("canCancelPost", () => {
  const OWNER_ID = "user-aaa";
  const OTHER_ID = "user-bbb";

  it("allows the owner to cancel a pending post", () => {
    const result = canCancelPost({ user_id: OWNER_ID, status: "pending" }, OWNER_ID);
    assertTrue(result.allowed);
  });

  it("rejects a different user (NOT_OWNER)", () => {
    const result = canCancelPost({ user_id: OWNER_ID, status: "pending" }, OTHER_ID);
    assertFalse(result.allowed, "Another user must not be able to cancel");
    assertEqual(result.code, "NOT_OWNER");
  });

  it("rejects cancelling an already-broadcasted post (NOT_PENDING)", () => {
    const result = canCancelPost({ user_id: OWNER_ID, status: "broadcasted" }, OWNER_ID);
    assertFalse(result.allowed, "Cannot cancel a broadcasted post");
    assertEqual(result.code, "NOT_PENDING");
  });

  it("rejects cancelling a failed post (NOT_PENDING)", () => {
    const result = canCancelPost({ user_id: OWNER_ID, status: "failed" }, OWNER_ID);
    assertFalse(result.allowed);
    assertEqual(result.code, "NOT_PENDING");
  });

  it("rejects cancelling an already-cancelled post (NOT_PENDING)", () => {
    const result = canCancelPost({ user_id: OWNER_ID, status: "cancelled" }, OWNER_ID);
    assertFalse(result.allowed);
    assertEqual(result.code, "NOT_PENDING");
  });
});

// ---------------------------------------------------------------------------
describe("buildScheduledPostOps", () => {
  const BASE_POST = {
    hive_author: "vaipraonde",
    parent_author: "",
    parent_permlink: "hive-173115",
    permlink: "my-skate-clip-2026",
    title: "My Skate Clip",
    body: "Sick trick",
    json_metadata: { tags: ["skatehive"], app: "skatehive/1.0" },
    beneficiaries: [] as Array<{ account: string; weight: number }>,
  };

  it("returns a comment op as the first operation", () => {
    const ops = buildScheduledPostOps(BASE_POST);
    assertTrue(ops.length >= 1, "Should produce at least one op");
    const [type, payload] = ops[0] as any;
    assertEqual(type, "comment");
    assertEqual(payload.author, "vaipraonde");
    assertEqual(payload.permlink, "my-skate-clip-2026");
    assertEqual(payload.parent_permlink, "hive-173115");
  });

  it("serializes json_metadata as a JSON string in the comment op", () => {
    const ops = buildScheduledPostOps(BASE_POST);
    const [, payload] = ops[0] as any;
    const parsed = JSON.parse(payload.json_metadata);
    assertEqual(parsed.app, "skatehive/1.0");
  });

  it("does not add comment_options when beneficiaries is empty", () => {
    const ops = buildScheduledPostOps(BASE_POST);
    assertEqual(ops.length, 1, "No comment_options without beneficiaries");
  });

  it("adds comment_options when beneficiaries are present and valid", () => {
    const postWithBeneficiary = {
      ...BASE_POST,
      beneficiaries: [{ account: "skatehive", weight: 1000 }],
    };
    const ops = buildScheduledPostOps(postWithBeneficiary);
    assertEqual(ops.length, 2, "Should have comment + comment_options");
    const [type] = ops[1] as any;
    assertEqual(type, "comment_options");
  });

  it("skips comment_options when beneficiary total weight exceeds 100%", () => {
    const postOverWeight = {
      ...BASE_POST,
      beneficiaries: [{ account: "skatehive", weight: 10001 }],
    };
    const ops = buildScheduledPostOps(postOverWeight);
    assertEqual(ops.length, 1, "Over-weight beneficiaries should be silently dropped");
  });
});

// ---------------------------------------------------------------------------
describe("hasGrantedPostingAuthority — rejection path (used by schedule creation)", () => {
  it("returns false when account has no account_auths (authority not granted)", async () => {
    const account = {
      name: "vaipraonde",
      posting: { weight_threshold: 1, account_auths: [], key_auths: [] },
    };
    await withMockedGetAccounts(async () => [account], async () => {
      const result = await hasGrantedPostingAuthority("vaipraonde");
      assertFalse(result, "Should return false — schedule creation must reject with 403");
    });
  });

  it("returns true when authority is properly granted (schedule creation succeeds)", async () => {
    const account = {
      name: "vaipraonde",
      posting: {
        weight_threshold: 1,
        account_auths: [["skateuser", 1]],
        key_auths: [],
      },
    };
    await withMockedGetAccounts(async () => [account], async () => {
      const result = await hasGrantedPostingAuthority("vaipraonde");
      assertTrue(result);
    });
  });

  it("throws PostingAuthorityError(CONFIG_MISSING) when env vars absent — returns 503 in route", async () => {
    await withEnv(
      {
        DEFAULT_HIVE_POSTING_ACCOUNT: undefined,
        DEFAULT_HIVE_POSTING_KEY: undefined,
      },
      async () => {
        await assertThrows(
          () => hasGrantedPostingAuthority("vaipraonde"),
          (err) => {
            assertTrue(err instanceof PostingAuthorityError);
            assertEqual((err as PostingAuthorityError).code, "CONFIG_MISSING");
          }
        );
      }
    );
  });
});

// ---------------------------------------------------------------------------
(async () => {
  for (const test of tests) {
    await test();
  }
  if (hasFailures) {
    console.log("\n❌ Some tests failed!\n");
    process.exit(1);
  } else {
    console.log("\n✨ All scheduledPostsValidation tests passed!\n");
  }
})();
