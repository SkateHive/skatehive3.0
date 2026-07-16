import { extractImageUrls, extractYoutubeLinks } from "./extractImageUrls";
import { parseJsonMetadata } from "@/lib/hive/metadata-utils";

type PostLike = { body?: string; json_metadata?: unknown };

/**
 * Normalise json_metadata.image into a flat string array.
 * Shared by extractPostThumbnail and PostCard's mediaData.
 */
export function normalizeMetadataImages(jsonMetadata: unknown): string[] {
  const metadata = parseJsonMetadata(jsonMetadata);
  const metaImg = metadata?.image;
  if (!metaImg) return [];
  const arr: unknown[] = Array.isArray(metaImg) ? metaImg : [metaImg];
  return arr.filter((i): i is string => typeof i === "string" && i.length > 0);
}

/**
 * Returns the first representative thumbnail URL for a post.
 * Priority: markdown images → json_metadata images → YouTube thumbnail → null.
 * Does NOT fall back to the author avatar — callers decide their own fallback.
 */
export function extractPostThumbnail(post: PostLike): string | null {
  const body = post.body ?? "";
  const markdownImages = extractImageUrls(body);
  if (markdownImages.length > 0) return markdownImages[0];
  const metadataImages = normalizeMetadataImages(post.json_metadata);
  if (metadataImages.length > 0) return metadataImages[0];
  const ytLinks = extractYoutubeLinks(body);
  if (ytLinks.length > 0) return ytLinks[0].thumbnail ?? null;
  return null;
}
