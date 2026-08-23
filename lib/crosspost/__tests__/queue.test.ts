/**
 * Unit tests for the cross-post curation queue's enqueue path.
 * Run with: npx tsx lib/crosspost/__tests__/queue.test.ts
 *
 * These exercise the guarantees the partial unique index from migration 0029
 * is supposed to give us, against a fake Postgres that actually enforces it
 * (see fakeSupabase.ts):
 *
 *   - one ACTIVE request per (target, snap)
 *   - a rejected/failed item FREES the slot, so the author can retry
 *   - Instagram and Farcaster are independent slots for the same snap
 *   - NULL author/permlink (Farcaster-only replies) never collide
 *
 * Not covered here — needs a real Postgres: RLS, jsonb round-tripping, and
 * the true concurrency of two simultaneous inserts (the fake is single
 * threaded, so the 23505 race is simulated rather than raced).
 */

import {
  countQueueItemsForUser,
  enqueueCrossPost,
  findActiveQueueItem,
  isCrossPostQueueEnabled,
  type InstagramQueuePayload,
} from "../queue";
import { createFakeSupabase, QUEUE_UNIQUES } from "./fakeSupabase";

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
  return createFakeSupabase({
    tables: { userbase_crosspost_queue: [] },
    uniques: QUEUE_UNIQUES,
  });
}

const IG_PAYLOAD: InstagramQueuePayload = {
  caption: "kickflip down the 5-stair",
  collaborators: ["skater.ig"],
  image_url: null,
  video_url: "https://ipfs.skatehive.app/ipfs/bafyvideo",
  ig_media_type: "REELS",
  permalink_url: "https://skatehive.app/post/skater/kickflip",
};

function igRequest(supabase: any, overrides: Record<string, any> = {}) {
  return enqueueCrossPost({
    supabase,
    target: "instagram",
    userId: "user-1",
    requestedByHandle: "skater",
    hiveAuthor: "skater",
    hivePermlink: "kickflip",
    payload: IG_PAYLOAD,
    ...overrides,
  });
}

describe("enqueue basics", () => {
  it("files a request as pending_review with the payload intact", async () => {
    const supabase = freshDb();
    const result = await igRequest(supabase);

    assertTrue(result.ok, "enqueue should succeed");
    const rows = supabase.db.tables.userbase_crosspost_queue;
    assertEqual(rows.length, 1);
    assertEqual(rows[0].status, "pending_review");
    assertEqual(rows[0].target, "instagram");
    assertEqual(rows[0].requested_by_handle, "skater");
    assertEqual(rows[0].payload.caption, IG_PAYLOAD.caption);
  });

  it("fails cleanly when there is no supabase client", async () => {
    const result = await enqueueCrossPost({
      supabase: null,
      target: "instagram",
      userId: "user-1",
      requestedByHandle: "skater",
      hiveAuthor: "skater",
      hivePermlink: "kickflip",
      payload: IG_PAYLOAD,
    });
    assertEqual(result.ok, false);
    assertEqual((result as any).status, 500);
  });
});

describe("one active request per snap", () => {
  it("returns the existing item instead of queueing a duplicate", async () => {
    const supabase = freshDb();
    const first = await igRequest(supabase);
    const second = await igRequest(supabase);

    assertTrue(second.ok, "duplicate request should not be an error");
    assertTrue(!!(second as any).duplicate, "second request should report a duplicate");
    assertEqual((second as any).id, (first as any).id, "should point at the same item");
    assertEqual(
      supabase.db.tables.userbase_crosspost_queue.length,
      1,
      "no second row should be created"
    );
  });

  it("treats an already-published item as a duplicate too", async () => {
    const supabase = freshDb();
    await igRequest(supabase);
    supabase.db.tables.userbase_crosspost_queue[0].status = "published";

    const again = await igRequest(supabase);
    assertTrue(!!(again as any).duplicate, "published item still holds the slot");
    assertEqual(supabase.db.tables.userbase_crosspost_queue.length, 1);
  });

  it("lets Instagram and Farcaster hold the same snap independently", async () => {
    const supabase = freshDb();
    await igRequest(supabase);
    const fc = await enqueueCrossPost({
      supabase,
      target: "farcaster",
      userId: "user-1",
      requestedByHandle: "skater",
      hiveAuthor: "skater",
      hivePermlink: "kickflip",
      payload: { text: "kickflip", embeds: [], channel_id: "skateboard" },
    });

    assertTrue(fc.ok && !(fc as any).duplicate, "different target is a different slot");
    assertEqual(supabase.db.tables.userbase_crosspost_queue.length, 2);
  });
});

