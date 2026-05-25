import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import {
  isInstagramConfigured,
  publishImageToInstagram,
  publishReelToInstagram,
} from "@/lib/instagram/graph";
import { buildInstagramCaption } from "@/lib/instagram/caption";
import { getHivePowerForAccount } from "@/lib/hive/serverHivePower";

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

// Global cap is well under Meta's 25-per-account/24h limit so a moderator can
// still post a few times directly from Business Suite without hitting the wall.
const PER_USER_24H_LIMIT = 1;
const GLOBAL_24H_LIMIT = 20;

// Trusted-user gate: cross-posting publishes to the shared @skatehive IG, so
// only Hive accounts with enough stake are allowed. Matches the threshold used
// elsewhere in the app (SnapComposer's video-length bypass).
const MIN_HIVE_POWER_TO_CROSSPOST = 100;

async function resolveUserId(request: NextRequest): Promise<string | null> {
  if (!supabase) return null;
  const refreshToken = request.cookies.get("userbase_refresh")?.value;
  if (!refreshToken) return null;

  const { data: sessionRows } = await supabase
    .from("userbase_sessions")
    .select("user_id, expires_at, revoked_at")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .is("revoked_at", null)
    .limit(1);

  const session = sessionRows?.[0];
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  return session.user_id as string;
}

/**
 * POST /api/instagram/post
 *
 * Cross-post an already-published SkateHive Hive post to the shared @skatehive
 * Instagram Business account via Meta Graph API.
 *
 * Body:
 *   - hive_author: string   (required) Hive username that owns the post
 *   - hive_permlink: string (required) Hive permlink
 *   - title: string         (required)
 *   - body: string          (required) raw markdown — used for caption excerpt
 *   - tags?: string[]       hashtags to merge with default SkateHive tags
 *   - image_url?: string    publicly hosted JPEG (required if no video_url)
 *   - video_url?: string    publicly hosted MP4 for Reels (optional)
 *   - permalink_url: string web URL the user can visit on skatehive.app
 */
