/**
 * Unit tests for the app-owned notification helpers.
 * Run with: npx tsx lib/notifications/__tests__/appNotifications.test.ts
 *
 * Two properties matter here:
 *   1. The queued row carries what the client-side renderer needs (`type` and
 *      `metadata`), since the stored title/body are only an English fallback.
 *   2. Notifying NEVER breaks the action that triggered it — a cross-post
 *      request must not 500 because the notify insert failed.
 *
 * The other outcomes (rejected / scheduled / published / failed) are written by
 * the portal, so there is nothing to test here for them; their rendering is
 * covered in localizeNotification.test.ts.
 */

import {
  createAppNotification,
  notifyCrossPostQueued,
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

describe("queued — the one notification this app writes", () => {
  it("records the request with everything the renderer needs", async () => {
    const supabase = freshDb();
    await notifyCrossPostQueued({
      supabase,
      userId: "user-1",
      queueId: "queue-1",
      target: "instagram",
      hivePermlink: "kickflip",
      permalinkUrl: "https://skatehive.app/post/skater/kickflip",
    });

    const rows = supabase.db.tables.userbase_notifications;
    assertEqual(rows.length, 1);
    assertEqual(rows[0].type, "crosspost_queued");
    assertEqual(rows[0].metadata.queue_id, "queue-1");
    assertEqual(
      rows[0].metadata.target,
      "instagram",
      "the renderer picks its copy off metadata.target"
    );
    assertEqual(rows[0].link, "https://skatehive.app/post/skater/kickflip");
    assertEqual(rows[0].read_at, undefined, "a new notification starts unread");
  });

  it("names the platform in the fallback copy", async () => {
    const supabase = freshDb();
    await notifyCrossPostQueued({
      supabase,
      userId: "user-1",
      queueId: "queue-1",
      target: "farcaster",
      hivePermlink: "kickflip",
    });
    assertTrue(
      supabase.db.tables.userbase_notifications[0].body.includes("Farcaster"),
      "the stored English fallback should still be readable on its own"
    );
  });

  it("writes nothing when there is no user to notify", async () => {
    const supabase = freshDb();
    await notifyCrossPostQueued({
      supabase,
      userId: null,
      queueId: "queue-1",
      target: "instagram",
      hivePermlink: "kickflip",
    });
    assertEqual(supabase.db.tables.userbase_notifications.length, 0);
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
