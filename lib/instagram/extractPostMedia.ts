/**
 * Extract an ORDERED list of media (images + videos) from a Hive post body,
 * for building an Instagram carousel. Order follows the document so the
 * carousel reads like the post. Deduped by URL, capped (IG allows 10).
 *
 * Sources scanned:
 *   - markdown images        ![alt](url)              → image (or video if .mp4)
 *   - raw image URLs         https://….jpg / ?…=x.jpg → image (skatehive embeds
 *                            IPFS photos as bare URLs, ext often in the query)
 *   - iframe players         <iframe src="…">          → video (IPFS / video file)
 *   - raw video URLs         https://….mp4             → video
 *
 * YouTube/Vimeo embeds are intentionally NOT collected — Instagram can't put a
 * third-party video link in a carousel. A YouTube post with hosted photos still
 * qualifies via its images.
 */

export interface CarouselMediaItem {
  type: "image" | "video";
  url: string;
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
// Image extension anywhere in the URL — covers `…/photo.jpg` and skatehive's
// extensionless IPFS form `…/ipfs/<cid>?filename=skatehive.jpg`.
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)\b/i;
const isIpfs = (u: string) => /\/ipfs\/[a-z0-9]{40,}/i.test(u) || /\bipfs\./i.test(u);

/** Dedupe key: same media referenced with different query strings / trailing
 *  slashes (e.g. `…/video.mp4?autoplay=1` vs `…/video.mp4`) collapses to one. */
const normKey = (u: string) => u.split(/[?#]/)[0].replace(/\/+$/, "");

interface RawHit {
  pos: number;
  type: "image" | "video";
  url: string;
  /** True only for a markdown `![](…)` image element — a strong "this is an
   *  image" signal that overrides an ambiguous iframe/IPFS video guess. */
  mdImage: boolean;
}

export function extractPostMedia(body: string, max = 10): CarouselMediaItem[] {
  const hits: RawHit[] = [];
  const text = body || "";
  let m: RegExpExecArray | null;

  // Markdown images (may actually point at a video file).
  const imgRe = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
  while ((m = imgRe.exec(text))) {
    const url = m[1];
    const isVid = VIDEO_EXT.test(url);
    hits.push({ pos: m.index, type: isVid ? "video" : "image", url, mdImage: !isVid });
  }

  // Raw image URLs (not wrapped in markdown) — skatehive embeds IPFS photos as
  // bare URLs, and the extension is often in the query (?filename=…jpg).
  const rawImgRe = /https?:\/\/[^\s"'<>)\]]+/gi;
  while ((m = rawImgRe.exec(text))) {
    const url = m[0];
    if (IMAGE_EXT.test(url) && !VIDEO_EXT.test(url)) {
      hits.push({ pos: m.index, type: "image", url, mdImage: true });
    }
  }

  // Iframe players — IPFS or direct video file srcs (assumed video by convention).
  const iframeRe = /<iframe[\s\S]*?\bsrc=["']([^"']+)["']/gi;
  while ((m = iframeRe.exec(text))) {
    const url = m[1];
    if (isIpfs(url) || VIDEO_EXT.test(url)) {
      hits.push({ pos: m.index, type: "video", url, mdImage: false });
    }
  }

  // Raw video URLs not wrapped in markdown/iframes.
  const rawVidRe = /https?:\/\/[^\s"'<>)]+\.(?:mp4|webm|mov|m4v)[^\s"'<>)]*/gi;
  while ((m = rawVidRe.exec(text))) {
    hits.push({ pos: m.index, type: "video", url: m[0], mdImage: false });
  }

  // Group by normalized key: earliest position wins the slot + canonical URL,
  // but a markdown-image hit forces the type to "image" (so an asset embedded
  // both as ![](…) and inside an <iframe> isn't published as a broken video).
  const groups = new Map<string, RawHit>();
  for (const hit of hits.sort((a, b) => a.pos - b.pos)) {
    const key = normKey(hit.url);
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { ...hit });
    } else if (hit.mdImage && !existing.mdImage) {
      existing.type = "image";
      existing.mdImage = true;
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => a.pos - b.pos)
    .slice(0, max)
    .map(({ type, url }) => ({ type, url }));
}
