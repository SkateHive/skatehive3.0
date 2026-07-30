/**
 * Executes a cross-post that the curation team approved.
 *
 * This is the ONLY place that actually talks to Meta / Neynar for queued
 * items. It is a dumb executor: everything about WHAT to post was decided and
 * normalized when the item was enqueued (see lib/crosspost/queue.ts). The one
 * thing it re-resolves at publish time is the Farcaster signer, so a signer the
 * user revoked after requesting the cross-post fails loudly instead of posting.
 */
import {
  publishCarouselToInstagram,
  publishImageToInstagram,
  publishReelToInstagram,
  isInstagramConfigured,
} from "@/lib/instagram/graph";
import { publishCast } from "@/lib/farcaster/neynar";
import {
  CROSSPOST_QUEUE_TABLE,
  type CrossPostQueueRow,
  type FarcasterQueuePayload,
  type InstagramQueuePayload,
} from "./queue";

export interface PublishQueueItemResult {
  success: boolean;
  error?: string;
  result?: Record<string, unknown>;
}

/** Meta rejects collaborator invites for private/blocked/ineligible accounts
 *  ("User not visible" etc.). That's optional, so we retry without it rather
 *  than fail the whole cross-post. */
function isCollaboratorVisibilityError(error: string | undefined) {
  return /user not visible|collaborator|invite/i.test(error || "");
}

/** Statuses an item can be approved from. `published` and `publishing` are
 *  excluded so a double-click can never double-post; a STALE `publishing` row
 *  is added back conditionally in claimQueueItem. */
export const CLAIMABLE_STATUSES = ["pending_review", "approved", "failed", "rejected"];

/**
 * How long a row may sit in `publishing` before we assume the attempt died.
 *
 * Publishing a Reel can block for minutes (Meta container polling), so a
 * serverless timeout mid-publish is a realistic outcome. Without this escape
 * the row would be permanently unapprovable: every later claim would bounce
 * off "another curator is publishing" with no way out but manual SQL.
 *
 * 10 minutes comfortably exceeds the worst legitimate publish (carousel:
 * 180s per item + 60s) plus the route's own maxDuration ceiling.
 */
export const STALE_PUBLISHING_MS = 10 * 60 * 1000;

function isStalePublishing(row: CrossPostQueueRow): boolean {
  if (row.status !== "publishing") return false;
  const startedAt = Date.parse(row.updated_at ?? row.created_at);
  if (!Number.isFinite(startedAt)) return true; // no usable timestamp → don't wedge
  return Date.now() - startedAt > STALE_PUBLISHING_MS;
}

export type ClaimResult =
  | { ok: true; item: CrossPostQueueRow }
  | { ok: false; status: number; error: string };

/**
 * Compare-and-swap the row into `publishing` so two curators clicking Approve
 * at the same time can't double-post. The UPDATE's WHERE clause carries the
 * status guard, so exactly one caller gets a row back — the loser sees zero
 * rows and bails.
 *
 * `payloadPatch` lets the curator tweak the copy (caption, collaborators,
 * channel) at approval time; it's persisted on the row so the record shows
 * what was actually sent.
 */
export async function claimQueueItem(args: {
  supabase: any;
  id: string;
  curatorHandle: string | null;
  curatorUserId: string | null;
  payloadPatch?: Record<string, unknown> | null;
}): Promise<ClaimResult> {
  const { supabase, id } = args;

  const { data: currentRows } = await supabase
    .from(CROSSPOST_QUEUE_TABLE)
    .select("*")
    .eq("id", id)
    .limit(1);
  const current = currentRows?.[0] as CrossPostQueueRow | undefined;
  if (!current) {
    return { ok: false, status: 404, error: "Queue item not found." };
  }
  if (current.status === "published") {
    return { ok: false, status: 409, error: "This item was already published." };
  }
  if (current.status === "publishing" && !isStalePublishing(current)) {
    return { ok: false, status: 409, error: "Another curator is publishing this right now." };
  }

  const now = new Date().toISOString();
  // Stored as jsonb, so a plain record is the honest shape here — the patch is
  // already whitelisted by the approve route.
  const mergedPayload: Record<string, unknown> = {
    ...(current.payload as unknown as Record<string, unknown>),
    ...(args.payloadPatch ?? {}),
  };

  // A stale `publishing` row is claimable again; a fresh one never is.
  const claimable = isStalePublishing(current)
    ? [...CLAIMABLE_STATUSES, "publishing"]
    : CLAIMABLE_STATUSES;

  let update = supabase
    .from(CROSSPOST_QUEUE_TABLE)
    .update({
      status: "publishing",
      payload: mergedPayload,
      reviewed_by_handle: args.curatorHandle,
      reviewed_by_user_id: args.curatorUserId,
      reviewed_at: now,
      updated_at: now,
    })
    .eq("id", id)
    .in("status", claimable);

  // Optimistic lock. The status filter alone is not enough once a stale
  // `publishing` row becomes claimable again — two curators could both see the
  // same stale row and both pass the status check. Pinning updated_at means
  // whoever writes first moves the value and the other one matches zero rows.
  if (current.updated_at) update = update.eq("updated_at", current.updated_at);

  const { data, error } = await update.select("*").limit(1);

  if (error) {
    // 23505: re-approving a rejected item whose (target, author, permlink)
    // slot was meanwhile taken by a newer request.
    if ((error as any).code === "23505") {
      return {
        ok: false,
        status: 409,
        error: "A newer request for this same snap is already in the queue.",
      };
    }
    return { ok: false, status: 500, error: error.message };
  }

  const claimed = data?.[0] as CrossPostQueueRow | undefined;
  if (!claimed) {
    return { ok: false, status: 409, error: "Another curator just claimed this item." };
  }
  return { ok: true, item: claimed };
}

