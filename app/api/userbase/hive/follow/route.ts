import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import HiveClient from "@/lib/hive/hiveclient";

export const runtime = "nodejs";

// Smart proxy (Phase 2 userbase unification): the follow/unfollow TOGGLE is a
// read, so it stays on web (resolve the follower handle + query the current
// relationship); the actual broadcast is delegated to api.skatehive.app, which
// is the single owner of the signing/broadcast. The userbase_refresh cookie
// value is forwarded as Authorization: Bearer (api hive routes are Bearer-only).

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function getSessionUserId(
  request: NextRequest
): Promise<{ error: NextResponse } | { userId: string }> {
  if (!supabase) {
    return { error: NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 }) };
  }
  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: sessionRows, error: sessionError } = await supabase
    .from("userbase_sessions")
    .select("id, user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .is("revoked_at", null)
    .limit(1);
  if (sessionError) {
    return { error: NextResponse.json({ error: "Failed to validate session" }, { status: 500 }) };
  }
  const session = sessionRows?.[0];
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (new Date(session.expires_at) < new Date()) {
    return { error: NextResponse.json({ error: "Session expired" }, { status: 401 }) };
  }
  return { userId: session.user_id };
}

async function getHiveIdentity(userId: string) {
  const { data } = await supabase!
    .from("userbase_identities")
    .select("id, handle, is_primary")
    .eq("user_id", userId)
    .eq("type", "hive")
    .order("is_primary", { ascending: false })
    .limit(1);
  return data?.[0] || null;
}

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  const session = await getSessionUserId(request);
  if ("error" in session) return session.error;
  const userId = session.userId;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const following = typeof body?.following === "string" ? body.following.trim() : "";
  if (!following || !/^[a-z0-9.-]{3,16}$/.test(following)) {
    return NextResponse.json({ error: "Invalid account to follow" }, { status: 400 });
  }

  const hiveIdentity = await getHiveIdentity(userId);
  const follower = hiveIdentity?.handle || null;
  if (!follower) {
    return NextResponse.json(
      { error: "Hive identity not linked", code: "HIVE_IDENTITY_NOT_LINKED" },
      { status: 400 }
    );
  }
  if (follower === following) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  // Toggle detection (read) stays on web; "blog" = follow, "" = unfollow.
  let alreadyFollowing = false;
  try {
    const rel = await HiveClient.call("bridge", "get_relationship_between_accounts", {
      account1: follower,
      account2: following,
    });
    alreadyFollowing = Boolean(rel?.follows);
  } catch {
    alreadyFollowing = false;
  }
  const type = alreadyFollowing ? "" : "blog";

  // Delegate the broadcast to api (single owner). Cookie value -> Bearer.
  try {
    const upstream = await fetch("https://api.skatehive.app/api/userbase/hive/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${refreshToken}` },
      body: JSON.stringify({ following, type }),
    });
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "upstream unavailable" }, { status: 502 });
  }
}
