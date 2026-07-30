/**
 * Unit tests for claiming and publishing a queue item.
 * Run with: npx tsx lib/crosspost/__tests__/publishQueueItem.test.ts
 *
 * The important one here is the compare-and-swap in claimQueueItem: two
 * curators hitting Approve on the same item must NOT both reach Meta/Neynar.
 * The guard lives in the UPDATE's WHERE clause, so it's only real if the fake
 * enforces filters on update — which fakeSupabase.ts does.
 *
 * Deliberately NOT mocked: lib/instagram/graph and lib/farcaster/neynar are
 * imported for real. With no credentials in the test env they fail fast and
 * deterministically, which is exactly the path we want to assert — that a
 * publish failure lands the row in `failed` with the reason, never leaving it
 * stuck in `publishing`. `./noCredentials` is what guarantees "no credentials"
 * even on a machine that has them.
 *
 * Not covered — needs real credentials + Postgres:
 *   - a SUCCESSFUL Meta / Neynar publish and the userbase_instagram_posts
 *     upsert that follows it
 *   - true parallel claims (the fake is single-threaded, so the race is
 *     sequenced rather than raced)
 */

// MUST stay the first import: it clears the credential env vars before the
// modules under test are evaluated. Doing it with inline statements would run
// after the imports below, since import declarations are hoisted.
import "./noCredentials";

import {
  claimQueueItem,
  publishQueueItem,
  STALE_PUBLISHING_MS,
} from "../publishQueueItem";
import type { CrossPostQueueRow } from "../queue";
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

function dbWith(rows: Partial<CrossPostQueueRow>[]) {
  return createFakeSupabase({
    tables: {
      userbase_crosspost_queue: rows.map((r) => ({ ...r })),
      userbase_instagram_posts: [],
      userbase_identities: [],
    },
    uniques: QUEUE_UNIQUES,
  });
}

// The explicit return type keeps the string literals below narrowed to
// CrossPostTarget / CrossPostQueueStatus instead of widening to `string`.
function pendingItem(
  overrides: Partial<CrossPostQueueRow> = {}
): Partial<CrossPostQueueRow> {
  return {
    id: "queue-1",
    user_id: "user-1",
    requested_by_handle: "skater",
    target: "instagram",
    hive_author: "skater",
    hive_permlink: "kickflip",
    status: "pending_review",
    payload: {
      caption: "kickflip",
      collaborators: [],
      image_url: "https://ipfs.skatehive.app/ipfs/bafyimage",
      video_url: null,
      ig_media_type: "IMAGE",
      permalink_url: "https://skatehive.app/post/skater/kickflip",
    },
    attempts: 0,
    created_at: "2026-07-27T10:00:00Z",
    ...overrides,
  };
}