describe("rejection frees the slot", () => {
  it("allows a new request after the first was rejected", async () => {
    const supabase = freshDb();
    await igRequest(supabase);
    supabase.db.tables.userbase_crosspost_queue[0].status = "rejected";

    const retry = await igRequest(supabase);
    assertTrue(retry.ok, "retry should succeed");
    assertTrue(
      !(retry as any).duplicate,
      "a rejected item must not block a fresh request"
    );
    assertEqual(supabase.db.tables.userbase_crosspost_queue.length, 2);
  });

  it("allows a new request after a failed publish", async () => {
    const supabase = freshDb();
    await igRequest(supabase);
    supabase.db.tables.userbase_crosspost_queue[0].status = "failed";

    const retry = await igRequest(supabase);
    assertTrue(!(retry as any).duplicate, "failed items must not hold the slot");
    assertEqual(supabase.db.tables.userbase_crosspost_queue.length, 2);
  });
});

describe("Farcaster-only replies (no Hive counterpart)", () => {
  it("queues rows with NULL author/permlink without colliding", async () => {
    const supabase = freshDb();
    const payload = { text: "sick line", embeds: [], channel_id: null };

    const a = await enqueueCrossPost({
      supabase,
      target: "farcaster",
      userId: "user-1",
      requestedByHandle: "skater",
      hiveAuthor: null,
      hivePermlink: null,
      payload,
    });
    const b = await enqueueCrossPost({
      supabase,
      target: "farcaster",
      userId: "user-1",
      requestedByHandle: "skater",
      hiveAuthor: null,
      hivePermlink: null,
      payload,
    });

    assertTrue(a.ok && b.ok, "both should be accepted");
    assertTrue(
      !(b as any).duplicate,
      "NULLs are distinct in Postgres — these can't be deduped by the index"
    );
    assertEqual(
      supabase.db.tables.userbase_crosspost_queue.length,
      2,
      "documents the known gap: identical FC-only replies are NOT deduped"
    );
  });

  it("a NULL author can't squat on a real author's slot", async () => {
    // The route drops an unverified hive_author to NULL (see
    // app/api/farcaster/cast/route.ts). This is what that buys: the dropped row
    // reserves nothing, so the real author's request still goes through.
    // Before the binding, one request from any signed-in user could hold
    // (farcaster, victim, permlink) in `published` forever and lock the author
    // out of cross-posting that snap for good.
    const supabase = freshDb();
    const payload = { text: "not mine", embeds: [], channel_id: null };

    // Attacker's request, author dropped to NULL by the route.
    await enqueueCrossPost({
      supabase,
      target: "farcaster",
      userId: "attacker",
      requestedByHandle: "attacker",
      hiveAuthor: null,
      hivePermlink: null,
      payload,
    });

    // The real author, later.
    const victim = await enqueueCrossPost({
      supabase,
      target: "farcaster",
      userId: "victim",
      requestedByHandle: "victim",
      hiveAuthor: "victim",
      hivePermlink: "victims-snap",
      payload,
    });

    assertTrue(victim.ok, "the author's own request must succeed");
    assertTrue(
      !(victim as any).duplicate,
      "nobody else's row may hold the author's slot"
    );
  });

  it("an occupied slot really does lock the author out (why the binding matters)", async () => {
    // The other half of the proof: if an unverified author DID reach the row,
    // a `published` Farcaster item — and Farcaster publishes immediately —
    // holds the slot permanently, because `published` is an ACTIVE status.
    const supabase = freshDb();
    supabase.db.tables.userbase_crosspost_queue.push({
      id: "squatted",
      user_id: "attacker",
      target: "farcaster",
      hive_author: "victim",
      hive_permlink: "victims-snap",
      status: "published",
      payload: {},
      created_at: "2026-07-30T10:00:00Z",
    });

    const victim = await enqueueCrossPost({
      supabase,
      target: "farcaster",
      userId: "victim",
      requestedByHandle: "victim",
      hiveAuthor: "victim",
      hivePermlink: "victims-snap",
      payload: { text: "mine", embeds: [], channel_id: null },
    });

    assertTrue(
      !!(victim as any).duplicate,
      "documents the impact: the author is turned away by someone else's row"
    );
  });
});

describe("findActiveQueueItem", () => {
  it("ignores rejected and failed items", async () => {
    const supabase = freshDb();
    await igRequest(supabase);
    supabase.db.tables.userbase_crosspost_queue[0].status = "rejected";

    const found = await findActiveQueueItem({
      supabase,
      target: "instagram",
      hiveAuthor: "skater",
      hivePermlink: "kickflip",
    });
    assertEqual(found, null);
  });

  it("finds an item that is still in review", async () => {
    const supabase = freshDb();
    await igRequest(supabase);

    const found = await findActiveQueueItem({
      supabase,
      target: "instagram",
      hiveAuthor: "skater",
      hivePermlink: "kickflip",
    });
    assertTrue(found !== null && found.status === "pending_review");
  });
});

