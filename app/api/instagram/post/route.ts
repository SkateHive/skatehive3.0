import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { PublicKey, Signature, cryptoUtils } from "@hiveio/dhive";
import {
  isInstagramConfigured,
  publishImageToInstagram,
  publishReelToInstagram,
} from "@/lib/instagram/graph";
import { buildInstagramCaption } from "@/lib/instagram/caption";
import { getHivePowerForAccount } from "@/lib/hive/serverHivePower";
import { resolveIgHandleForCaption } from "@/lib/instagram/resolveIgHandle";
import fetchAccount from "@/lib/hive/fetchAccount";

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

/** Meta rejects collaborator invites for private/blocked/ineligible accounts
 *  ("User not visible" etc.). That's optional, so we retry without it rather
 *  than fail the whole cross-post. */
function isCollaboratorVisibilityError(error: string | undefined) {
  return /user not visible|collaborator|invite/i.test(error || "");
}

// Per-user 24h cap. No app-level global cap — Meta enforces its own
// 25/account/24h ceiling, and surfacing that error organically is fine.
const PER_USER_24H_LIMIT = 7;

// Trusted-user gate: cross-posting publishes to the shared @skatehive IG, so
// only Hive accounts with enough stake are allowed. Matches the threshold used
// elsewhere in the app (SnapComposer's video-length bypass).
const MIN_HIVE_POWER_TO_CROSSPOST = 100;

