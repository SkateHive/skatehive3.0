import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  countQueueItemsForUser,
  enqueueCrossPost,
  isCrossPostQueueEnabled,
  type FarcasterQueuePayload,
} from "@/lib/crosspost/queue";
import { publishQueueItemNow } from "@/lib/crosspost/publishQueueItem";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

// Cap on how many casts one user can have sitting unreviewed, so a single
// account can't flood the curators' inbox.
const PER_USER_PENDING_LIMIT = 5;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

interface CasterIdentity {
  userId: string;
  hiveHandle: string | null;
}

/**
 * Resolve the requesting user AND assert their Farcaster signer is approved.
 *
 * The signer isn't used here anymore (the cast is published later, from the
 * queue), but we still check it now so the user finds out immediately that
 * they need to authorize — not days later when a curator's approval fails.
 * publishQueueItem() re-resolves the signer at publish time, so a revocation
 * in between is still respected.
 */
async function resolveCaster(
  request: NextRequest
): Promise<{ caster: CasterIdentity } | { error: NextResponse }> {
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
    .select("type, handle, metadata")
    .eq("user_id", session.user_id)
    .in("type", ["farcaster", "hive"]);

  const farcaster = identities?.find((i: any) => i.type === "farcaster");
  const metadata = farcaster?.metadata as Record<string, unknown> | undefined;
  const signerUuid = metadata?.signer_uuid as string | undefined;

  if (!signerUuid || metadata?.signer_status !== "approved") {
    return {
      error: NextResponse.json(
        { error: "Farcaster signer not approved", needsSigner: true },
        { status: 403 }
      ),
    };
  }

  const hive = identities?.find((i: any) => i.type === "hive");
  return {
    caster: {
      userId: session.user_id as string,
      hiveHandle: (hive?.handle as string | undefined) ?? null,
    },
  };
}

// Allowed Farcaster channels for cross-posts. Restricting server-side
// prevents typos / abuse and matches the UI options surfaced to users.
const ALLOWED_CHANNELS = new Set(["skateboard", "gnars", "higher"]);

/**
 * POST /api/farcaster/cast
 *
 * Request that a root Farcaster cast be published on behalf of the
 * authenticated user.
 *
 * This route does NOT cast. Since the curation queue landed it validates the
 * payload and files it as `pending_review` in `userbase_crosspost_queue`; the
 * curation team publishes it from the portal via
 * POST /api/crosspost/queue/{id}/approve.
 *
 * Body: {
 *   text: string,
 *   embeds?: ({ url: string })[],
 *   channel_id?: string,
 *   hive_author?: string,     // source snap, for dedupe + portal context
 *   hive_permlink?: string,
 *   permalink_url?: string,
 * }
 */
export async function POST(request: NextRequest) {
  const resolved = await resolveCaster(request);
  if ("error" in resolved) return resolved.error;
  const { caster } = resolved;

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

  // URL embeds only. The cast_id embed variant Neynar supports isn't reachable
  // from the composer's cross-post flow, and dropping it keeps the stored
  // payload a plain, reviewable list of links.
  let embeds: { url: string }[] = [];
  if (Array.isArray(body?.embeds)) {
    embeds = body.embeds
      .filter((e: any) => e && typeof e === "object" && typeof e.url === "string")
      .map((e: any) => ({ url: e.url as string }))
      .slice(0, 2);
  }

  let channelId: string | null = null;
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

  // Queue-flood guard. Fails CLOSED: if we can't count, we don't let it past.
  let pendingCount: number;
  try {
    pendingCount = await countQueueItemsForUser({
      supabase,
      userId: caster.userId,
      statuses: ["pending_review"],
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't check your pending cross-posts. Try again in a moment." },
      { status: 503 }
    );
  }
  if (pendingCount >= PER_USER_PENDING_LIMIT) {
    return NextResponse.json(
      {
        error: `You already have ${pendingCount} cross-posts waiting for the curation team. Wait for those to be reviewed before sending more.`,
      },
      { status: 429 }
    );
  }

  // A cast with no Hive counterpart (Farcaster-only reply) queues with NULL
  // author/permlink — NULLs don't collide in the active-item unique index.
  const hiveAuthor =
    typeof body?.hive_author === "string" && body.hive_author.trim()
      ? body.hive_author.trim()
      : null;
  const hivePermlink =
    typeof body?.hive_permlink === "string" && body.hive_permlink.trim()
      ? body.hive_permlink.trim()
      : null;

  const payload: FarcasterQueuePayload = {
    text: text.trim(),
    embeds,
    channel_id: channelId,
    permalink_url:
      typeof body?.permalink_url === "string" ? body.permalink_url.trim() : undefined,
  };

  const enqueued = await enqueueCrossPost({
    supabase,
    target: "farcaster",
    userId: caster.userId,
    requestedByHandle: caster.hiveHandle,
    hiveAuthor,
    hivePermlink,
    payload,
  });

  if (!enqueued.ok) {
    return NextResponse.json({ error: enqueued.error }, { status: enqueued.status });
  }

  if (enqueued.duplicate) {
    return NextResponse.json({
      success: true,
      queued: true,
      already_queued: true,
      queue_id: enqueued.id,
      status: enqueued.duplicate.status,
    });
  }

  // Farcaster is not a curated target (the portal reviews Instagram only), so
  // this branch always runs today: the row is filed as an audit record and the
  // cast goes out immediately. Queueing it would leave it in `pending_review`
  // forever with nobody to review it.
  if (!isCrossPostQueueEnabled(caster.hiveHandle, "farcaster")) {
    const outcome = await publishQueueItemNow(supabase, enqueued.id);
    if (!outcome.success) {
      return NextResponse.json({ error: outcome.error }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      hash: outcome.result?.cast_hash ?? null,
    });
  }

  return NextResponse.json({
    success: true,
    queued: true,
    queue_id: enqueued.id,
    status: "pending_review",
  });
}
