import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { publishCast, type CastEmbed } from "@/lib/farcaster/neynar";

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

// Allowed Farcaster channels for cross-posts. Restricting server-side
// prevents typos / abuse and matches the UI options surfaced to users.
const ALLOWED_CHANNELS = new Set(["skateboard", "gnars", "higher"]);

/**
 * POST /api/farcaster/cast
 * Publish a root Farcaster cast (no parent) on behalf of the authenticated user.
 *
 * Body: {
 *   text: string,
 *   embeds?: ({ url: string } | { cast_id: { fid, hash } })[],
 *   channel_id?: string,
 * }
 */
export async function POST(request: NextRequest) {
  const signer = await getSignerUuid(request);
  if (signer.error) return signer.error;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text: unknown = body?.text;
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }
  if (text.length > 1024) {
    return NextResponse.json(
      { error: "Text too long (max 1024 chars)" },
      { status: 400 }
    );
  }

  let embeds: CastEmbed[] | undefined;
  if (Array.isArray(body?.embeds)) {
    embeds = body.embeds
      .filter((e: any) => {
        if (e && typeof e === "object" && typeof e.url === "string") return true;
        if (
          e &&
          typeof e === "object" &&
          e.cast_id &&
          typeof e.cast_id.fid === "number" &&
          typeof e.cast_id.hash === "string"
        )
          return true;
        return false;
      })
      .slice(0, 2);
  }

  let channelId: string | undefined;
  if (body?.channel_id) {
    const raw = String(body.channel_id).trim().toLowerCase().replace(/^\/+/, "");
    if (raw) {
      if (!ALLOWED_CHANNELS.has(raw)) {
        return NextResponse.json(
          { error: `Channel /${raw} is not enabled for cross-posting` },
          { status: 400 }
        );
      }
      channelId = raw;
    }
  }

  const result = await publishCast(
    signer.signerUuid!,
    text.trim(),
    undefined,
    embeds,
    channelId
  );
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, hash: result.hash });
}
