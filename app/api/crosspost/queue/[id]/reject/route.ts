import { NextRequest, NextResponse } from "next/server";
import { CROSSPOST_QUEUE_TABLE } from "@/lib/crosspost/queue";
import { getServiceSupabase } from "@/lib/supabase/serviceClient";
import { requireCurator } from "@/lib/crosspost/queueAuth";
import { notifyCrossPostRejected } from "@/lib/notifications/appNotifications";

/**
 * POST /api/crosspost/queue/[id]/reject
 *
 * The curation team passes on this one. Rejecting frees the
 * (target, author, permlink) slot, so the author can request it again later
 * (e.g. after fixing the clip) — see the partial unique index in 0029.
 *
 * Body:
 *   - note? : reason shown to the team (and available to surface to the author)
 */
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
  const note =
    typeof body?.note === "string" && body.note.trim()
      ? body.note.trim().slice(0, 500)
      : null;

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(CROSSPOST_QUEUE_TABLE)
    .update({
      status: "rejected",
      reviewed_by_handle: auth.curator.handle,
      reviewed_by_user_id: auth.curator.userId,
      reviewed_at: now,
      review_note: note,
      updated_at: now,
    })
    .eq("id", id)
    // Never walk back something already live, or yank an item out from under
    // an in-flight publish.
    .in("status", ["pending_review", "approved", "failed"])
    .select("id, status, target, hive_author, hive_permlink, user_id")
    .limit(1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rejected = data?.[0];
  if (!rejected) {
    return NextResponse.json(
      { error: "Item not found, or it is already published / publishing." },
      { status: 409 }
    );
  }

  // Tell the author. Without this a rejection is silent and they're left
  // assuming the cross-post is still pending forever.
  await notifyCrossPostRejected({
    supabase,
    userId: rejected.user_id,
    queueId: id,
    target: rejected.target,
    hivePermlink: rejected.hive_permlink,
    note,
  });

  return NextResponse.json({
    success: true,
    queue_id: id,
    status: "rejected",
    rejected_by: auth.curator.handle,
    note,
  });
}