describe("countQueueItemsForUser (flood guard)", () => {
  it("counts only the requested statuses, for the requested user", async () => {
    const supabase = freshDb();
    const rows = supabase.db.tables.userbase_crosspost_queue;
    rows.push(
      { id: "a", user_id: "user-1", status: "pending_review", created_at: "2026-07-01" },
      { id: "b", user_id: "user-1", status: "pending_review", created_at: "2026-07-02" },
      { id: "c", user_id: "user-1", status: "published", created_at: "2026-07-03" },
      { id: "d", user_id: "user-2", status: "pending_review", created_at: "2026-07-04" }
    );

    const count = await countQueueItemsForUser({
      supabase,
      userId: "user-1",
      statuses: ["pending_review"],
    });
    assertEqual(count, 2, "published rows and other users must not count");
  });

  it("scopes to one platform so an Instagram backlog can't 429 a cast", async () => {
    // Unscoped, a user with Instagram items in review would be told to wait
    // before casting to Farcaster — for a review that has nothing to do with
    // casting, and that nothing they do on Farcaster would clear.
    const supabase = freshDb();
    supabase.db.tables.userbase_crosspost_queue.push(
      { id: "a", user_id: "u", target: "instagram", status: "pending_review", created_at: "1" },
      { id: "b", user_id: "u", target: "instagram", status: "pending_review", created_at: "2" },
      { id: "c", user_id: "u", target: "farcaster", status: "pending_review", created_at: "3" }
    );

    assertEqual(
      await countQueueItemsForUser({
        supabase,
        userId: "u",
        statuses: ["pending_review"],
        target: "farcaster",
      }),
      1
    );
    assertEqual(
      await countQueueItemsForUser({
        supabase,
        userId: "u",
        statuses: ["pending_review"],
        target: "instagram",
      }),
      2
    );
  });

  it("throws on a query error instead of reporting zero", async () => {
    // Reporting 0 would silently lift the cap every time the database hiccups —
    // a rate limit that fails open. Callers turn this into a 503.
    const brokenSupabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async () => ({ count: null, error: { message: "connection reset" } }),
          }),
        }),
      }),
    };

    let threw = false;
    try {
      await countQueueItemsForUser({
        supabase: brokenSupabase,
        userId: "user-1",
        statuses: ["pending_review"],
      });
    } catch {
      threw = true;
    }
    assertTrue(threw, "a failed count must not be treated as 'no pending items'");
  });
});

describe("isCrossPostQueueEnabled (kill switch)", () => {
  const original = process.env.CROSSPOST_QUEUE_ENABLED;
  const withEnv = (value: string | undefined, fn: () => void) => {
    if (value === undefined) delete process.env.CROSSPOST_QUEUE_ENABLED;
    else process.env.CROSSPOST_QUEUE_ENABLED = value;
    try {
      fn();
    } finally {
      if (original === undefined) delete process.env.CROSSPOST_QUEUE_ENABLED;
      else process.env.CROSSPOST_QUEUE_ENABLED = original;
    }
  };

  it("defaults to OFF when unset — shipping must not silently change behavior", () => {
    withEnv(undefined, () => assertEqual(isCrossPostQueueEnabled("skater"), false));
  });

  it("is off for the literal string false", () => {
    withEnv("false", () => assertEqual(isCrossPostQueueEnabled("skater"), false));
  });

  it("is on for everyone when true", () => {
    withEnv("true", () => {
      assertEqual(isCrossPostQueueEnabled("skater"), true);
      assertEqual(isCrossPostQueueEnabled("anyone-else"), true);
    });
  });

  it("never queues Farcaster, even switched fully on", () => {
    // The portal reviews Instagram only. A queued Farcaster row would have no
    // owner and sit in pending_review forever, with its author never told.
    withEnv("true", () => {
      assertEqual(isCrossPostQueueEnabled("skater", "farcaster"), false);
      assertEqual(isCrossPostQueueEnabled("skater", "instagram"), true);
    });
  });

  it("never queues Farcaster for a canary handle either", () => {
    withEnv("skater", () => {
      assertEqual(isCrossPostQueueEnabled("skater", "farcaster"), false);
      assertEqual(isCrossPostQueueEnabled("skater", "instagram"), true);
    });
  });

  it("queues only the listed handles when given a canary list", () => {
    withEnv("mtlouzada, xvlad", () => {
      assertEqual(isCrossPostQueueEnabled("mtlouzada"), true);
      assertEqual(isCrossPostQueueEnabled("xvlad"), true);
      assertEqual(isCrossPostQueueEnabled("someone"), false);
    });
  });

  it("ignores @ and case in the list and the handle", () => {
    withEnv("@MtLouzada", () => {
      assertEqual(isCrossPostQueueEnabled("mtlouzada"), true);
      assertEqual(isCrossPostQueueEnabled("@MTLOUZADA"), true);
    });
  });

  it("stays off for a user with no linked Hive handle when using a list", () => {
    withEnv("mtlouzada", () => assertEqual(isCrossPostQueueEnabled(null), false));
  });

  it("is on for a handle-less user only when explicitly set to true", () => {
    withEnv("true", () => assertEqual(isCrossPostQueueEnabled(null), true));
  });
});

// Run all tests
(async () => {
  for (const test of tests) {
    await test();
  }

  if (hasFailures) {
    console.log("\n❌ Some crosspost queue tests failed!\n");
    process.exit(1);
  } else {
    console.log("\n✨ All crosspost queue tests completed!\n");
  }
})();
