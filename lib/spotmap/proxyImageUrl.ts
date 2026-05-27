// Google domains that host images referenced in the Skatehive Google My
// Maps KML feed. Some of these (notably `mymaps.usercontent.google.com`)
// respond with `Cross-Origin-Resource-Policy: same-site`, which the
// browser enforces by refusing to render the image inside an <img> on
// skatehive.app — the carousel and thumbnails come up blank.
//
// To get them onto the page we route them through a same-origin proxy
// (/api/spotmap/image) that fetches the bytes server-side and re-streams
// them. This file is the allowlist used by both ends of the proxy.
export const GOOGLE_IMAGE_HOSTS = new Set<string>([
  "mymaps.usercontent.google.com",
  "lh3.googleusercontent.com",
  "lh4.googleusercontent.com",
  "lh5.googleusercontent.com",
  "lh6.googleusercontent.com",
  "geo0.ggpht.com",
  "geo1.ggpht.com",
  "geo2.ggpht.com",
  "geo3.ggpht.com",
]);

/**
 * If `url` points at a Google-hosted KML image, return the same-origin
 * proxy URL that the browser will accept. Otherwise return it unchanged.
 *
 * Only used for in-page rendering — JSON-LD / OG tags should keep the
 * original Google URL so search engines and social previews resolve it
 * directly from Google (cheaper than serving via our proxy).
 */
export function proxyGoogleImage(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return url;
    if (GOOGLE_IMAGE_HOSTS.has(u.hostname)) {
      return `/api/spotmap/image?u=${encodeURIComponent(url)}`;
    }
  } catch {
    // Malformed URL — return as-is so the browser shows the broken-image
    // marker and the issue is visible to anyone debugging.
  }
  return url;
}
