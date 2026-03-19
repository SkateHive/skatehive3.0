import { APP_CONFIG } from "@/config/app.config";

/**
 * Centralized image optimization pipeline.
 *
 * Strategy:
 *  - IPFS images → serve from ipfs.skatehive.app with Pinata img-* query params
 *    (resize, WebP conversion, quality — no Hive proxy middleman)
 *  - Hive-hosted images → use images.hive.blog proxy with explicit dimensions
 *  - External images → proxy via Hive image service for resize + WebP
 *  - GIFs → pass through unmodified (proxies strip animation)
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
 * Check if a URL points to an animated GIF.
 * GIFs should not have img-format=webp applied (strips animation).
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
 * Check if a URL is an IPFS resource (any gateway).
 */
function isIpfsUrl(url: string): boolean {
  return (
    url.includes("/ipfs/") ||
    url.includes("ipfs.skatehive") ||
    url.includes("gateway.pinata.cloud") ||
    url.includes("ipfs.io")
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
 * Resolve an IPFS URL to the skatehive gateway (no optimization params).
 */
export function ipfsGatewayUrl(cidOrUrl: string): string {
  const cid = extractIpfsCid(cidOrUrl) || cidOrUrl;
  return `https://${IPFS_GATEWAY}/ipfs/${cid}`;
}

/**
 * Build a Pinata gateway URL with image optimization query params.
 *
 * Pinata serves img-* transformations natively on the gateway edge —
 * no need to route through the Hive image proxy.
 *
 * @param cid  IPFS CID
 * @param w    Target width  (0 = no constraint)
 * @param h    Target height (0 = no constraint)
 */
function pinataOptimizedUrl(cid: string, w: number, h: number): string {
  const params = new URLSearchParams();
  if (w > 0) params.set('img-width', String(w));
  if (h > 0) params.set('img-height', String(h));
  // Use cover when both dimensions are specified; scale-down when only width
  params.set('img-fit', h > 0 ? 'cover' : 'scale-down');
  params.set('img-format', 'webp');
  params.set('img-quality', '75');
  // Fall back to original image if optimization fails (e.g. non-image CID)
  params.set('img-onerror', 'redirect');
  return `https://${IPFS_GATEWAY}/ipfs/${cid}?${params.toString()}`;
}

/**
 * Optimize an image URL with explicit dimensions.
 *
 * - IPFS images: Pinata img-* params (native edge optimization, no proxy middleman)
 * - Hive-hosted images: update Hive proxy dimensions
 * - External images: proxy via Hive image service
 *
 * @param src  Original image URL
 * @param w    Target width  (0 = auto)
 * @param h    Target height (0 = auto)
 */
export function optimizeImageUrl(
  src: string,
  w: number = IMAGE_SIZES.INLINE.w,
  h: number = 0
): string {
  if (!src) return src;

  // GIFs — pass through unmodified (optimization strips animation)
  if (isAnimatedGif(src)) return src;

  // Data URIs and SVGs — pass through
  if (src.startsWith("data:") || src.endsWith(".svg")) return src;

  // IPFS images — use Pinata's native img-* optimization params
  if (isIpfsUrl(src)) {
    const cid = extractIpfsCid(src);
    if (!cid) return src;
    return pinataOptimizedUrl(cid, w, h);
  }

  // Already proxied through Hive — update dimensions
  if (src.includes("images.hive.blog")) {
    return src.replace(/images\.hive\.blog\/\d+x\d+\//, `images.hive.blog/${w}x${h}/`);
  }

  // External images — proxy through Hive image service for resize + WebP
  return `${HIVE_PROXY}/${w}x${h}/${src}`;
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