async function resolveSessionUserId(request: NextRequest): Promise<string | null> {
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

/** The exact string the client must sign with their Hive posting key. */
function buildIgAuthMessage(args: {
  hiveAuthor: string;
  hivePermlink: string;
  issuedAt: string;
}) {
  return [
    "Skatehive: cross-post snap to @skatehive on Instagram.",
    `Author: @${args.hiveAuthor}`,
    `Permlink: ${args.hivePermlink}`,
    `Issued at: ${args.issuedAt}`,
  ].join("\n");
}

function parseSignature(signature: string) {
  let normalized = signature.trim().toLowerCase();
  if (normalized.startsWith("0x")) normalized = normalized.slice(2);
  if (!/^[0-9a-f]+$/.test(normalized)) return null;
  const buffer = Buffer.from(normalized, "hex");
  if (buffer.length === 65) return Signature.fromBuffer(buffer);
  if (buffer.length === 64) return new Signature(buffer, 0);
  return null;
}

/**
 * Auth path for Keychain-only users: client signs an explicit IG-cross-post
 * message with their Hive posting key. Server verifies signature + key
 * authorization against the on-chain account, then resolves user_id via the
 * matching linked Hive identity. Returns the resolved user_id, or an error.
 *
 * Note: the signed message includes the EXACT (author, permlink) being
 * crossposted, so a leaked signature can't be replayed for a different snap.
 * issued_at must be within MAX_SIG_AGE_MS to bound replay window.
 */
const MAX_SIG_AGE_MS = 5 * 60 * 1000;

async function resolveSignatureUserId(payload: {
  hiveAuthor: string;
  hivePermlink: string;
  hiveSignature: string;
  hivePublicKey: string;
  issuedAt: string;
}): Promise<
  | { ok: true; userId: string; handle: string }
  | { ok: false; status: number; error: string }
> {
  if (!supabase) return { ok: false, status: 500, error: "Missing Supabase config." };

  // Replay window
  const issuedTs = Date.parse(payload.issuedAt);
  if (!Number.isFinite(issuedTs)) {
    return { ok: false, status: 400, error: "Invalid issued_at." };
  }
  if (Math.abs(Date.now() - issuedTs) > MAX_SIG_AGE_MS) {
    return { ok: false, status: 401, error: "Signature too old; re-sign and retry." };
  }

  // Verify signature against the exact message
  const message = buildIgAuthMessage({
    hiveAuthor: payload.hiveAuthor,
    hivePermlink: payload.hivePermlink,
    issuedAt: payload.issuedAt,
  });
  const sig = parseSignature(payload.hiveSignature);
  if (!sig) return { ok: false, status: 400, error: "Invalid signature format." };
  try {
    const digest = cryptoUtils.sha256(Buffer.from(message));
    const pubkey = PublicKey.fromString(payload.hivePublicKey);
    if (!pubkey.verify(digest, sig)) {
      return { ok: false, status: 401, error: "Signature does not match message." };
    }
  } catch {
    return { ok: false, status: 400, error: "Failed to verify signature." };
  }

  // Verify the public key is actually authorized for the Hive author's posting
  // role — this is what proves the signer owns the account.
  let account;
  try {
    account = await fetchAccount(payload.hiveAuthor);
  } catch {
    return { ok: false, status: 404, error: "Hive account not found." };
  }
  const postingKeys: string[] =
    account.account.posting?.key_auths?.map((e: any) => e[0]) || [];
  if (!postingKeys.includes(payload.hivePublicKey)) {
    return {
      ok: false,
      status: 403,
      error: "Public key is not authorized to post for this Hive account.",
    };
  }

  // Resolve userbase user_id via the linked Hive identity. We don't auto-
  // create one here — link in Settings first.
  const { data: idRows } = await supabase
    .from("userbase_identities")
    .select("user_id")
    .eq("type", "hive")
    .eq("handle", payload.hiveAuthor)
    .limit(1);
  const userId = idRows?.[0]?.user_id as string | undefined;
  if (!userId) {
    return {
      ok: false,
      status: 403,
      error:
        "Link this Hive account in SkateHive Settings before cross-posting to Instagram.",
    };
  }

  return { ok: true, userId, handle: payload.hiveAuthor };
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hiveAuthor = typeof body?.hive_author === "string" ? body.hive_author.trim() : "";
  const hivePermlink = typeof body?.hive_permlink === "string" ? body.hive_permlink.trim() : "";

  // ── Preview path ────────────────────────────────────────────────────
  // Returns the server-built default caption + resolved IG handle + media
  // so the client review dialog can render and pre-fill its editor. No
  // dedupe block, no insert, no Meta publish. Auth is best-effort (cookie
  // only) — we never force a Keychain signature just to render a preview
  // (the user signs at confirm-time, same as the moderator flow).
  if (body?.preview === true) {
    if (!hiveAuthor || !hivePermlink) {
      return NextResponse.json({ error: "Missing hive_author/hive_permlink." }, { status: 400 });
    }
    const previewUserId = await resolveSessionUserId(request);
    const pTitle = typeof body?.title === "string" ? body.title.trim() : "";
    const pMarkdown = typeof body?.body === "string" ? body.body : "";
    const pPermalink = typeof body?.permalink_url === "string" ? body.permalink_url.trim() : "";
    const pImage = typeof body?.image_url === "string" ? body.image_url.trim() : "";
    const pVideo = typeof body?.video_url === "string" ? body.video_url.trim() : "";
    const pTags: string[] = Array.isArray(body?.tags)
      ? body.tags.filter((t: unknown): t is string => typeof t === "string")
      : [];
    const igHandle = await resolveIgHandleForCaption({ hiveAuthor, userId: previewUserId, supabase });
    const caption = buildInstagramCaption({
      title: pTitle,
      body: pMarkdown,
      hiveAuthor,
      permalinkUrl: pPermalink,
      extraTags: pTags,
      igHandle,
    });
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
      image_url: pImage || null,
      video_url: pVideo || null,
      media_type: pVideo ? "REELS" : "IMAGE",
      ig_handle: igHandle ?? null,
      default_collaborators: igHandle ? [igHandle] : [],
      target_account: "@skatehive",
      dedupe,
    });
  }

  // Auth: prefer the userbase session cookie (email / wallet / Farcaster
  // login). Fall back to a fresh Hive posting-key signature for Keychain-
  // only users who never logged into userbase. Either path must produce a
  // (userId, handle) we can then HP-gate + rate-limit.
  let userId: string | null = await resolveSessionUserId(request);
  let resolvedHandle: string | undefined;

  if (!userId) {
    const sig = typeof body?.hive_signature === "string" ? body.hive_signature : "";
    const pubKey = typeof body?.hive_public_key === "string" ? body.hive_public_key : "";
    const issuedAt = typeof body?.signed_at === "string" ? body.signed_at : "";
    if (sig && pubKey && issuedAt && hiveAuthor && hivePermlink) {
      const sigAuth = await resolveSignatureUserId({
        hiveAuthor,
        hivePermlink,
        hiveSignature: sig,
        hivePublicKey: pubKey,
        issuedAt,
      });
      if (!sigAuth.ok) {
        return NextResponse.json({ error: sigAuth.error }, { status: sigAuth.status });
      }
      userId = sigAuth.userId;
      resolvedHandle = sigAuth.handle;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Trusted-user gate: pull the HP for the Hive handle we resolved auth
  // against. For cookie auth, look up the linked Hive identity; for
  // signature auth we already verified the handle on-chain.
  let hiveHandleForHpCheck = resolvedHandle;
  if (!hiveHandleForHpCheck) {
    const { data: hiveIdentities } = await supabase
      .from("userbase_identities")
      .select("handle")
      .eq("user_id", userId)
      .eq("type", "hive")
      .limit(1);
    hiveHandleForHpCheck = hiveIdentities?.[0]?.handle as string | undefined;
  }
  if (!hiveHandleForHpCheck) {
    return NextResponse.json(
      { error: "Link a Hive account before cross-posting to Instagram." },
      { status: 403 }
    );
  }
  const hivePower = await getHivePowerForAccount(hiveHandleForHpCheck);
  if (hivePower === null || hivePower < MIN_HIVE_POWER_TO_CROSSPOST) {
    return NextResponse.json(
      {
        error: `Cross-posting to Instagram requires at least ${MIN_HIVE_POWER_TO_CROSSPOST} HP on your linked Hive account.`,
        hive_power: hivePower,
      },
      { status: 403 }
    );
  }

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

  // Dedupe / retry: same (author, permlink) is guarded by a UNIQUE index, so
  // we have to detect existing rows BEFORE we'd insert.
  //   - status=published → already done, return cached IDs.
  //   - status=failed    → user gets to retry; we'll UPDATE the row below.
  //   - status=queued + recent (<10 min) → assume an in-flight request, 409.
  //   - status=queued + stale (≥10 min)  → previous attempt died half-way,
  //                                         treat as retryable.
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
      // status=queued and fresh: another request is mid-flight.
      return NextResponse.json(
        { error: "This snap is already being cross-posted. Try again in a minute." },
        { status: 409 }
      );
    }
  }

  // Per-user rate limit (rolling 24h window). No app-level global cap — if
  // we'd exceed Meta's 25/24h account ceiling, the publish call itself will
  // surface that error from graph.instagram.com and the row gets recorded as
  // failed with Meta's message.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: userCount } = await supabase
    .from("userbase_instagram_posts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "published")
    .gte("created_at", since);

  if ((userCount ?? 0) >= PER_USER_24H_LIMIT) {
    return NextResponse.json(
      {
        error: `You've already cross-posted to Instagram ${PER_USER_24H_LIMIT} times in the last 24 hours. Try again later.`,
      },
      { status: 429 }
    );
  }

  const igHandle = await resolveIgHandleForCaption({
    hiveAuthor,
    userId,
    supabase,
  });

  // Caption: honor a user-edited override from the review dialog, else build
  // the default server-side. Always clamp to IG's 2200-char ceiling.
  const captionOverride = typeof body?.caption === "string" ? body.caption.trim() : "";
  const caption = captionOverride
    ? captionOverride.slice(0, 2200)
    : buildInstagramCaption({
        title,
        body: markdown,
        hiveAuthor,
        permalinkUrl,
        extraTags: tags,
        igHandle,
      });

  // Collaborators: honor an explicit list from the dialog, else default to
  // just the mapped author. graph.ts sanitizes + caps at 3.
  const collaborators: string[] | undefined = Array.isArray(body?.collaborators)
    ? body.collaborators.filter((c: unknown): c is string => typeof c === "string")
    : igHandle
    ? [igHandle]
    : undefined;

  const mediaType: "IMAGE" | "REELS" = videoUrl ? "REELS" : "IMAGE";

  // Insert (or update, on retry) a row in queued state so failures are
  // recorded and dedupe works on subsequent attempts.
  let queuedId: string;
  if (existingRetryableId) {
    const { data: updated, error: updateErr } = await supabase
      .from("userbase_instagram_posts")
      .update({
        user_id: userId,
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
    queuedId = queued.id as string;
  }

  // `collaborators` resolved above (dialog override or mapped author). Each
  // gets an IG Collab invite so the post can also land on their own feed.
  // If Meta rejects a collaborator (private/ineligible account), retry once
  // without invites rather than failing the whole cross-post.
  let publishResult = videoUrl
    ? await publishReelToInstagram({ videoUrl, caption, coverUrl: imageUrl || undefined, collaborators })
    : await publishImageToInstagram({ imageUrl, caption, collaborators });
  let collaboratorRetryError: string | null = null;
  if (
    !publishResult.success &&
    collaborators &&
    collaborators.length > 0 &&
    isCollaboratorVisibilityError(publishResult.error)
  ) {
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
  });
}