async function publishInstagramItem(
  supabase: any,
  item: CrossPostQueueRow
): Promise<PublishQueueItemResult> {
  if (!isInstagramConfigured()) {
    return { success: false, error: "Instagram is not configured on the server." };
  }

  const payload = item.payload as InstagramQueuePayload;
  const mediaItems = payload.media_items ?? [];
  const isCarousel = mediaItems.length >= 2;
  const imageUrl = payload.image_url || "";
  const videoUrl = payload.video_url || "";
  const caption = payload.caption || "";

  if (!isCarousel && !imageUrl && !videoUrl) {
    return { success: false, error: "Queue item has no media to publish." };
  }

  const carouselItems = mediaItems.map((m) =>
    m.type === "video" ? { videoUrl: m.url } : { imageUrl: m.url }
  );
  const doPublish = (collab: string[] | undefined) =>
    isCarousel
      ? publishCarouselToInstagram({ items: carouselItems, caption, collaborators: collab })
      : videoUrl
      ? publishReelToInstagram({
          videoUrl,
          caption,
          coverUrl: imageUrl || undefined,
          collaborators: collab,
        })
      : publishImageToInstagram({ imageUrl, caption, collaborators: collab });

  const collaborators =
    payload.collaborators && payload.collaborators.length > 0
      ? payload.collaborators
      : undefined;

  let publishResult = await doPublish(collaborators);
  let collaboratorRetryError: string | null = null;
  // For a CAROUSEL the `collaborators` param is undocumented and Meta may
  // reject it with a generic "Invalid parameter", so retry on ANY failure
  // there. Image/Reel keep the targeted visibility-error check.
  if (
    !publishResult.success &&
    collaborators &&
    (isCarousel || isCollaboratorVisibilityError(publishResult.error))
  ) {
    collaboratorRetryError = publishResult.error ?? null;
    publishResult = await doPublish(undefined);
  }

  if (!publishResult.success) {
    const error = collaboratorRetryError
      ? `${publishResult.error} (also retried without collaborator after: ${collaboratorRetryError})`
      : publishResult.error;
    return { success: false, error: error || "Instagram publish failed." };
  }

  // Mirror the result into the existing IG registry so dedupe, the per-user
  // 24h cap and the composer preview keep working off one table.
  if (item.hive_author && item.hive_permlink) {
    await supabase
      .from("userbase_instagram_posts")
      .upsert(
        {
          user_id: item.user_id,
          hive_author: item.hive_author,
          hive_permlink: item.hive_permlink,
          ig_media_type: payload.ig_media_type,
          caption,
          image_url: imageUrl || null,
          video_url: videoUrl || null,
          status: "published",
          error: null,
          ig_container_id: publishResult.containerId,
          ig_media_id: publishResult.mediaId,
          ig_permalink: publishResult.permalink || null,
          published_at: new Date().toISOString(),
        },
        { onConflict: "hive_author,hive_permlink" }
      );
  }

  return {
    success: true,
    result: {
      ig_media_id: publishResult.mediaId,
      ig_permalink: publishResult.permalink || null,
      ...(publishResult.skipped && publishResult.skipped.length
        ? { skipped: publishResult.skipped }
        : {}),
    },
  };
}

