/**
 * Poster frame for a video snap.
 *
 * The transcoder returns `thumbnailUrl` on `/transcode` when it uploaded a
 * frame (SkateHive/video-transcoder#2). The field is optional: older workers
 * omit it, and callers then keep the previous behaviour. A cover the author
 * captured wins over the generated frame.
 *
 * `json_metadata.thumbnail` is what this app's OG card and post banner read.
 * Mobile and other Hive clients read `images` / `image`. A video-only snap
 * otherwise goes out with `images: []` and no poster.
 */

const POSTER_URL_MAX_LENGTH = 2048;

/** Absolute http(s) poster URL, or undefined when the value is missing or unsafe. */
export function readPosterUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > POSTER_URL_MAX_LENGTH) return undefined;
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Poster to keep for a snap.
 * An already-captured durable cover wins. Otherwise the optional transcoder frame.
 * Local blob URLs are ignored — they cannot be stored in on-chain metadata.
 */
export function selectSnapPoster(
  capturedPoster: string | null | undefined,
  transcoderThumbnail: string | null | undefined,
): string | null {
  return readPosterUrl(capturedPoster) ?? readPosterUrl(transcoderThumbnail) ?? null;
}

export interface SnapPosterMetadata {
  images?: string[];
  image?: string[];
  thumbnail?: string[];
}

/**
 * Persist a video poster on snap metadata.
 * No-ops when there is no video or no durable poster URL.
 */
export function applyVideoPoster<T extends SnapPosterMetadata>(
  metadata: T,
  videoUrl: string | null | undefined,
  posterUrl: string | null | undefined,
): T {
  const poster = readPosterUrl(posterUrl);
  if (!videoUrl || !poster) return metadata;

  metadata.thumbnail = [poster];

  // Photo snaps already have their own images. A video-only snap has an empty
  // list, which is what leaves every other client with nothing to show.
  if (!metadata.images || metadata.images.length === 0) {
    metadata.images = [poster];
    metadata.image = [poster];
  }

  return metadata;
}