describe("claimQueueItem — the double-post guard", () => {
  it("moves a pending item into publishing and records the curator", async () => {
    const supabase = dbWith([pendingItem()]);
    const claim = await claimQueueItem({
      supabase,
      id: "queue-1",
      curatorHandle: "curator",
      curatorUserId: "user-99",
    });

    assertTrue(claim.ok, "first claim should win");
    const row = supabase.db.tables.userbase_crosspost_queue[0];
    assertEqual(row.status, "publishing");
    assertEqual(row.reviewed_by_handle, "curator");
    assertEqual(row.reviewed_by_user_id, "user-99");
    assertTrue(!!row.reviewed_at, "reviewed_at should be stamped");
  });

  it("rejects a second curator once the item is publishing", async () => {
    const supabase = dbWith([pendingItem()]);
    const first = await claimQueueItem({
      supabase,
      id: "queue-1",
      curatorHandle: "curator-a",
      curatorUserId: null,
    });
    const second = await claimQueueItem({
      supabase,
      id: "queue-1",
      curatorHandle: "curator-b",
      curatorUserId: null,
    });

    assertTrue(first.ok, "first claim wins");
    assertEqual(second.ok, false, "second claim must lose");
    assertEqual((second as any).status, 409);
    assertEqual(
      supabase.db.tables.userbase_crosspost_queue[0].reviewed_by_handle,
      "curator-a",
      "the loser must not overwrite the winner's audit trail"
    );
  });

  it("refuses to re-publish an already published item", async () => {
    const supabase = dbWith([pendingItem({ status: "published" })]);
    const claim = await claimQueueItem({
      supabase,
      id: "queue-1",
      curatorHandle: "curator",
      curatorUserId: null,
    });
    assertEqual(claim.ok, false);
    assertEqual((claim as any).status, 409);
  });

  it("404s on an id that does not exist", async () => {
    const supabase = dbWith([]);
    const claim = await claimQueueItem({
      supabase,
      id: "nope",
      curatorHandle: "curator",
      curatorUserId: null,
    });
    assertEqual(claim.ok, false);
    assertEqual((claim as any).status, 404);
  });

  it("allows retrying a failed item", async () => {
    const supabase = dbWith([pendingItem({ status: "failed", publish_error: "meta 500" })]);
    const claim = await claimQueueItem({
      supabase,
      id: "queue-1",
      curatorHandle: "curator",
      curatorUserId: null,
    });
    assertTrue(claim.ok, "a failed item must be retryable");
  });

  it("refuses a FRESH publishing row", async () => {
    const supabase = dbWith([
      pendingItem({ status: "publishing", updated_at: new Date().toISOString() }),
    ]);
    const claim = await claimQueueItem({
      supabase,
      id: "queue-1",
      curatorHandle: "curator",
      curatorUserId: null,
    });
    assertEqual(claim.ok, false, "an in-flight publish must not be interrupted");
    assertEqual((claim as any).status, 409);
  });

  it("reclaims a STALE publishing row so a dead attempt can't wedge it forever", async () => {
    // A serverless timeout mid-publish leaves the row in `publishing`. Without
    // the staleness escape it would be unapprovable until someone ran SQL.
    const supabase = dbWith([
      pendingItem({
        status: "publishing",
        updated_at: new Date(Date.now() - STALE_PUBLISHING_MS - 1000).toISOString(),
      }),
    ]);
    const claim = await claimQueueItem({
      supabase,
      id: "queue-1",
      curatorHandle: "curator",
      curatorUserId: null,
    });
    assertTrue(claim.ok, "a stale publish attempt must be retryable");
  });

  it("does not reclaim a publishing row that is stale by less than the window", async () => {
    const supabase = dbWith([
      pendingItem({
        status: "publishing",
        updated_at: new Date(Date.now() - STALE_PUBLISHING_MS + 60_000).toISOString(),
      }),
    ]);
    const claim = await claimQueueItem({
      supabase,
      id: "queue-1",
      curatorHandle: "curator",
      curatorUserId: null,
    });
    assertEqual(claim.ok, false, "still inside the window — a Reel may legitimately take this long");
  });

  it("409s when re-approving a rejected item whose slot was retaken", async () => {
    // Author was rejected, then asked again — the newer row holds the slot, so
    // reviving the old one would violate the partial unique index.
    const supabase = dbWith([
      pendingItem({ id: "queue-old", status: "rejected" }),
      pendingItem({ id: "queue-new", status: "pending_review" }),
    ]);
    const claim = await claimQueueItem({
      supabase,
      id: "queue-old",
      curatorHandle: "curator",
      curatorUserId: null,
    });

    assertEqual(claim.ok, false, "should not resurrect the stale request");
    assertEqual((claim as any).status, 409);
  });
});

describe("claimQueueItem — curator edits", () => {
  it("merges a payload patch over the stored payload", async () => {
    const supabase = dbWith([pendingItem()]);
    await claimQueueItem({
      supabase,
      id: "queue-1",
      curatorHandle: "curator",
      curatorUserId: null,
      payloadPatch: { caption: "edited by curation", collaborators: ["someone"] },
    });

    const row = supabase.db.tables.userbase_crosspost_queue[0];
    assertEqual(row.payload.caption, "edited by curation");
    assertEqual(row.payload.collaborators[0], "someone");
    assertEqual(
      row.payload.ig_media_type,
      "IMAGE",
      "untouched payload fields must survive the merge"
    );
  });

  it("leaves the payload alone when no patch is given", async () => {
    const supabase = dbWith([pendingItem()]);
    await claimQueueItem({
      supabase,
      id: "queue-1",
      curatorHandle: "curator",
      curatorUserId: null,
    });
    assertEqual(supabase.db.tables.userbase_crosspost_queue[0].payload.caption, "kickflip");
  });
});

