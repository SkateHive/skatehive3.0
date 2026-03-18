import { APP_CONFIG } from "@/config/app.config";

/**
 * Centralized image optimization pipeline.
 *
 * Strategy:
 *  - Hive-hosted images → use images.hive.blog proxy with explicit dimensions
 *  - IPFS images → resolve through skatehive gateway, then proxy via Hive for resize
 *  - External images → proxy via Hive image service for resize + WebP
 *  - GIFs → pass through unmodified (Hive proxy strips animation)
 */

// Standard dimension presets
export const IMAGE_SIZES = {
  /** Feed card thumbnails */
  FEED_CARD: { w: 640, h: 360 },
  /** Sidebar post thumbnails */
  SIDEBAR_THUMB: { w: 320, h: 180 },
  /** Full-width hero / post images */
  HERO: { w: 1280, h: 720 },
  /** Markdown inline images in feed */
  INLINE: { w: 768, h: 0 },
  /** Avatar small */
  AVATAR_SM: { w: 64, h: 64 },
  /** Avatar large */
  AVATAR_LG: { w: 128, h: 128 },
} as const;

const HIVE_PROXY = "https://images.hive.blog";
const IPFS_GATEWAY = APP_CONFIG.IPFS_GATEWAY;

/**
 * Check if a URL points to an animated GIF (which shouldn't be proxied
 * through Hive since the proxy strips animation frames).
 */
function isAnimatedGif(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.endsWith(".gif") ||
    lower.includes(".gif?") ||
    lower.includes("giphy.com") ||
    lower.includes("tenor.com")
  );
}

/**
 * Extract IPFS CID from any IPFS gateway URL.
 */
function extractIpfsCid(url: string): string | null {
  const m = url.match(/\/ipfs\/([a-zA-Z0-9]{46,})/);
  return m ? m[1] : null;
}

/**
 * Resolve an IPFS URL to the skatehive gateway.
 */
export function ipfsGatewayUrl(cidOrUrl: string): string {
  const cid = extractIpfsCid(cidOrUrl) || cidOrUrl;
  return `https://${IPFS_GATEWAY}/ipfs/${cid}`;
}

/**
 * Proxy any image through the Hive image service with explicit dimensions.
 *
 * The Hive proxy (`images.hive.blog/{W}x{H}/{url}`) resizes on the edge,
 * converts to WebP when the client supports it, and caches aggressively.
 *
 * @param src  Original image URL (IPFS, external CDN, etc.)
 * @param w    Target width  (0 = auto / keep aspect ratio)
 * @param h    Target height (0 = auto / keep aspect ratio)
 */
export function optimizeImageUrl(
  src: string,
  w: number = IMAGE_SIZES.INLINE.w,
  h: number = 0
): string {
  if (!src) return src;

  // Skip GIFs — Hive proxy strips animation
  if (isAnimatedGif(src)) return src;

  // Skip data URIs and SVGs
  if (src.startsWith("data:") || src.endsWith(".svg")) return src;

  // Already proxied through Hive — update dimensions only if using 0x0
  if (src.includes("images.hive.blog")) {
    return src.replace(/images\.hive\.blog\/\d+x\d+\//, `images.hive.blog/${w}x${h}/`);
  }

  // Resolve IPFS to gateway first
  const cid = extractIpfsCid(src);
  const resolvedSrc = cid ? ipfsGatewayUrl(cid) : src;

  // Proxy through Hive image service
  return `${HIVE_PROXY}/${w}x${h}/${resolvedSrc}`;
}

/**
 * Optimize a Hive avatar URL with proper dimensions.
 */
export function optimizeAvatarUrl(
  username: string,
  size: "sm" | "md" | "lg" = "sm"
): string {
  const sizeMap = { sm: "small", md: "medium", lg: "large" };
  return `${HIVE_PROXY}/u/${username}/avatar/${sizeMap[size]}`;
}

/**
 * Optimize a post thumbnail URL.
 * Extracts the first image from metadata or body and proxies it.
 */
export function optimizeThumbnailUrl(
  src: string,
  preset: keyof typeof IMAGE_SIZES = "SIDEBAR_THUMB"
): string {
  const { w, h } = IMAGE_SIZES[preset];
  return optimizeImageUrl(src, w, h);
}
