import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { sanitize, resolveIgHandleForCaption } from "@/lib/instagram/resolveIgHandle";

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

async function resolveUserId(request: NextRequest): Promise<string | null> {
  if (!supabase) return null;
  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) return null;
  const { data } = await supabase
    .from("userbase_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .is("revoked_at", null)
    .limit(1);
  const session = data?.[0];
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  return session.user_id as string;
}

/**
 * GET /api/userbase/profile/instagram
 *
 * Returns the caller's IG handle from any of the resolver's sources:
 *   - userbase_identities (DB) — fastest, what EditProfile writes
 *   - posting_json_metadata.profile.instagram on Hive — fallback
 *
 * Response shape:
 *   { handle: string | null, source: 'db' | 'hive' | null }
 *
 * The `source` field lets the cross-post composer decide whether the user
 * needs the prompt dialog (only "null" → prompt).
 */
export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. DB
  const { data } = await supabase
    .from("userbase_identities")
    .select("handle")
    .eq("user_id", userId)
    .eq("type", "instagram")
    .limit(1);
  const dbHandle = data?.[0]?.handle;
  if (dbHandle) {
    return NextResponse.json({ handle: dbHandle, source: "db" });
  }

  // 2. Hive metadata (need the linked Hive handle)
  const { data: hiveIds } = await supabase
    .from("userbase_identities")
    .select("handle")
    .eq("user_id", userId)
    .eq("type", "hive")
    .limit(1);
  const hiveHandle = hiveIds?.[0]?.handle;
  if (!hiveHandle) {
    return NextResponse.json({ handle: null, source: null });
  }
  const resolved = await resolveIgHandleForCaption({
    hiveAuthor: hiveHandle,
    userId,
    supabase,
  });
  return NextResponse.json({
    handle: resolved,
    source: resolved ? "hive" : null,
  });
}

/**
 * POST /api/userbase/profile/instagram
 * Body: { handle: string, source?: 'self_claim' | 'import_match' | 'crosspost_prompt' }
 *
 * Upserts (one row per user, enforced by primary_per_type unique index).
 * No OAuth verification — this is a self-claim. The caption builder treats it
 * as authoritative for @-mentions because the user chose to put it there.
 */
export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawHandle = typeof body?.handle === "string" ? body.handle : "";
  const handle = sanitize(rawHandle);
  if (!handle) {
    return NextResponse.json(
      { error: "Invalid Instagram handle. Use 1-30 letters, numbers, '.', or '_'." },
      { status: 400 }
    );
  }
  const source = typeof body?.source === "string" ? body.source : "self_claim";

  // Check if this handle is already claimed by another user (enforced by the
  // unique index but we want a clean error instead of a 500).
  const { data: existing } = await supabase
    .from("userbase_identities")
    .select("user_id")
    .eq("type", "instagram")
    .ilike("handle", handle)
    .neq("user_id", userId)
    .limit(1);
  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: `@${handle} is already claimed by another SkateHive user.` },
      { status: 409 }
    );
  }

  // Upsert: delete existing IG identity for this user, then insert. Simpler
  // than an actual upsert because userbase_identities has multiple unique
  // indices and the per-user 'is_primary' index makes ON CONFLICT awkward.
  await supabase
    .from("userbase_identities")
    .delete()
    .eq("user_id", userId)
    .eq("type", "instagram");

  const { data: inserted, error: insertErr } = await supabase
    .from("userbase_identities")
    .insert({
      user_id: userId,
      type: "instagram",
      handle,
      is_primary: true,
      metadata: { source, claimed_at: new Date().toISOString() },
    })
    .select("handle, metadata, created_at")
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: insertErr.message || "Failed to save Instagram handle." },
      { status: 500 }
    );
  }

  return NextResponse.json({ handle: inserted.handle, metadata: inserted.metadata });
}

/**
 * DELETE /api/userbase/profile/instagram
 * Removes the stored Instagram handle for the caller. Captions revert to
 * the plain "By {hive_user}" form.
 */
export async function DELETE(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await supabase
    .from("userbase_identities")
    .delete()
    .eq("user_id", userId)
    .eq("type", "instagram");
  return NextResponse.json({ ok: true });
}
