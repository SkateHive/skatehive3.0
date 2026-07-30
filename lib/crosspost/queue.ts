/**
 * Cross-post review queue.
 *
 * Every user-initiated cross-post (Instagram or Farcaster) is ENQUEUED here
 * instead of being published immediately. The curation team reviews the queue
 * in the SkateHive portal and decides if / when each item ships.
 *
 * Shape of the flow:
 *
 *   SnapComposer ──▶ /api/instagram/post   ──┐
 *                    /api/farcaster/cast   ──┴─▶ enqueueCrossPost()  → pending_review
 *
 *   Portal ──▶ GET  /api/crosspost/queue                 (list)
 *          ──▶ POST /api/crosspost/queue/{id}/approve    → publishQueueItem() → published
 *          ──▶ POST /api/crosspost/queue/{id}/reject     → rejected
 *
 * The payload stored on the row is the FULLY NORMALIZED publish input (caption
 * already built, embeds already picked, media URLs already validated), so the
 * approve path is a dumb executor — it never re-derives content. What it does
 * NOT store is anything secret: the Farcaster signer uuid is re-resolved from
 * `userbase_identities` at publish time so a signer the user revoked in the
 * meantime correctly fails instead of posting.
 */
export const CROSSPOST_QUEUE_TABLE = "userbase_crosspost_queue";

/**
 * Targets the curation queue actually covers.
 *
 * Instagram only. The portal's review screen filters `target = 'instagram'`,
 * so a queued Farcaster row would have no owner and sit in `pending_review`
 * forever, with its author never hearing back. Farcaster also casts under the
 * user's OWN account rather than the shared brand account, which is the weaker
 * case for curation to begin with — so it publishes immediately, as before.
 *
 * Add a target here only once somebody actually reviews it.
 */
export const CURATED_TARGETS: CrossPostTarget[] = ["instagram"];

/**
 * Kill switch for the whole curation queue.
 *
 * The day this ships, every curated cross-post stops publishing and starts
 * waiting for a curator. If the portal isn't up yet — or something goes wrong
 * once it is — the feature has to be switchable without a revert, because a
 * revert would strand whatever is already sitting in the queue.
 *
 *   CROSSPOST_QUEUE_ENABLED unset / "false"  → publish immediately (old behavior)
 *   CROSSPOST_QUEUE_ENABLED="true"           → everyone goes through review
 *   CROSSPOST_QUEUE_ENABLED="alice,bob"      → only those Hive handles are
 *                                              queued; everyone else publishes
 *                                              as before (canary)
 *
 * The handle compared is the requester's linked Hive account. `target` is
 * checked first: an uncurated platform never queues, whatever the switch says.
 */
export function isCrossPostQueueEnabled(
  hiveHandle: string | null,
  target: CrossPostTarget = "instagram"
): boolean {
  if (!CURATED_TARGETS.includes(target)) return false;

  const raw = (process.env.CROSSPOST_QUEUE_ENABLED || "").trim();
  if (!raw || raw.toLowerCase() === "false") return false;
  if (raw.toLowerCase() === "true") return true;

  const allowed = raw
    .split(",")
    .map((h) => h.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean);
  if (allowed.length === 0) return false;
  if (!hiveHandle) return false;
  return allowed.includes(hiveHandle.trim().replace(/^@/, "").toLowerCase());
}

export type CrossPostTarget = "instagram" | "farcaster";

export type CrossPostQueueStatus =
  | "pending_review"
  | "approved"
  | "publishing"
  | "published"
  | "rejected"
  | "failed";

/** Statuses that hold the (target, author, permlink) slot — see the partial
 *  unique index in migration 0029. A rejected/failed item frees the slot. */
export const ACTIVE_QUEUE_STATUSES: CrossPostQueueStatus[] = [
  "pending_review",
  "approved",
  "publishing",
  "published",
];

/** Publish input for an Instagram queue item. Mirrors what graph.ts needs. */
export interface InstagramQueuePayload {
  caption: string;
  collaborators: string[];
  image_url: string | null;
  video_url: string | null;
  /** Ordered carousel items — 2+ means CAROUSEL. */
  media_items?: { type: "image" | "video"; url: string }[];
  ig_media_type: "IMAGE" | "REELS" | "CAROUSEL";
  /** Context for the portal UI (not used by the publisher). */
  permalink_url: string;
  title?: string;
  tags?: string[];
  /** Set when a moderator force-queued someone else's snap. */
  forced_by?: string;
}

/** Publish input for a Farcaster queue item. */
export interface FarcasterQueuePayload {
  text: string;
  embeds: { url: string }[];
  channel_id: string | null;
  /** Context for the portal UI. */
  permalink_url?: string;
}

export type CrossPostQueuePayload = InstagramQueuePayload | FarcasterQueuePayload;