async function publishFarcasterItem(
  supabase: any,
  item: CrossPostQueueRow
): Promise<PublishQueueItemResult> {
  const payload = item.payload as FarcasterQueuePayload;
  if (!payload.text || !payload.text.trim()) {
    return { success: false, error: "Queue item has no cast text." };
  }
  if (!item.user_id) {
    return { success: false, error: "Queue item has no user to cast on behalf of." };
  }

  // Re-resolve the signer NOW, not at enqueue time — the user may have revoked
  // it while the item sat in review.
  const { data: identities } = await supabase
    .from("userbase_identities")
    .select("handle, metadata")
    .eq("user_id", item.user_id)
    .eq("type", "farcaster")
    .limit(1);
  const metadata = identities?.[0]?.metadata as Record<string, unknown> | undefined;
  const signerUuid = metadata?.signer_uuid as string | undefined;
  // The fname, stored when the identity was linked. Needed for the cast
  // permalink — Farcaster's format is /{username}/{hash}, and publishCast only
  // hands back the hash.
  const fname = (identities?.[0]?.handle as string | undefined) ?? null;
  if (!signerUuid || metadata?.signer_status !== "approved") {
    return {
      success: false,
      error:
        "The author's Farcaster signer is no longer approved — they need to re-authorize in Settings.",
    };
  }

  const result = await publishCast(
    signerUuid,
    payload.text.trim(),
    undefined,
    payload.embeds && payload.embeds.length > 0 ? payload.embeds : undefined,
    payload.channel_id || undefined
  );
  if (!result.success) {
    return { success: false, error: result.error || "Farcaster publish failed." };
  }
  // Only build a permalink when we actually have both parts. A guessed URL in
  // a notification is worse than no link — it sends the author to a 404.
  // farcaster.xyz, not warpcast.com: the client was renamed in 2025 and the
  // old host only survives as a redirect.
  const castUrl =
    fname && result.hash ? `https://farcaster.xyz/${fname}/${result.hash}` : null;
  return {
    success: true,
    result: { cast_hash: result.hash ?? null, cast_url: castUrl },
  };
}

/**
 * Enqueue-then-publish, used when the curation queue is switched OFF
 * (see isCrossPostQueueEnabled). Rather than keeping a second publish path
 * alive for the legacy behavior, the request still files a row and then
 * immediately approves it — the row survives as an audit record, and there is
 * exactly one piece of code that talks to Meta / Neynar.
 */
export const AUTO_PUBLISH_NOTE = "auto-published (curation queue disabled)";

export async function publishQueueItemNow(
  supabase: any,
  id: string
): Promise<PublishQueueItemResult> {
  const claim = await claimQueueItem({
    supabase,
    id,
    curatorHandle: null,
    curatorUserId: null,
  });
  if (!claim.ok) return { success: false, error: claim.error };

  // Say so explicitly rather than leaving "reviewed_at set, reviewer null" as
  // the only hint. Anyone auditing later shouldn't have to infer why a row has
  // a review timestamp and no reviewer.
  await supabase
    .from(CROSSPOST_QUEUE_TABLE)
    .update({ review_note: AUTO_PUBLISH_NOTE })
    .eq("id", id);

  return publishQueueItem(supabase, claim.item);
}

/**
 * Publish an already-claimed queue item and write the outcome back to the row.
 * Always leaves the row in a terminal-ish state (`published` or `failed`) so
 * nothing can get stuck in `publishing`.
 */
export async function publishQueueItem(
  supabase: any,
  item: CrossPostQueueRow
): Promise<PublishQueueItemResult> {
  let outcome: PublishQueueItemResult;
  try {
    outcome =
      item.target === "instagram"
        ? await publishInstagramItem(supabase, item)
        : await publishFarcasterItem(supabase, item);
  } catch (err: any) {
    outcome = { success: false, error: err?.message || "Unexpected publish error." };
  }

  const now = new Date().toISOString();
  await supabase
    .from(CROSSPOST_QUEUE_TABLE)
    .update(
      outcome.success
        ? {
            status: "published",
            published_at: now,
            publish_error: null,
            result: outcome.result ?? null,
            attempts: (item.attempts ?? 0) + 1,
            updated_at: now,
          }
        : {
            status: "failed",
            publish_error: outcome.error ?? "Unknown error",
            attempts: (item.attempts ?? 0) + 1,
            updated_at: now,
          }
    )
    .eq("id", item.id);

  return outcome;
}