describe("publishQueueItem — failures never leave a row stuck", () => {
  it("marks Instagram failed (not publishing) when IG is not configured", async () => {
    const supabase = dbWith([pendingItem({ status: "publishing" })]);
    const item = supabase.db.tables.userbase_crosspost_queue[0] as any;

    const outcome = await publishQueueItem(supabase, item);

    assertEqual(outcome.success, false);
    assertEqual(item.status, "failed");
    assertTrue(!!item.publish_error, "the reason must be recorded");
    assertEqual(item.attempts, 1, "attempts should increment");
  });

  it("refuses a Farcaster cast when the author's signer is no longer approved", async () => {
    const supabase = dbWith([
      pendingItem({
        status: "publishing",
        target: "farcaster",
        payload: { text: "sick line", embeds: [], channel_id: null } as any,
      }),
    ]);
    supabase.db.tables.userbase_identities.push({
      user_id: "user-1",
      type: "farcaster",
      metadata: { signer_uuid: "abc", signer_status: "revoked" },
    });
    const item = supabase.db.tables.userbase_crosspost_queue[0] as any;

    const outcome = await publishQueueItem(supabase, item);

    assertEqual(outcome.success, false);
    assertTrue(
      /signer/i.test(outcome.error || ""),
      "the error should name the signer so the author knows what to fix"
    );
    assertEqual(item.status, "failed");
  });

  it("refuses a Farcaster cast when the user has no Farcaster identity at all", async () => {
    const supabase = dbWith([
      pendingItem({
        status: "publishing",
        target: "farcaster",
        payload: { text: "sick line", embeds: [], channel_id: null } as any,
      }),
    ]);
    const item = supabase.db.tables.userbase_crosspost_queue[0] as any;

    const outcome = await publishQueueItem(supabase, item);
    assertEqual(outcome.success, false);
    assertEqual(item.status, "failed");
  });

  it("refuses an Instagram item that lost its media", async () => {
    const supabase = dbWith([
      pendingItem({
        status: "publishing",
        payload: {
          caption: "no media",
          collaborators: [],
          image_url: null,
          video_url: null,
          ig_media_type: "IMAGE",
          permalink_url: "https://skatehive.app/post/skater/kickflip",
        } as any,
      }),
    ]);
    const item = supabase.db.tables.userbase_crosspost_queue[0] as any;

    const outcome = await publishQueueItem(supabase, item);
    assertEqual(outcome.success, false);
    assertEqual(item.status, "failed");
  });

  it("does not clobber a newer claim when a stale attempt finally returns", async () => {
    // The 10-minute escape means two executors can hold the same row. When the
    // first one wakes up, its write-back must be a no-op — otherwise it stamps
    // a stale outcome over the live claim, or flips a row someone is actively
    // publishing straight to `failed`.
    const supabase = dbWith([pendingItem({ status: "publishing" })]);
    const row = supabase.db.tables.userbase_crosspost_queue[0] as any;

    // What the first attempt is holding: the claim as it was when it started.
    const staleItem = { ...row, updated_at: "2026-07-27T10:00:00.000Z" };
    // Meanwhile a second executor claimed and moved the row on.
    row.updated_at = "2026-07-27T10:30:00.000Z";
    row.reviewed_by_handle = "curator-b";

    await publishQueueItem(supabase, staleItem);

    assertEqual(
      row.status,
      "publishing",
      "the live claim must survive the late writer"
    );
    assertEqual(row.reviewed_by_handle, "curator-b");
    assertEqual(row.attempts, 0, "the stale attempt must not bump the counter either");
  });

  it("still writes back when it is the one holding the claim", async () => {
    const supabase = dbWith([pendingItem({ status: "publishing" })]);
    const row = supabase.db.tables.userbase_crosspost_queue[0] as any;

    await publishQueueItem(supabase, row);

    assertEqual(row.status, "failed", "IG is unconfigured in tests, so it fails");
    assertEqual(row.attempts, 1);
  });

  it("refuses a Farcaster item with no user to cast on behalf of", async () => {
    const supabase = dbWith([
      pendingItem({
        status: "publishing",
        target: "farcaster",
        user_id: null,
        payload: { text: "orphan", embeds: [], channel_id: null } as any,
      }),
    ]);
    const item = supabase.db.tables.userbase_crosspost_queue[0] as any;

    const outcome = await publishQueueItem(supabase, item);
    assertEqual(outcome.success, false);
    assertEqual(item.status, "failed");
  });
});

// Run all tests
(async () => {
  for (const test of tests) {
    await test();
  }

  if (hasFailures) {
    console.log("\n❌ Some publishQueueItem tests failed!\n");
    process.exit(1);
  } else {
    console.log("\n✨ All publishQueueItem tests completed!\n");
  }
})();
