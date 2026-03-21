import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { publishReaction, deleteReaction } from "@/lib/farcaster/neynar";

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

async function getSignerUuid(request: NextRequest) {
  if (!supabase) {
    return { error: NextResponse.json({ error: "Missing config" }, { status: 500 }) };
  }

  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: sessionRows } = await supabase
    .from("userbase_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .is("revoked_at", null)
    .limit(1);

  const session = sessionRows?.[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: identities } = await supabase
    .from("userbase_identities")
    .select("metadata")
    .eq("user_id", session.user_id)
    .eq("type", "farcaster")
    .limit(1);

  const metadata = identities?.[0]?.metadata as Record<string, unknown> | undefined;
  const signerUuid = metadata?.signer_uuid as string | undefined;

  if (!signerUuid || metadata?.signer_status !== "approved") {
    return {
      error: NextResponse.json(
        { error: "Farcaster signer not approved", needsSigner: true },
        { status: 403 }
      ),
    };
  }

  return { signerUuid };
}

/**
 * POST /api/farcaster/reaction
 * Body: { reactionType: "like"|"recast", targetHash: "0x..." }
 */
export async function POST(request: NextRequest) {
  const signer = await getSignerUuid(request);
  if (signer.error) return signer.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reactionType, targetHash } = body || {};
  if (!reactionType || !targetHash) {
    return NextResponse.json(
      { error: "Missing reactionType or targetHash" },
      { status: 400 }
    );
  }

  if (reactionType !== "like" && reactionType !== "recast") {
    return NextResponse.json(
      { error: "reactionType must be 'like' or 'recast'" },
      { status: 400 }
    );
  }

  const result = await publishReaction(signer.signerUuid!, reactionType, targetHash);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/farcaster/reaction
 * Body: { reactionType: "like"|"recast", targetHash: "0x..." }
 */
export async function DELETE(request: NextRequest) {
  const signer = await getSignerUuid(request);
  if (signer.error) return signer.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reactionType, targetHash } = body || {};
  if (!reactionType || !targetHash) {
    return NextResponse.json(
      { error: "Missing reactionType or targetHash" },
      { status: 400 }
    );
  }

  const result = await deleteReaction(signer.signerUuid!, reactionType, targetHash);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
