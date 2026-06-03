/**
 * Pick a thumbnail URL for a synced Hive spot. The composer always
 * uploads an image, but pulled-in Hive comments with the `skatespot` tag
 * might have been posted by a different client (3Speak, web app, etc.)
 * with no markdown image — only a video embed. This helper widens the
 * net:
 *
 *   1. Markdown image already extracted by parseSpotBody (preferred)
 *   2. json_metadata.image[0]  — set by most Hive clients
 *   3. json_metadata.thumbnail[0]
 *   4. YouTube thumbnail derived from the first YT URL in the body
 *
 * Returns null when none of those match. The widget knows how to render
 * a no-image fallback in that case.
 */

const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?(?:[^\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

interface ThumbnailInputs {
  /** Already-parsed first image from the markdown body, if any. */
  firstMarkdownImage?: string | null;
  /** Raw body text (so we can scan it for video URLs). */
  body?: string | null;
  /** Raw json_metadata as it came back from Hive (string or object). */
  json_metadata?: unknown;
}

function readMetaArray(meta: unknown, key: string): string | null {
  if (!meta) return null;
  try {
    const parsed = typeof meta === "string" ? JSON.parse(meta) : meta;
    const v = (parsed as Record<string, unknown>)?.[key];
    if (Array.isArray(v) && v.length > 0 && typeof v[0] === "string" && v[0].trim()) {
      return v[0].trim();
    }
  } catch {
    // ignore malformed metadata
  }
  return null;
}

export function pickSpotThumbnail({
  firstMarkdownImage,
  body,
  json_metadata,
}: ThumbnailInputs): string | null {
  if (firstMarkdownImage) return firstMarkdownImage;

  // Most Hive clients (peakd, ecency, 3speak) set `json_metadata.image`
  // to the post's thumbnail list. Try that next.
  const fromMetaImage = readMetaArray(json_metadata, "image");
  if (fromMetaImage) return fromMetaImage;

  const fromMetaThumb = readMetaArray(json_metadata, "thumbnail");
  if (fromMetaThumb) return fromMetaThumb;

  // YouTube thumbnail fallback — works for spots posted as a YouTube link
  // with no other media. hqdefault.jpg is always-available (vs maxres
  // which 404s for older / lower-res uploads).
  if (body) {
    const m = body.match(YOUTUBE_ID_RE);
    if (m?.[1]) {
      return `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`;
    }
  }

  return null;
}
