import { NextRequest, NextResponse } from "next/server";
import {
  CROSSPOST_QUEUE_TABLE,
  type CrossPostQueueStatus,
  type CrossPostTarget,
} from "@/lib/crosspost/queue";
import { getServiceSupabase } from "@/lib/supabase/serviceClient";
import { requireCurator } from "@/lib/crosspost/queueAuth";

/**
 * GET /api/crosspost/queue
 *
 * The curation team's inbox. Lists cross-post requests awaiting a decision.
 * Called by the SkateHive portal (separate repo) with the portal token, or by
 * an admin browsing from inside the app with their session cookie.
 *
 * Query params:
 *   - status : comma-separated (default "pending_review"), or "all"
 *   - target : "instagram" | "farcaster" (default: both)
 *   - author : filter by Hive author
 *   - limit  : 1-100 (default 50)
 *   - offset : pagination offset (default 0)
 *   - order  : "oldest" (default, FIFO review) | "newest"
 */

const VALID_STATUSES: CrossPostQueueStatus[] = [
  "pending_review",
  "approved",
  "publishing",
  "published",
  "rejected",
  "failed",
];

const VALID_TARGETS: CrossPostTarget[] = ["instagram", "farcaster"];

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server is missing Supabase config." }, { status: 500 });
  }

  const auth = await requireCurator(request, supabase);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);

  const statusParam = (searchParams.get("status") || "pending_review").trim();
  let statuses: CrossPostQueueStatus[] | null = null;
  if (statusParam !== "all") {
    statuses = statusParam
      .split(",")
      .map((s) => s.trim())
      .filter((s): s is CrossPostQueueStatus =>
        (VALID_STATUSES as string[]).includes(s)
      );
    if (statuses.length === 0) {
      return NextResponse.json(
        { error: `Invalid status. Use one of: ${VALID_STATUSES.join(", ")}, or "all".` },
        { status: 400 }
      );
    }
  }

  const targetParam = searchParams.get("target");
  if (targetParam && !(VALID_TARGETS as string[]).includes(targetParam)) {
    return NextResponse.json(
      { error: `Invalid target. Use one of: ${VALID_TARGETS.join(", ")}.` },
      { status: 400 }
    );
  }

  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const ascending = (searchParams.get("order") || "oldest") !== "newest";

  let query = supabase
    .from(CROSSPOST_QUEUE_TABLE)
    .select("*", { count: "exact" })
    .order("created_at", { ascending })
    .range(offset, offset + limit - 1);

  if (statuses) query = query.in("status", statuses);
  if (targetParam) query = query.eq("target", targetParam);
  // Hive handles are stored lowercase, so normalize before matching or a
  // portal search for "@Skater" silently returns nothing.
  const author = searchParams.get("author");
  if (author) query = query.eq("hive_author", author.trim().replace(/^@/, "").toLowerCase());

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Attach the requester's SkateHive profile so the portal can render a face
  // next to each item without a second round-trip.
  const userIds = Array.from(
    new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))
  );
  const profiles = new Map<string, any>();
  if (userIds.length > 0) {
    const { data: users } = await supabase
      .from("userbase_users")
      .select("id, handle, display_name, avatar_url")
      .in("id", userIds);
    for (const u of users ?? []) profiles.set(u.id, u);
  }

  return NextResponse.json({
    success: true,
    total: count ?? 0,
    limit,
    offset,
    items: (data ?? []).map((row: any) => ({
      ...row,
      requester: row.user_id ? profiles.get(row.user_id) ?? null : null,
    })),
  });
}
