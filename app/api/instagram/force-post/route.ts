import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isInstagramConfigured,
  publishImageToInstagram,
  publishReelToInstagram,
} from "@/lib/instagram/graph";
import { buildInstagramCaption } from "@/lib/instagram/caption";
import { resolveIgHandleForCaption } from "@/lib/instagram/resolveIgHandle";
import { isServerSideAdmin, logSecurityAttempt } from "@/lib/server/adminUtils";
import {
  resolveSessionUserId,
  verifyHivePostingSignature,
} from "@/lib/instagram/requesterAuth";

/**
 * POST /api/instagram/force-post
 *
 * Moderator override for Instagram cross-posting. Unlike /api/instagram/post
 * (where the requester IS the author and must clear the HP gate + per-user
 * cap), this route lets an allowlisted SkateHive admin force-publish ANY
 * snap to the shared @skatehive IG account — used to surface good content
 * from authors who don't yet meet the self-serve criteria.
 *
 * The authenticated requester is the MODERATOR; `hive_author`/`hive_permlink`
 * are the TARGET snap (kept for caption attribution + dedupe). The author HP
 * gate and per-user 24h cap are bypassed; Meta's own 25/account/24h ceiling
 * and the (author, permlink) dedupe still apply.
 *
 * Body:
 *   - hive_author / hive_permlink : the target snap (required)
 *   - title? / body              : caption source
 *   - tags?                      : extra hashtags
 *   - image_url? / video_url?    : publicly hosted media (≥1 required)
 *   - permalink_url              : skatehive.app URL (required)
 *   - requester?, hive_signature?, hive_public_key?, signed_at? : Keychain
 *       moderator auth (only needed when there's no userbase session cookie)
 *   - preview?: boolean          : if true, skip dedupe/DB/Meta and just
 *       return the rendered caption + media for client-side preview UI.
 *       Cookie auth still required, but no Hive signature is requested
 *       (the moderator only signs at actual-post confirm time, so a
 *       leaked signature can't be replayed after the 5-min window).
 */

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const MAX_SIG_AGE_MS = 5 * 60 * 1000;

/** Exact message a Keychain moderator must sign — bound to moderator + target
 *  so a leaked signature can't be replayed for a different snap or by someone
 *  else. */
function buildForceAuthMessage(args: {
  moderator: string;
  hiveAuthor: string;
  hivePermlink: string;
  issuedAt: string;
}): string {
  return [
    "Skatehive: FORCE cross-post snap to @skatehive on Instagram.",
    `Moderator: @${args.moderator}`,
    `Target: @${args.hiveAuthor}/${args.hivePermlink}`,
    `Issued at: ${args.issuedAt}`,
  ].join("\n");
}

async function linkedHiveHandle(userId: string): Promise<string | null> {
  const { data } = await supabase!
    .from("userbase_identities")
    .select("handle")
    .eq("user_id", userId)
    .eq("type", "hive")
    .limit(1);
  return (data?.[0]?.handle as string | undefined) ?? null;
}

async function userIdForHiveHandle(handle: string): Promise<string | null> {
  const { data } = await supabase!
    .from("userbase_identities")
    .select("user_id")
    .eq("type", "hive")
    .eq("handle", handle)
    .limit(1);
  return (data?.[0]?.user_id as string | undefined) ?? null;
}

