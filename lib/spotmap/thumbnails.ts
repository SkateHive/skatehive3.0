/**
 * Applies the thumbnail override/fallback rules shared by the spotmap read
 * routes (list + single). Sync jobs never write thumbnail_override or
 * thumbnail_small, so this is the only place the effective values are
 * computed — from here on, `thumbnail` in an API response means "the
 * widget-safe, admin-overridable image", not the raw source URL.
 */
export function effectiveThumbnail<
  T extends { thumbnail?: string | null; thumbnail_override?: string | null }
>(row: T): string | null {
  return row.thumbnail_override ?? row.thumbnail ?? null;
}

export function withEffectiveThumbnails<
  T extends {
    thumbnail?: string | null;
    thumbnail_override?: string | null;
    thumbnail_small?: string | null;
  }
>(row: T): T & { thumbnail: string | null; thumbnail_small: string | null } {
  const thumbnail = effectiveThumbnail(row);
  return {
    ...row,
    thumbnail,
    thumbnail_small: row.thumbnail_small ?? thumbnail,
  };
}

// Hosts an admin-set thumbnail_override is allowed to point at: the CDNs the
// sync jobs already pull source thumbnails from (images.hive.blog,
// files.peakd.com, Google My Maps' hosted images/profile photos) plus our own
// Pinata gateway, which is where the admin UI's upload button lands new
// images. Keeps an admin (or a compromised admin session) from turning this
// field into an open URL-redirect / SSRF-ish pointer at an arbitrary host.
export const SPOTMAP_IMAGE_HOSTS = [
  "images.hive.blog",
  "files.peakd.com",
  "mymaps.usercontent.google.com",
  "lh3.googleusercontent.com",
  "ipfs.skatehive.app",
];

const MAX_THUMBNAIL_OVERRIDE_LENGTH = 2048;

export type ThumbnailOverrideValidation =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Validates a thumbnail_override value from an admin request body. `null`
 * clears the override; any other value must be an https URL under
 * MAX_THUMBNAIL_OVERRIDE_LENGTH chars, host in SPOTMAP_IMAGE_HOSTS.
 */
export function validateThumbnailOverride(raw: unknown): ThumbnailOverrideValidation {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, error: "thumbnail_override must be a non-empty string or null" };
  }
  if (raw.length > MAX_THUMBNAIL_OVERRIDE_LENGTH) {
    return { ok: false, error: "thumbnail_override is too long" };
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "thumbnail_override must be a valid URL" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, error: "thumbnail_override must use https" };
  }
  if (!SPOTMAP_IMAGE_HOSTS.includes(url.hostname)) {
    return {
      ok: false,
      error: `thumbnail_override host must be one of: ${SPOTMAP_IMAGE_HOSTS.join(", ")}`,
    };
  }
  return { ok: true, value: raw };
}
