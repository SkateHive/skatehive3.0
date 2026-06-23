/**
 * Extract an ORDERED list of media (images + videos) from a Hive post body,
 * for building an Instagram carousel. Order follows the document so the
 * carousel reads like the post. Deduped by URL, capped (IG allows 10).
 *
 * Sources scanned:
 *   - markdown images        ![alt](url)         → image (or video if .mp4 etc)
 *   - iframe players         <iframe src="…">     → video (IPFS / video file)
 *   - raw video URLs         https://….mp4        → video
 */

export interface CarouselMediaItem {
  type: "image" | "video";
  url: string;
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;
const isIpfs = (u: string) => /\/ipfs\/[a-z0-9]{40,}/i.test(u) || /\bipfs\./i.test(u);

export function extractPostMedia(body: string, max = 10): CarouselMediaItem[] {
  const found: { pos: number; item: CarouselMediaItem }[] = [];
  const text = body || "";

  // Markdown images (may actually point at a video file).
  const imgRe = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(text))) {
    const url = m[1];
    found.push({ pos: m.index, item: { type: VIDEO_EXT.test(url) ? "video" : "image", url } });
  }

  // Iframe players — IPFS or direct video file srcs.
  const iframeRe = /<iframe[\s\S]*?\bsrc=["']([^"']+)["']/gi;
  while ((m = iframeRe.exec(text))) {
    const url = m[1];
    if (isIpfs(url) || VIDEO_EXT.test(url)) {
      found.push({ pos: m.index, item: { type: "video", url } });
    }
  }

  // Raw video URLs not wrapped in markdown/iframes.
  const rawVidRe = /https?:\/\/[^\s"'<>)]+\.(?:mp4|webm|mov|m4v)[^\s"'<>)]*/gi;
  while ((m = rawVidRe.exec(text))) {
    found.push({ pos: m.index, item: { type: "video", url: m[0] } });
  }

  const seen = new Set<string>();
  return found
    .sort((a, b) => a.pos - b.pos)
    .filter((f) => {
      if (seen.has(f.item.url)) return false;
      seen.add(f.item.url);
      return true;
    })
    .slice(0, max)
    .map((f) => f.item);
}