function isCollaboratorVisibilityError(error: string | undefined) {
  return /user not visible|collaborator|invite/i.test(error || "");
}

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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hiveAuthor = typeof body?.hive_author === "string" ? body.hive_author.trim() : "";
  const hivePermlink = typeof body?.hive_permlink === "string" ? body.hive_permlink.trim() : "";
  const isPreview = body?.preview === true;

  // --- Resolve + authorize the MODERATOR (the requester), independent of the
  // snap's author. Prefer the userbase session cookie; fall back to a fresh
  // Hive posting-key signature for Keychain-only moderators.
  //
  // Preview path: signature auth isn't required (the signed force-post
  // message is bound to issued_at + 5-min replay window — we only want it
  // at confirm time, not when the preview modal opens). For Keychain-only
  // moderators in preview mode we accept just the `requester` handle and
  // re-verify allowlist below. ---
  let moderatorHandle: string | null = null;
  let moderatorUserId: string | null = null;

  const sessionUserId = await resolveSessionUserId(request, supabase);
  if (sessionUserId) {
    moderatorUserId = sessionUserId;
    moderatorHandle = await linkedHiveHandle(sessionUserId);
  } else if (isPreview) {
    const requester = typeof body?.requester === "string" ? body.requester.trim() : "";
    if (!requester) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    moderatorHandle = requester;
    moderatorUserId = await userIdForHiveHandle(requester);
  } else {
    const requester = typeof body?.requester === "string" ? body.requester.trim() : "";
    const sig = typeof body?.hive_signature === "string" ? body.hive_signature : "";
    const pubKey = typeof body?.hive_public_key === "string" ? body.hive_public_key : "";
    const issuedAt = typeof body?.signed_at === "string" ? body.signed_at : "";

    if (!requester || !sig || !pubKey || !issuedAt || !hiveAuthor || !hivePermlink) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const issuedTs = Date.parse(issuedAt);
    if (!Number.isFinite(issuedTs) || Math.abs(Date.now() - issuedTs) > MAX_SIG_AGE_MS) {
      return NextResponse.json({ error: "Signature too old; re-sign and retry." }, { status: 401 });
    }

    const message = buildForceAuthMessage({ moderator: requester, hiveAuthor, hivePermlink, issuedAt });
    const verify = await verifyHivePostingSignature({
      message,
      signature: sig,
      publicKey: pubKey,
      hiveAccount: requester,
    });
    if (!verify.ok) {
      return NextResponse.json({ error: verify.error }, { status: verify.status });
    }
    moderatorHandle = requester;
    moderatorUserId = await userIdForHiveHandle(requester); // may be null (Keychain-only)
  }

  // --- Allowlist gate (server-authoritative — the menu visibility is cosmetic). ---
  if (!moderatorHandle || !isServerSideAdmin(moderatorHandle)) {
    logSecurityAttempt(moderatorHandle ?? undefined, "instagram force-post", request, false);
    return NextResponse.json(
      { error: "Access Denied: moderator privileges required." },
      { status: 403 }
    );
  }
  logSecurityAttempt(moderatorHandle, "instagram force-post", request, true);

  // --- Validate the target content. ---
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
  if (!imageUrl && !videoUrl) {
    return NextResponse.json(
      { error: "Force cross-post requires an image_url or video_url." },
      { status: 400 }
    );
  }
  for (const url of [imageUrl, videoUrl].filter(Boolean)) {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad protocol");
    } catch {
      return NextResponse.json({ error: `Unsupported media URL: ${url}` }, { status: 400 });
    }
  }

  // --- Dedupe on (author, permlink) — same semantics as the self-serve route. ---
  const { data: existingRows } = await supabase
    .from("userbase_instagram_posts")
    .select("id, status, ig_media_id, ig_permalink, created_at")
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
  let existingRetryableId: string | null = null;
  if (existing) {
    const ageMs = Date.now() - new Date(existing.created_at).getTime();
    if (existing.status === "failed" || (existing.status === "queued" && ageMs > 10 * 60 * 1000)) {
      existingRetryableId = existing.id as string;
    } else {
      return NextResponse.json(
        { error: "This snap is already being cross-posted. Try again in a minute." },
        { status: 409 }
      );
    }
  }

  // --- Caption credits the ORIGINAL author (not the moderator). ---
  const authorUserId = await userIdForHiveHandle(hiveAuthor);
  const igHandle = await resolveIgHandleForCaption({ hiveAuthor, userId: authorUserId, supabase });
  const caption = buildInstagramCaption({
    title,
    body: markdown,
    hiveAuthor,
    permalinkUrl,
    extraTags: tags,
    igHandle,
  });

  const mediaType: "IMAGE" | "REELS" = videoUrl ? "REELS" : "IMAGE";

  // --- Preview path: return everything the client needs to render the
  // dialog (caption text built server-side so the user sees EXACTLY what
  // Meta will receive, plus the resolved IG handle and media URLs). No
  // Meta calls, no row inserts, no dedupe. ---
  if (isPreview) {
    // Surface a non-blocking "already published" warning so the preview
    // can show "this snap is already on @skatehive". We don't 200 here
    // because the moderator may want to see what the second attempt's
    // caption would look like.
    const { data: dedupeRows } = await supabase
      .from("userbase_instagram_posts")
      .select("status, ig_permalink")
      .eq("hive_author", hiveAuthor)
      .eq("hive_permlink", hivePermlink)
      .limit(1);
    const dedupe = dedupeRows?.[0]
      ? {
          status: dedupeRows[0].status as string,
          ig_permalink: (dedupeRows[0].ig_permalink as string | null) ?? null,
        }
      : null;

    return NextResponse.json({
      success: true,
      preview: true,
      caption,
      image_url: imageUrl || null,
      video_url: videoUrl || null,
      media_type: mediaType,
      ig_handle: igHandle ?? null,
      target_account: "@skatehive",
      moderator: moderatorHandle,
      dedupe,
    });
  }

  // user_id records WHO triggered the cross-post — here, the moderator.
  // hive_author keeps the original author for attribution + dedupe.
  let queuedId: string;
  if (existingRetryableId) {
    const { data: updated, error: updateErr } = await supabase
      .from("userbase_instagram_posts")
      .update({
        user_id: moderatorUserId,
        ig_media_type: mediaType,
        caption,
        image_url: imageUrl || null,
        video_url: videoUrl || null,
        status: "queued",
        error: null,
        ig_container_id: null,
        ig_media_id: null,
        ig_permalink: null,
        published_at: null,
      })
      .eq("id", existingRetryableId)
      .select("id")
      .single();
    if (updateErr || !updated) {
      return NextResponse.json(
        { error: updateErr?.message || "Failed to re-queue cross-post." },
        { status: 500 }
      );
    }
    queuedId = updated.id as string;
  } else {
    const { data: queued, error: insertErr } = await supabase
      .from("userbase_instagram_posts")
      .insert({
        user_id: moderatorUserId,
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
      return NextResponse.json(
        { error: insertErr?.message || "Failed to record cross-post." },
        { status: 500 }
      );
    }
    queuedId = queued.id as string;
  }

  // Invite the original author (mapped skater) as an IG collaborator so the
  // cross-post also lands on their own feed (they get an invite to accept).
  // Meta rejects some valid-looking usernames as "User not visible" when the
  // account is private, blocked, too new, or not eligible for Collab. That
  // should not block SkateHive from posting the clip, so retry without the
  // optional collaborator invite on collaborator-specific failures.
  const collaborators = igHandle ? [igHandle] : undefined;
  let publishResult = videoUrl
    ? await publishReelToInstagram({ videoUrl, caption, coverUrl: imageUrl || undefined, collaborators })
    : await publishImageToInstagram({ imageUrl, caption, collaborators });
  let collaboratorRetryError: string | null = null;

  if (!publishResult.success && collaborators && isCollaboratorVisibilityError(publishResult.error)) {
    collaboratorRetryError = publishResult.error;
    publishResult = videoUrl
      ? await publishReelToInstagram({ videoUrl, caption, coverUrl: imageUrl || undefined })
      : await publishImageToInstagram({ imageUrl, caption });
  }

  if (!publishResult.success) {
    const error = collaboratorRetryError
      ? `${publishResult.error} (also retried without collaborator after: ${collaboratorRetryError})`
      : publishResult.error;
    await supabase
      .from("userbase_instagram_posts")
      .update({ status: "failed", error })
      .eq("id", queuedId);
    return NextResponse.json({ error }, { status: 502 });
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
    .eq("id", queuedId);

  return NextResponse.json({
    success: true,
    ig_media_id: publishResult.mediaId,
    ig_permalink: publishResult.permalink || null,
    forced_by: moderatorHandle,
  });
}