export interface CrossPostQueueRow {
  id: string;
  user_id: string | null;
  requested_by_handle: string | null;
  target: CrossPostTarget;
  hive_author: string | null;
  hive_permlink: string | null;
  status: CrossPostQueueStatus;
  payload: CrossPostQueuePayload;
  reviewed_by_handle: string | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  attempts: number;
  published_at: string | null;
  publish_error: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueCrossPostInput {
  supabase: any;
  target: CrossPostTarget;
  userId: string | null;
  requestedByHandle: string | null;
  hiveAuthor: string | null;
  hivePermlink: string | null;
  payload: CrossPostQueuePayload;
}

export type EnqueueResult =
  | { ok: true; id: string; duplicate?: undefined }
  | { ok: true; id: string; duplicate: CrossPostQueueRow }
  | { ok: false; status: number; error: string };

/**
 * Insert a pending_review item.
 *
 * If an ACTIVE item already exists for the same (target, author, permlink) we
 * return it as `duplicate` instead of erroring — the caller turns that into a
 * friendly "already waiting for review / already published" response. A
 * previously rejected or failed item does not block a new request.
 */
export async function enqueueCrossPost(
  input: EnqueueCrossPostInput
): Promise<EnqueueResult> {
  const { supabase } = input;
  if (!supabase) {
    return { ok: false, status: 500, error: "Server is missing Supabase config." };
  }

  // Pre-check so the common case returns a useful message instead of a raw
  // unique-violation. The index is still the authority (race → 23505 below).
  if (input.hiveAuthor && input.hivePermlink) {
    const existing = await findActiveQueueItem({
      supabase,
      target: input.target,
      hiveAuthor: input.hiveAuthor,
      hivePermlink: input.hivePermlink,
    });
    if (existing) return { ok: true, id: existing.id, duplicate: existing };
  }

  const { data, error } = await supabase
    .from(CROSSPOST_QUEUE_TABLE)
    .insert({
      user_id: input.userId,
      requested_by_handle: input.requestedByHandle,
      target: input.target,
      hive_author: input.hiveAuthor,
      hive_permlink: input.hivePermlink,
      status: "pending_review",
      payload: input.payload,
    })
    .select("id")
    .single();

  if (error || !data) {
    // 23505 = another request enqueued the same snap between our check and
    // this insert. Re-read and treat it as a duplicate, not a failure.
    if ((error as any)?.code === "23505" && input.hiveAuthor && input.hivePermlink) {
      const existing = await findActiveQueueItem({
        supabase,
        target: input.target,
        hiveAuthor: input.hiveAuthor,
        hivePermlink: input.hivePermlink,
      });
      if (existing) return { ok: true, id: existing.id, duplicate: existing };
    }
    return {
      ok: false,
      status: 500,
      error: error?.message || "Failed to queue cross-post for review.",
    };
  }

  return { ok: true, id: data.id as string };
}

/**
 * Deliberately returns null on a query error instead of throwing.
 *
 * This is a convenience lookup, not the guard: the partial unique index is
 * what actually prevents a duplicate. If this read fails transiently, falling
 * through to the insert is the correct outcome — the index either accepts the
 * row or raises 23505, which enqueueCrossPost already handles. Throwing here
 * would turn a recoverable read blip into a 500 for the user.
 */
export async function findActiveQueueItem(args: {
  supabase: any;
  target: CrossPostTarget;
  hiveAuthor: string;
  hivePermlink: string;
}): Promise<CrossPostQueueRow | null> {
  const { data } = await args.supabase
    .from(CROSSPOST_QUEUE_TABLE)
    .select("*")
    .eq("target", args.target)
    .eq("hive_author", args.hiveAuthor)
    .eq("hive_permlink", args.hivePermlink)
    .in("status", ACTIVE_QUEUE_STATUSES)
    .limit(1);
  return (data?.[0] as CrossPostQueueRow | undefined) ?? null;
}

/**
 * Count a user's items in the given statuses since `sinceIso`.
 *
 * Throws on a query error rather than reporting zero. This backs the
 * per-user pending cap, and a rate limit that silently reports "no pending
 * items" whenever the database hiccups is a rate limit that fails OPEN —
 * exactly backwards. Callers turn the throw into a 503.
 */
export async function countQueueItemsForUser(args: {
  supabase: any;
  userId: string;
  statuses: CrossPostQueueStatus[];
  sinceIso?: string;
}): Promise<number> {
  let query = args.supabase
    .from(CROSSPOST_QUEUE_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", args.userId)
    .in("status", args.statuses);
  if (args.sinceIso) query = query.gte("created_at", args.sinceIso);
  const { count, error } = await query;
  if (error) {
    throw new Error(`Failed to count queued cross-posts: ${error.message}`);
  }
  return count ?? 0;
}

