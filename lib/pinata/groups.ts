/**
 * Pinata group IDs for organizing Skatehive uploads by content type.
 *
 * Groups are created once via:  npx tsx scripts/setup-pinata-groups.ts
 * Then stored as env vars:      PINATA_GROUP_VIDEOS, PINATA_GROUP_IMAGES, PINATA_GROUP_AVATARS
 *
 * If env vars are not set, uploads still work — files just won't be in a group.
 */

export const PINATA_GROUPS = {
  videos: process.env.PINATA_GROUP_VIDEOS ?? null,
  images: process.env.PINATA_GROUP_IMAGES ?? null,
  avatars: process.env.PINATA_GROUP_AVATARS ?? null,
} as const;

/**
 * Resolve the correct group ID for a given MIME type.
 * Returns null if the relevant group env var isn't configured.
 */
export function groupIdForMimeType(mimeType: string): string | null {
  if (mimeType.startsWith('video/')) return PINATA_GROUPS.videos;
  if (mimeType.startsWith('image/')) return PINATA_GROUPS.images;
  // Anything else (audio, binary) goes to images group as a fallback
  return PINATA_GROUPS.images;
}
