import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { validateBtcAddress, normalizeBtcAddress } from "@/lib/utils/validateBtcAddress";

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
 * GET /api/userbase/profile/btc
 *
 * Returns the caller's stored BTC address from the userbase DB.
 * Response: { address: string | null, source: 'db' | null }
 *
 * (Unlike the Instagram resolver, we don't fall back to Hive metadata here —
 * the EditProfile/settings UIs already read `extensions.wallets.btc_address`
 * from the Hive account for their initial value.)
 */
export async function GET(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }
  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabase
    .from("userbase_identities")
    .select("address")
    .eq("user_id", userId)
    .eq("type", "btc")
    .limit(1);
  const address = data?.[0]?.address ?? null;
  return NextResponse.json({ address, source: address ? "db" : null });
}

/**
 * POST /api/userbase/profile/btc
 * Body: { address: string, source?: string }
 *
 * Self-claim — no ownership signature. Validates format only, then upserts
 * (one BTC identity per user). Mirrors the Instagram route's delete-then-insert
 * because userbase_identities has multiple unique indices that make ON CONFLICT
 * awkward.
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

  const rawAddress = typeof body?.address === "string" ? body.address : "";
  if (!validateBtcAddress(rawAddress)) {
    return NextResponse.json(
      { error: "Invalid Bitcoin address." },
      { status: 400 }
    );
  }
  const address = normalizeBtcAddress(rawAddress);
  const source = typeof body?.source === "string" ? body.source : "self_claim";

  await supabase
    .from("userbase_identities")
    .delete()
    .eq("user_id", userId)
    .eq("type", "btc");

  const { data: inserted, error: insertErr } = await supabase
    .from("userbase_identities")
    .insert({
      user_id: userId,
      type: "btc",
      address,
      is_primary: true,
      metadata: { source, claimed_at: new Date().toISOString() },
    })
    .select("address, metadata, created_at")
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: insertErr.message || "Failed to save Bitcoin address." },
      { status: 500 }
    );
  }

  return NextResponse.json({ address: inserted.address, metadata: inserted.metadata });
}

/**
 * DELETE /api/userbase/profile/btc
 * Removes the stored BTC address for the caller.
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
    .eq("type", "btc");
  return NextResponse.json({ ok: true });
}