export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: "Server is missing Supabase config." }, { status: 500 });
  }
  if (!isInstagramConfigured()) {
    return NextResponse.json(
      { error: "Instagram cross-posting is not configured on the server." },
      { status: 503 }
    );
  }

  const userId = await resolveUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Trusted-user gate: must have a linked Hive identity with >= 100 HP.
  // Lookup runs against the blockchain so it can't be spoofed from the client.
  const { data: hiveIdentities } = await supabase
    .from("userbase_identities")
    .select("handle")
    .eq("user_id", userId)
    .eq("type", "hive")
    .limit(1);
  const linkedHiveHandle = hiveIdentities?.[0]?.handle as string | undefined;
  if (!linkedHiveHandle) {
    return NextResponse.json(
      {
        error:
          "Link a Hive account before cross-posting to Instagram.",
      },
      { status: 403 }
    );
  }
  const hivePower = await getHivePowerForAccount(linkedHiveHandle);
  if (hivePower === null || hivePower < MIN_HIVE_POWER_TO_CROSSPOST) {
    return NextResponse.json(
      {
        error: `Cross-posting to Instagram requires at least ${MIN_HIVE_POWER_TO_CROSSPOST} HP on your linked Hive account.`,
        hive_power: hivePower,
      },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hiveAuthor = typeof body?.hive_author === "string" ? body.hive_author.trim() : "";
  const hivePermlink = typeof body?.hive_permlink === "string" ? body.hive_permlink.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const markdown = typeof body?.body === "string" ? body.body : "";
  const permalinkUrl = typeof body?.permalink_url === "string" ? body.permalink_url.trim() : "";
  const imageUrl = typeof body?.image_url === "string" ? body.image_url.trim() : "";
  const videoUrl = typeof body?.video_url === "string" ? body.video_url.trim() : "";
  const tags: string[] = Array.isArray(body?.tags)
    ? body.tags.filter((t: unknown): t is string => typeof t === "string")
    : [];

  if (!hiveAuthor || !hivePermlink || !permalinkUrl) {
    return NextResponse.json(
      { error: "Missing required fields (hive_author, hive_permlink, permalink_url)." },
      { status: 400 }
    );
  }
  if (!title && !markdown.trim()) {
    return NextResponse.json(
      { error: "Cross-post must have at least a title or body text." },
      { status: 400 }
    );
  }
  if (!imageUrl && !videoUrl) {
    return NextResponse.json(
      { error: "Instagram cross-posts require at least an image_url or video_url." },
      { status: 400 }
    );
  }
  // We only support http(s) hosted media (Meta has to fetch it).
  for (const url of [imageUrl, videoUrl].filter(Boolean)) {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad protocol");
    } catch {
      return NextResponse.json({ error: `Unsupported media URL: ${url}` }, { status: 400 });
    }
  }

  // Dedupe: same (author, permlink) can't be cross-posted twice.
  const { data: existingRows } = await supabase
    .from("userbase_instagram_posts")
    .select("id, status, ig_media_id, ig_permalink")
    .eq("hive_author", hiveAuthor)
    .eq("hive_permlink", hivePermlink)
    .limit(1);
  const existing = existingRows?.[0];
  if (existing && existing.status === "published") {
    return NextResponse.json(
      {
        success: true,
        deduped: true,
        ig_media_id: existing.ig_media_id,
        ig_permalink: existing.ig_permalink,
      },
      { status: 200 }
    );
  }

  // Rate limits (rolling 24h window).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [{ count: userCount }, { count: globalCount }] = await Promise.all([
    supabase
      .from("userbase_instagram_posts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "published")
      .gte("created_at", since),
    supabase
      .from("userbase_instagram_posts")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .gte("created_at", since),
  ]);

  if ((userCount ?? 0) >= PER_USER_24H_LIMIT) {
    return NextResponse.json(
      {
        error: `You've already cross-posted to Instagram in the last 24 hours (limit ${PER_USER_24H_LIMIT}).`,
      },
      { status: 429 }
    );
  }
  if ((globalCount ?? 0) >= GLOBAL_24H_LIMIT) {
    return NextResponse.json(
      {
        error: `SkateHive's Instagram has hit its daily cross-post limit (${GLOBAL_24H_LIMIT}). Try again tomorrow.`,
      },
      { status: 429 }
    );
  }

  const caption = buildInstagramCaption({
    title,
    body: markdown,
    hiveAuthor,
    permalinkUrl,
    extraTags: tags,
  });

  const mediaType: "IMAGE" | "REELS" = videoUrl ? "REELS" : "IMAGE";

  // Insert a queued row first so failures are recorded and dedupe works for retries.
  const { data: queued, error: insertErr } = await supabase
    .from("userbase_instagram_posts")
    .insert({
      user_id: userId,
      hive_author: hiveAuthor,
      hive_permlink: hivePermlink,
      ig_media_type: mediaType,
      caption,
      image_url: imageUrl || null,
      video_url: videoUrl || null,
      status: "queued",
    })
    .select("id")
    .single();

  if (insertErr || !queued) {
    // Most likely the unique index fired because of a race with another request.
    return NextResponse.json(
      { error: insertErr?.message || "Failed to record cross-post." },
      { status: 500 }
    );
  }

  const publishResult = videoUrl
    ? await publishReelToInstagram({ videoUrl, caption, coverUrl: imageUrl || undefined })
    : await publishImageToInstagram({ imageUrl, caption });

  if (!publishResult.success) {
    await supabase
      .from("userbase_instagram_posts")
      .update({ status: "failed", error: publishResult.error })
      .eq("id", queued.id);
    return NextResponse.json({ error: publishResult.error }, { status: 502 });
  }

  await supabase
    .from("userbase_instagram_posts")
    .update({
      status: "published",
      ig_container_id: publishResult.containerId,
      ig_media_id: publishResult.mediaId,
      ig_permalink: publishResult.permalink || null,
      published_at: new Date().toISOString(),
    })
    .eq("id", queued.id);

  return NextResponse.json({
    success: true,
    ig_media_id: publishResult.mediaId,
    ig_permalink: publishResult.permalink || null,
  });
}
