/**
 * Extract the first image URL from a markdown or plain-text description.
 */
export function extractFirstImage(description: string): string | null {
  // Match markdown image: ![alt](url)
  const mdMatch = description.match(/!\[[^\]]*\]\(([^)]+)\)/);
  if (mdMatch) return mdMatch[1];
  // Match bare http image URLs ending in image extension
  const urlMatch = description.match(/https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg)(\?\S*)?/i);
  if (urlMatch) return urlMatch[0];
  return null;
}

/**
 * Safely convert a createdAt field that may be ISO string or unix seconds
 * to a consistent unix-seconds number.
 */
export function toUnixSeconds(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (!isNaN(ms)) return Math.floor(ms / 1000);
  }
  return 0;
}
