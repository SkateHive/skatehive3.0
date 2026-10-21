/**
 * Unit tests for compose draft namespacing and migration
 * Run with tsx: npx tsx lib/compose/__tests__/drafts.test.ts
 *
 * The case this file exists for: a userbase user linked to Hive @alice while
 * a different Hive account (@bob) is active in the browser. @bob must not
 * absorb the userbase drafts, because migration deletes the source bucket.
 */

import {
  COMPOSE_DRAFTS_STORAGE_KEY,
  ComposeDraft,
  migrateComposeDrafts,
  readComposeDrafts,
  resolveComposeDraftKeys,
  writeComposeDrafts,
} from "../drafts";

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
      hasFailures = true;
      console.log(`  ❌ ${name}`);
      console.log(`     ${error instanceof Error ? error.message : error}`);
    }
  });
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${message ? message + ": " : ""}expected ${e}, got ${a}`);
  }
}

// Minimal in-memory localStorage so the storage helpers run under tsx.
function installStorage() {
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
    },
  };
  return store;
}

function draft(id: string, updatedAt = "2026-01-01T00:00:00.000Z"): ComposeDraft {
  return {
    id,
    title: id,
    markdown: "",
    hashtags: [],
    selectedThumbnail: null,
    uploadedThumbnail: null,
    beneficiaries: [],
    createdAt: updatedAt,
    updatedAt,
  };
}

const ids = (drafts: ComposeDraft[]) => drafts.map((d) => d.id).sort();

describe("resolveComposeDraftKeys", () => {
  it("lite user without Hive uses the userbase bucket, no aliases", () => {
    assertEqual(
      resolveComposeDraftKeys({ activeHiveHandle: null, linkedHiveHandle: null, userbaseId: "u1" }),
      { draftKey: "ub:u1", draftAliasKeys: [] }
    );
  });

  it("linked Hive account active claims the userbase bucket", () => {
    assertEqual(
      resolveComposeDraftKeys({ activeHiveHandle: "alice", linkedHiveHandle: "alice", userbaseId: "u1" }),
      { draftKey: "hive:alice", draftAliasKeys: ["ub:u1"] }
    );
  });

  it("matches the linked handle case-insensitively", () => {
    assertEqual(
      resolveComposeDraftKeys({ activeHiveHandle: "alice", linkedHiveHandle: "Alice", userbaseId: "u1" }),
      { draftKey: "hive:alice", draftAliasKeys: ["ub:u1"] }
    );
  });

  it("a different active Hive account does not claim the userbase bucket", () => {
    assertEqual(
      resolveComposeDraftKeys({ activeHiveHandle: "bob", linkedHiveHandle: "alice", userbaseId: "u1" }),
      { draftKey: "hive:bob", draftAliasKeys: [] }
    );
  });

  it("an active Hive account with no linked Hive identity does not claim it", () => {
    assertEqual(
      resolveComposeDraftKeys({ activeHiveHandle: "bob", linkedHiveHandle: null, userbaseId: "u1" }),
      { draftKey: "hive:bob", draftAliasKeys: [] }
    );
  });

  it("Keychain-only session with no userbase user has no aliases", () => {
    assertEqual(
      resolveComposeDraftKeys({ activeHiveHandle: "bob", linkedHiveHandle: null, userbaseId: null }),
      { draftKey: "hive:bob", draftAliasKeys: [] }
    );
  });
});

describe("migrateComposeDrafts with resolved keys", () => {
  it("keeps the userbase owner's drafts when another Hive account is active", () => {
    installStorage();
    writeComposeDrafts([draft("alice-draft")], "ub:u1");

    const { draftKey, draftAliasKeys } = resolveComposeDraftKeys({
      activeHiveHandle: "bob",
      linkedHiveHandle: "alice",
      userbaseId: "u1",
    });
    migrateComposeDrafts(draftKey, draftAliasKeys);

    assertEqual(ids(readComposeDrafts("hive:bob")), [], "bob must not receive them");
    assertEqual(ids(readComposeDrafts("ub:u1")), ["alice-draft"], "source must survive");
  });

  it("folds the userbase drafts into the linked Hive account", () => {
    installStorage();
    writeComposeDrafts([draft("lite-draft")], "ub:u1");
    writeComposeDrafts([draft("hive-draft")], "hive:alice");

    const { draftKey, draftAliasKeys } = resolveComposeDraftKeys({
      activeHiveHandle: "alice",
      linkedHiveHandle: "alice",
      userbaseId: "u1",
    });
    migrateComposeDrafts(draftKey, draftAliasKeys);

    assertEqual(ids(readComposeDrafts("hive:alice")), ["hive-draft", "lite-draft"]);
    assertEqual(ids(readComposeDrafts("ub:u1")), [], "source is removed after merge");
  });

  it("keeps the newer copy when the same draft exists in both buckets", () => {
    installStorage();
    writeComposeDrafts([{ ...draft("d1", "2026-02-01T00:00:00.000Z"), title: "newer" }], "ub:u1");
    writeComposeDrafts([{ ...draft("d1", "2026-01-01T00:00:00.000Z"), title: "older" }], "hive:alice");

    migrateComposeDrafts("hive:alice", ["ub:u1"]);

    assertEqual(readComposeDrafts("hive:alice").map((d) => d.title), ["newer"]);
  });

  it("legacy global drafts are claimed by a logged-in user, not by guests", () => {
    const store = installStorage();
    store.set(COMPOSE_DRAFTS_STORAGE_KEY, JSON.stringify([draft("legacy")]));

    migrateComposeDrafts(null);
    assertEqual(store.has(COMPOSE_DRAFTS_STORAGE_KEY), true, "guest leaves legacy alone");

    migrateComposeDrafts("hive:alice");
    assertEqual(ids(readComposeDrafts("hive:alice")), ["legacy"]);
    assertEqual(store.has(COMPOSE_DRAFTS_STORAGE_KEY), false);
  });
});

(async () => {
  for (const test of tests) await test();
  if (hasFailures) {
    console.log("\n❌ Some tests failed");
    process.exit(1);
  }
  console.log("\n✅ All tests passed");
})();
