import { NextRequest, NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/serviceClient";
import { resolveSessionUserId } from "@/lib/userbase/session";
import { APP_NOTIFICATIONS_TABLE } from "@/lib/notifications/appNotifications";

/**
 * App-owned notifications for the signed-in user (migration 0030).
 *
 * These sit alongside the Hive notifications the app already shows — they're
 * the things SkateHive itself decided, like the curation team approving or
 * passing on a cross-post.
 *
 * Auth is the userbase session cookie only. A Keychain-only user with no
 * userbase session won't see these; they'd need to sign in once for the
 * session to exist.
 *
 * GET  ?limit=&offset=&unread_only=true  → { items, unread_count, total }
 * POST { ids: string[] } | { all: true } → marks read
 */

export async function GET(request: NextRequest) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server is missing Supabase config." }, { status: 500 });
  }

  const userId = await resolveSessionUserId(request, supabase);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 30, 1), 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const unreadOnly = searchParams.get("unread_only") === "true";

  let query = supabase
    .from(APP_NOTIFICATIONS_TABLE)
    .select("*", { count: "exact" })
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (unreadOnly) query = query.is("read_at", null);

  const { data, count, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Always report the true unread total, not just the unread inside this page.
  const { count: unreadCount } = await supabase
    .from(APP_NOTIFICATIONS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  return NextResponse.json({
    success: true,
    items: data ?? [],
    total: count ?? 0,
    unread_count: unreadCount ?? 0,
    limit,
    offset,
  });
}

export async function POST(request: NextRequest) {
  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json({ error: "Server is missing Supabase config." }, { status: 500 });
  }

  const userId = await resolveSessionUserId(request, supabase);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({} as any));
  const ids: string[] = Array.isArray(body?.ids)
    ? body.ids.filter((i: unknown): i is string => typeof i === "string")
    : [];
  const all = body?.all === true;

  if (!all && ids.length === 0) {
    return NextResponse.json(
      { error: 'Pass either { all: true } or { ids: [...] }.' },
      { status: 400 }
    );
  }

  // The user_id filter is what makes this safe: a caller can't mark someone
  // else's notification read by guessing an id.
  let query = supabase
    .from(APP_NOTIFICATIONS_TABLE)
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (!all) query = query.in("id", ids);

  const { error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count: unreadCount } = await supabase
    .from(APP_NOTIFICATIONS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);

  return NextResponse.json({ success: true, unread_count: unreadCount ?? 0 });
}
