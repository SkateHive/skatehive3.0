/**
 * Shared helpers for constructing Farcaster cast payloads from a SkateHive
 * snap. Kept in one place so the snap composer and the debug page render
 * the EXACT same output — drift between them would defeat the debug page.
 */

export const CAST_MAX_CHARS = 1024;

/**
 * Build the text body of a cross-posted cast: snap body trimmed to fit
 * the cast char limit, with the SkateHive URL appended on its own line
 * when present.
 */
export function buildSnapCastText(
  body: string,
  url: string | null
): string {
  const clean = body.trim();
  if (!url) {
    return clean.length > CAST_MAX_CHARS
      ? clean.slice(0, CAST_MAX_CHARS - 1).trim() + "…"
      : clean;
  }
  const urlLine = `\n\n${url}`;
  const budget = CAST_MAX_CHARS - urlLine.length;
  const trimmed =
    clean.length > budget
      ? clean.slice(0, Math.max(0, budget - 1)).trim() + "…"
      : clean;
  return trimmed + urlLine;
}

export interface CastEmbed {
  url: string;
}

export interface BuildSnapCastEmbedsInput {
  /** SkateHive post URL — `/post/{author}/{permlink}`. */
  snapUrl: string;
  /** Image URLs already uploaded to IPFS, in caption order. */
  imageUrls: string[];
  /** Direct video URL (IPFS), if the snap has a video. */
  videoUrl: string | null;
}

/**
 * Pick at most 2 embed URLs for a snap cast, mirroring the snap composer's
 * cross-post logic:
 *   - Image snaps:    first 1-2 images (Warpcast renders inline previews).
 *   - Video snaps:    snap URL first (so the frame renders), then videoUrl
 *                     as a hint for clients that support inline video.
 *   - Text-only:      snap URL alone (frame card).
 */
export function buildSnapCastEmbeds({
  snapUrl,
  imageUrls,
  videoUrl,
}: BuildSnapCastEmbedsInput): CastEmbed[] {
  if (imageUrls.length > 0) {
    return imageUrls.slice(0, 2).map((url) => ({ url }));
  }
  if (videoUrl) {
    return [{ url: snapUrl }, { url: videoUrl }];
  }
  return [{ url: snapUrl }];
}
