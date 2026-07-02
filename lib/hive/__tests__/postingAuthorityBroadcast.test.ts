/**
 * Unit tests for posting authority broadcast utilities
 * Run with: pnpm exec tsx lib/hive/__tests__/postingAuthorityBroadcast.test.ts
 */

import { PrivateKey } from "@hiveio/dhive";
import HiveClient from "../hiveclient";
import {
  hasGrantedPostingAuthority,
  broadcastAsUserViaAuthority,
  PostingAuthorityError,
} from "../postingAuthorityBroadcast";

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

// Helpers to patch and restore HiveClient sub-clients
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

async function withMockedSendOperations<T>(
  mock: (ops: any, key: any) => Promise<any>,
  run: () => Promise<T>
): Promise<T> {
  const originalSendOps = HiveClient.broadcast.sendOperations.bind(HiveClient.broadcast);
  const originalFromString = PrivateKey.fromString;
  // Bypass WIF validation — the key object is only forwarded to the mocked sendOperations
  (PrivateKey as any).fromString = () => ({ __mock: true });
  (HiveClient.broadcast as any).sendOperations = mock;
  try {
    return await run();
  } finally {
    (HiveClient.broadcast as any).sendOperations = originalSendOps;
    (PrivateKey as any).fromString = originalFromString;
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

function makeAccount(
  accountAuths: Array<[string, number]>,
  weightThreshold = 1
) {
  return {
    name: "vaipraonde",
    posting: {
      weight_threshold: weightThreshold,
      account_auths: accountAuths,
      key_auths: [],
    },
  };
}

const SERVICE_ACCOUNT = "skateuser";
const SERVICE_KEY = "mock-posting-key-not-real";

const MOCK_TX: any = {
  id: "abc123",
  block_num: 12345,
  trx_num: 1,
  expired: false,
};

// Set env defaults before tests; individual tests may override via withEnv
process.env.DEFAULT_HIVE_POSTING_ACCOUNT = SERVICE_ACCOUNT;
process.env.DEFAULT_HIVE_POSTING_KEY = SERVICE_KEY;

describe("hasGrantedPostingAuthority", () => {
  it("returns true when service account is in account_auths with weight >= threshold", async () => {
    const account = makeAccount([[SERVICE_ACCOUNT, 1]], 1);
    await withMockedGetAccounts(async () => [account], async () => {
      const result = await hasGrantedPostingAuthority("vaipraonde");
      assertTrue(result, "Should return true when authority is granted");
    });
  });

  it("returns true when service account weight exceeds threshold", async () => {
    const account = makeAccount([[SERVICE_ACCOUNT, 5]], 1);
    await withMockedGetAccounts(async () => [account], async () => {
      const result = await hasGrantedPostingAuthority("vaipraonde");
      assertTrue(result);
    });
  });

  it("returns false when service account is not in account_auths", async () => {
    const account = makeAccount([["otheraccount", 1]], 1);
    await withMockedGetAccounts(async () => [account], async () => {
      const result = await hasGrantedPostingAuthority("vaipraonde");
      assertFalse(result, "Should return false when service account is absent");
    });
  });

  it("returns false when service account weight is below threshold", async () => {
    const account = makeAccount([[SERVICE_ACCOUNT, 1]], 2);
    await withMockedGetAccounts(async () => [account], async () => {
      const result = await hasGrantedPostingAuthority("vaipraonde");
      assertFalse(result, "Should return false when weight < threshold");
    });
  });

  it("returns false when hive account does not exist", async () => {
    await withMockedGetAccounts(async () => [], async () => {
      const result = await hasGrantedPostingAuthority("nonexistent");
      assertFalse(result);
    });
  });

  it("throws PostingAuthorityError(CONFIG_MISSING) when env vars are absent", async () => {
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

describe("broadcastAsUserViaAuthority", () => {
  const dummyOp: any = [
    "comment",
    {
      parent_author: "",
      parent_permlink: "skatehive",
      author: "vaipraonde",
      permlink: "my-skate-clip",
      title: "My Clip",
      body: "Rad trick",
      json_metadata: "{}",
    },
  ];

  it("broadcasts successfully and returns transaction confirmation", async () => {
    const account = makeAccount([[SERVICE_ACCOUNT, 1]], 1);
    let capturedOps: any;

    await withMockedGetAccounts(async () => [account], async () => {
      await withMockedSendOperations(async (ops) => {
        capturedOps = ops;
        return MOCK_TX;
      }, async () => {
        const result = await broadcastAsUserViaAuthority("vaipraonde", [dummyOp]);
        assertEqual(result.id, MOCK_TX.id);
        assertEqual(result.block_num, MOCK_TX.block_num);
        assertTrue(Array.isArray(capturedOps), "ops should be forwarded to sendOperations");
      });
    });
  });

  it("throws PostingAuthorityError(NOT_GRANTED) without calling sendOperations", async () => {
    const account = makeAccount([], 1);
    let broadcastCalled = false;

    await withMockedGetAccounts(async () => [account], async () => {
      await withMockedSendOperations(async () => {
        broadcastCalled = true;
        return MOCK_TX;
      }, async () => {
        await assertThrows(
          () => broadcastAsUserViaAuthority("vaipraonde", [dummyOp]),
          (err) => {
            assertTrue(err instanceof PostingAuthorityError);
            assertEqual((err as PostingAuthorityError).code, "NOT_GRANTED");
            assertFalse(broadcastCalled, "sendOperations must NOT be called when authority is absent");
          }
        );
      });
    });
  });

  it("throws PostingAuthorityError(CONFIG_MISSING) when env vars are absent", async () => {
    await withEnv(
      {
        DEFAULT_HIVE_POSTING_ACCOUNT: undefined,
        DEFAULT_HIVE_POSTING_KEY: undefined,
      },
      async () => {
        await assertThrows(
          () => broadcastAsUserViaAuthority("vaipraonde", [dummyOp]),
          (err) => {
            assertTrue(err instanceof PostingAuthorityError);
            assertEqual((err as PostingAuthorityError).code, "CONFIG_MISSING");
          }
        );
      }
    );
  });

  it("throws PostingAuthorityError(BROADCAST_FAILED) when sendOperations rejects", async () => {
    const account = makeAccount([[SERVICE_ACCOUNT, 1]], 1);

    await withMockedGetAccounts(async () => [account], async () => {
      await withMockedSendOperations(async () => {
        throw new Error("RC insufficient");
      }, async () => {
        await assertThrows(
          () => broadcastAsUserViaAuthority("vaipraonde", [dummyOp]),
          (err) => {
            assertTrue(err instanceof PostingAuthorityError);
            assertEqual((err as PostingAuthorityError).code, "BROADCAST_FAILED");
            assertTrue(
              (err as PostingAuthorityError).message.includes("RC insufficient"),
              "Error message should preserve the original dhive error"
            );
          }
        );
      });
    });
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
    console.log("\n✨ All postingAuthorityBroadcast tests passed!\n");
  }
})();
