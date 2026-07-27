import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/serviceClient";
import { requireCurator } from "@/lib/crosspost/queueAuth";
import { claimQueueItem, publishQueueItem } from "@/lib/crosspost/publishQueueItem";
import {
  notifyCrossPostApproved,
  notifyCrossPostFailed,
} from "@/lib/notifications/appNotifications";

/**
 * POST /api/crosspost/queue/[id]/approve
 *
 * The curation team says yes → publish NOW. This is the only path (besides the
 * moderator force-post route) that actually calls Meta / Neynar for a
 * user-requested cross-post.
 *
 * Body (all optional — last-minute edits by the curator):
 *   - caption        : Instagram legenda override
 *   - collaborators  : Instagram Collab handles override
 *   - text           : Farcaster cast text override
 *   - channel_id     : Farcaster channel override
 *   - note           : free-text note stored on the row
 *
 * The item is compare-and-swapped into `publishing` before any network call,
 * so two curators clicking Approve at the same time can't double-post.
 */

// Publishing blocks on Meta's container pipeline: a Reel polls for up to 180s
// and a carousel does that per item plus a 60s finalize. The platform default
// (10-15s) would kill the request mid-publish, leaving the row stranded in
// `publishing` until STALE_PUBLISHING_MS lets someone retry.
export const maxDuration = 300;

const IG_CAPTION_LIMIT = 2200;
const CAST_MAX_CHARS = 1024;
const ALLOWED_CHANNELS = new Set(["skateboard", "gnars", "higher"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server is missing Supabase config." }, { status: 500 });
  }

  const auth = await requireCurator(request, supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({} as any));

  // Whitelist what a curator may override — never merge the raw body, or the
  // portal could rewrite hive_author / media URLs after the author's gates ran.
  const patch: Record<string, unknown> = {};
  if (typeof body?.caption === "string") {
    patch.caption = body.caption.trim().slice(0, IG_CAPTION_LIMIT);
  }
  if (Array.isArray(body?.collaborators)) {
    patch.collaborators = body.collaborators
      .filter((c: unknown): c is string => typeof c === "string")
      .map((c: string) => c.trim().replace(/^@/, "").toLowerCase())
      .filter(Boolean)
      .slice(0, 3);
  }
  if (typeof body?.text === "string" && body.text.trim()) {
    patch.text = body.text.trim().slice(0, CAST_MAX_CHARS);
  }
  if (typeof body?.channel_id === "string") {
    const raw = body.channel_id.trim().toLowerCase().replace(/^\/+/, "");
    if (raw && !ALLOWED_CHANNELS.has(raw)) {
      return NextResponse.json(
        { error: `Channel /${raw} is not enabled for cross-posting` },
        { status: 400 }
      );
    }
    patch.channel_id = raw || null;
  }

  const claim = await claimQueueItem({
    supabase,
    id,
    curatorHandle: auth.curator.handle,
    curatorUserId: auth.curator.userId,
    payloadPatch: Object.keys(patch).length > 0 ? patch : null,
  });
  if (!claim.ok) {
    return NextResponse.json({ error: claim.error }, { status: claim.status });
  }

  if (typeof body?.note === "string" && body.note.trim()) {
    await supabase
      .from("userbase_crosspost_queue")
      .update({ review_note: body.note.trim().slice(0, 500) })
      .eq("id", id);
  }

  const outcome = await publishQueueItem(supabase, claim.item);

  if (!outcome.success) {
    // The row is already marked `failed` with the error — the curator can
    // retry from the portal once the cause is fixed. Tell the author too:
    // some causes (a revoked Farcaster signer) are only theirs to fix.
    await notifyCrossPostFailed({
      supabase,
      userId: claim.item.user_id,
      queueId: id,
      target: claim.item.target,
      hivePermlink: claim.item.hive_permlink,
      error: outcome.error || "Unknown error.",
    });
    return NextResponse.json(
      { error: outcome.error, queue_id: id, status: "failed" },
      { status: 502 }
    );
  }

  // Built by the publisher, which knows the platform's permalink format and
  // returns null rather than guessing when it can't build a real one.
  const publishedUrl =
    (outcome.result?.ig_permalink as string | null) ??
    (outcome.result?.cast_url as string | null) ??
    null;

  await notifyCrossPostApproved({
    supabase,
    userId: claim.item.user_id,
    queueId: id,
    target: claim.item.target,
    hivePermlink: claim.item.hive_permlink,
    publishedUrl,
  });

  return NextResponse.json({
    success: true,
    queue_id: id,
    status: "published",
    target: claim.item.target,
    approved_by: auth.curator.handle,
    result: outcome.result ?? null,
  });
}
