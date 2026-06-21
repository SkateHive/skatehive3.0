import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Read/update the curation-trail opt-out for the logged-in user's stored Hive
// posting key. Opt-IN is the default (trail_opt_out=false). Unchecking
// "Support SkateHive official posts" sets trail_opt_out=true, removing the user
// from the marketing portal's trail that boosts official posts.

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
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

async function getSessionUserId(request: NextRequest) {
  if (!supabase) {
    return { error: NextResponse.json({ error: "Missing Supabase configuration" }, { status: 500 }) };
  }
  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: sessionRows, error } = await supabase
    .from("userbase_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .is("revoked_at", null)
    .limit(1);
  if (error) {
    return { error: NextResponse.json({ error: "Failed to validate session" }, { status: 500 }) };
  }
  const session = sessionRows?.[0];
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (new Date(session.expires_at) < new Date()) {
    return { error: NextResponse.json({ error: "Session expired" }, { status: 401 }) };
  }
  return { userId: session.user_id as string };
}

export async function GET(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) return session.error;

  const { data, error } = await supabase!
    .from("userbase_hive_keys")
    .select("trail_opt_out, trail_vote_weight")
    .eq("user_id", session.userId)
    .limit(1);
  if (error) {
    // Columns may not be migrated yet — treat as opted-in at the default weight.
    return NextResponse.json({ has_key: false, support_official: true, vote_weight: 5000 });
  }
  const row = data?.[0];
  return NextResponse.json({
    has_key: !!row,
    support_official: row ? row.trail_opt_out !== true : true,
    vote_weight: row && typeof row.trail_vote_weight === "number" ? row.trail_vote_weight : 5000,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSessionUserId(request);
  if (session.error) return session.error;

  let body: { support_official?: boolean; vote_weight?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.support_official === "boolean") {
    update.trail_opt_out = !body.support_official;
  }
  if (typeof body.vote_weight === "number") {
    // Clamp to 1..10000 (0.01%..100%).
    update.trail_vote_weight = Math.max(1, Math.min(10000, Math.round(body.vote_weight)));
  }
  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase!
    .from("userbase_hive_keys")
    .update(update)
    .eq("user_id", session.userId);
  if (error) {
    return NextResponse.json({ error: "Failed to update preference" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
