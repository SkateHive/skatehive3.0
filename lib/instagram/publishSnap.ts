/**
 * Inline Instagram cross-post for the self (user) flow.
 *
 * Extracted from InstagramCrossPostDialog so the unified "prepare & publish"
 * stepper can publish to Instagram directly (no second dialog) right after the
 * Hive post is created — it needs the snap's author/permlink for dedup +
 * attribution. Keychain signing happens here (5-min replay window) when there's
 * no userbase session cookie to authorize against.
 */
import { KeyTypes } from "@aioha/aioha";

const IG_CAPTION_LIMIT = 2200;

export interface PublishSnapToInstagramInput {
  /** Aioha instance from useAioha() — used for Keychain signing. */
  aioha: any;
  /** Active Hive username (signing identity). */
  walletUser: string | null;
  /** Sign with the posting key? False when a userbase session cookie is enough. */
  requireSignature: boolean;
  hiveAuthor: string;
  hivePermlink: string;
  body: string;
  tags: string[];
  imageUrl: string | null;
  videoUrl: string | null;
  permalinkUrl: string;
  caption: string;
  collaborators: string[];
}

export interface PublishSnapResult {
  success: boolean;
  ig_permalink?: string;
  deduped?: boolean;
  error?: string;
}

export async function publishSnapToInstagram(
  input: PublishSnapToInstagramInput
): Promise<PublishSnapResult> {
  const payload: Record<string, unknown> = {
    hive_author: input.hiveAuthor,
    hive_permlink: input.hivePermlink,
    title: "",
    body: input.body,
    tags: input.tags,
    image_url: input.imageUrl,
    video_url: input.videoUrl,
    permalink_url: input.permalinkUrl,
    caption: input.caption.slice(0, IG_CAPTION_LIMIT),
    collaborators: input.collaborators,
  };

  if (input.requireSignature && input.walletUser && input.aioha) {
    const issuedAt = new Date().toISOString();
    const message = [
      "Skatehive: cross-post snap to @skatehive on Instagram.",
      `Author: @${input.hiveAuthor}`,
      `Permlink: ${input.hivePermlink}`,
      `Issued at: ${issuedAt}`,
    ].join("\n");
    const signResult = await input.aioha.signMessage(message, KeyTypes.Posting);
    if (!signResult?.success || !signResult.result || !signResult.publicKey) {
      throw new Error(signResult?.error || "Keychain signature was rejected.");
    }
    payload.requester = input.walletUser;
    payload.hive_signature = signResult.result;
    payload.hive_public_key = signResult.publicKey;
    payload.signed_at = issuedAt;
  }

  const res = await fetch("/api/instagram/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));

  if (res.ok && (data?.success || data?.ig_permalink || data?.deduped)) {
    return { success: true, ig_permalink: data.ig_permalink, deduped: data.deduped };
  }
  return { success: false, error: data?.error || `HTTP ${res.status}` };
}
