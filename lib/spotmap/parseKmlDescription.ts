/**
 * Extracts displayable bits out of a Google My Maps KML <description>.
 * Descriptions come back as a mini HTML document containing
 *   <img src="..."> (sometimes several)
 *   text paragraphs / line breaks
 *   the occasional <a href="...">
 *
 * We pull the images and a plain-text summary, and let the page render
 * those separately rather than dumping the raw HTML (which would carry
 * untrusted markup directly into the page).
 */

export interface ParsedKmlDescription {
  images: string[];
  text: string;
  links: string[];
}

const IMG_RE = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
const ANCHOR_RE = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
const TAG_RE = /<[^>]+>/g;

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export function parseKmlDescription(html: string | null | undefined): ParsedKmlDescription {
  const out: ParsedKmlDescription = { images: [], text: "", links: [] };
  if (!html) return out;

  // 1. Collect <img> URLs (deduped)
  for (const m of html.matchAll(IMG_RE)) {
    const url = m[1].trim();
    if (url && !out.images.includes(url)) out.images.push(url);
  }

  // 2. Collect <a> URLs (deduped)
  for (const m of html.matchAll(ANCHOR_RE)) {
    const url = m[1].trim();
    if (url && !out.links.includes(url)) out.links.push(url);
  }

  // 3. Plain-text version of the description
  const stripped = html
    .replace(IMG_RE, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(TAG_RE, "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => decodeEntities(line).trim())
    .filter(Boolean)
    .join("\n");
  out.text = stripped;

  return out;
}
