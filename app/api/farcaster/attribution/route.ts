import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  recordPublishedCrossPost,
  type FarcasterQueuePayload,
} from "@/lib/crosspost/queue";
import { resolveChannelKey } from "@/lib/farcaster/channels";

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

/** A Farcaster cast hash: 0x + 40 hex chars. */
const CAST_HASH_RE = /^0x[0-9a-fA-F]{40}$/;

/**
 * POST /api/farcaster/attribution
 *
 * Record a cast that was published by the FARCASTER HOST, not by us.
 *
 * On the miniapp path the user composes through `sdk.actions.composeCast`, so
 * the cast never touches our server and `/api/farcaster/cast` never runs. The
 * host hands back the created cast's hash; this route is where that hash
 * becomes a durable record, filed straight as `published`.
 *
 * This route does NOT publish anything and cannot: it only writes an audit
 * row for a cast that already exists. It is therefore best-effort by design —
 * the caller should log a failure and move on, because the user's cast is
 * already public either way and an error here would be a lie about what
 * happened.
 *
 * Body: { hash: "0x...", text?: string, embeds?: string[], channel?: string,
 *         permalink_url?: string }
 */
export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Missing config" }, { status: 500 });
  }

  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sessionRows } = await supabase
    .from("userbase_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .is("revoked_at", null)
    .limit(1);

  const session = sessionRows?.[0];
  if (!session || new Date(session.expires_at) < new Date()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hash: unknown = body?.hash;
  if (typeof hash !== "string" || !CAST_HASH_RE.test(hash)) {
    return NextResponse.json(
      { error: "Missing or malformed cast hash" },
      { status: 400 }
    );
  }

  const { data: identities } = await supabase
    .from("userbase_identities")
    .select("type, handle")
    .eq("user_id", session.user_id)
    .eq("type", "hive")
    .limit(1);

  const payload: FarcasterQueuePayload = {
    text: typeof body?.text === "string" ? body.text.trim() : "",
    embeds: Array.isArray(body?.embeds)
      ? body.embeds
          .filter((url: unknown): url is string => typeof url === "string")
          .slice(0, 2)
          .map((url: string) => ({ url }))
      : [],
    // Re-resolved against the allowlist rather than trusted: the client picked
    // the channel and the host acted on it without our server ever seeing it,
    // so an unrecognized value is recorded as "no channel" instead of being
    // written through into our own audit trail.
    channel_id: resolveChannelKey(body?.channel) ?? null,
    permalink_url:
      typeof body?.permalink_url === "string"
        ? body.permalink_url.trim()
        : undefined,
  };

  const recorded = await recordPublishedCrossPost({
    supabase,
    target: "farcaster",
    userId: session.user_id as string,
    requestedByHandle: (identities?.[0]?.handle as string | undefined) ?? null,
    payload,
    result: { cast_hash: hash },
  });

  if (!recorded.ok) {
    console.warn(`[crosspost] attribution write failed for ${hash}:`, recorded.error);
    return NextResponse.json({ error: recorded.error }, { status: 500 });
  }

  return NextResponse.json({ success: true, queue_id: recorded.id });
}
