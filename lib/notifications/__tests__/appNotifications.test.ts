/**
 * Unit tests for the app-owned notification helpers.
 * Run with: npx tsx lib/notifications/__tests__/appNotifications.test.ts
 *
 * Two properties matter here:
 *   1. The author is actually told what happened — with the curator's reason
 *      when there is one, and a neutral line when there isn't (never implying
 *      a reason was given).
 *   2. Notifying NEVER breaks the action that triggered it. A curator's
 *      approve must not 500 because the notify insert failed.
 */

import {
  createAppNotification,
  notifyCrossPostApproved,
  notifyCrossPostFailed,
  notifyCrossPostRejected,
} from "../appNotifications";
import { createFakeSupabase } from "../../crosspost/__tests__/fakeSupabase";

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
    throw new Error(message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, message?: string) {
  if (!condition) throw new Error(message || "Expected condition to be true");
}

function freshDb() {
  return createFakeSupabase({ tables: { userbase_notifications: [] } });
}

/** A client whose every insert blows up, to prove notifying can't take down
 *  the caller. */
function explodingSupabase() {
  return {
    from() {
      return {
        insert() {
          throw new Error("connection reset");
        },
      };
    },
  };
}

describe("approved", () => {
  it("tells the author their snap is live and links to it", async () => {
    const supabase = freshDb();
    await notifyCrossPostApproved({
      supabase,
      userId: "user-1",
      queueId: "queue-1",
      target: "instagram",
      hivePermlink: "kickflip",
      publishedUrl: "https://instagram.com/p/abc",
    });

    const rows = supabase.db.tables.userbase_notifications;
    assertEqual(rows.length, 1);
    assertEqual(rows[0].type, "crosspost_approved");
    assertTrue(rows[0].title.includes("Instagram"), "title should name the platform");
    assertEqual(rows[0].link, "https://instagram.com/p/abc");
    assertEqual(rows[0].metadata.queue_id, "queue-1");
    assertEqual(rows[0].read_at, undefined, "a new notification starts unread");
  });

  it("names Farcaster for a cast", async () => {
    const supabase = freshDb();
    await notifyCrossPostApproved({
      supabase,
      userId: "user-1",
      queueId: "queue-1",
      target: "farcaster",
      hivePermlink: "kickflip",
      publishedUrl: null,
    });
    assertTrue(supabase.db.tables.userbase_notifications[0].title.includes("Farcaster"));
  });

  it("writes nothing when there is no user to notify", async () => {
    const supabase = freshDb();
    await notifyCrossPostApproved({
      supabase,
      userId: null,
      queueId: "queue-1",
      target: "instagram",
      hivePermlink: "kickflip",
    });
    assertEqual(supabase.db.tables.userbase_notifications.length, 0);
  });
});

describe("rejected", () => {
  it("quotes the curator's reason when there is one", async () => {
    const supabase = freshDb();
    await notifyCrossPostRejected({
      supabase,
      userId: "user-1",
      queueId: "queue-1",
      target: "instagram",
      hivePermlink: "kickflip",
      note: "clip is too dark",
    });

    const row = supabase.db.tables.userbase_notifications[0];
    assertEqual(row.type, "crosspost_rejected");
    assertTrue(
      row.body.includes("clip is too dark"),
      "the author should see WHY it was passed on"
    );
    assertEqual(row.metadata.note, "clip is too dark");
  });

  it("uses neutral copy when no reason was given", async () => {
    const supabase = freshDb();
    await notifyCrossPostRejected({
      supabase,
      userId: "user-1",
      queueId: "queue-1",
      target: "instagram",
      hivePermlink: "kickflip",
      note: null,
    });

    const row = supabase.db.tables.userbase_notifications[0];
    assertTrue(
      !row.body.includes('"'),
      "must not fabricate a quoted reason when the curator gave none"
    );
    assertTrue(
      row.body.includes("still live on SkateHive"),
      "should reassure the snap itself is untouched"
    );
  });
});

describe("failed", () => {
  it("carries the platform error so the author can act on it", async () => {
    const supabase = freshDb();
    await notifyCrossPostFailed({
      supabase,
      userId: "user-1",
      queueId: "queue-1",
      target: "farcaster",
      hivePermlink: "kickflip",
      error: "The author's Farcaster signer is no longer approved",
    });

    const row = supabase.db.tables.userbase_notifications[0];
    assertEqual(row.type, "crosspost_failed");
    assertTrue(row.body.includes("signer"), "the actionable detail must survive");
  });
});

describe("never breaks the caller", () => {
  it("returns false instead of throwing when the insert errors", async () => {
    const supabase = {
      from() {
        return {
          insert: async () => ({ error: { message: "permission denied" } }),
        };
      },
    };
    const ok = await createAppNotification({
      supabase,
      userId: "user-1",
      type: "crosspost_approved",
      title: "hi",
    });
    assertEqual(ok, false);
  });

  it("swallows a thrown client error", async () => {
    const ok = await createAppNotification({
      supabase: explodingSupabase(),
      userId: "user-1",
      type: "crosspost_approved",
      title: "hi",
    });
    assertEqual(ok, false, "a dead connection must not propagate to the curator");
  });

  it("no-ops without a supabase client or a user", async () => {
    assertEqual(
      await createAppNotification({
        supabase: null,
        userId: "user-1",
        type: "crosspost_approved",
        title: "hi",
      }),
      false
    );
    assertEqual(
      await createAppNotification({
        supabase: freshDb(),
        userId: "",
        type: "crosspost_approved",
        title: "hi",
      }),
      false
    );
  });
});

// Run all tests
(async () => {
  for (const test of tests) {
    await test();
  }

  if (hasFailures) {
    console.log("\n❌ Some app notification tests failed!\n");
    process.exit(1);
  } else {
    console.log("\n✨ All app notification tests completed!\n");
  }
})();
