/**
 * Caption builder for Instagram cross-posts.
 *
 * IG caption limits: 2200 chars total, max 30 hashtags. URLs in captions are
 * NOT clickable, so we still include the SkateHive permalink as a text reference
 * (people can copy-paste; we also expect bio-link strategy long-term).
 */

const IG_CAPTION_LIMIT = 2200;
const IG_HASHTAG_LIMIT = 30;

const DEFAULT_HASHTAGS = [
  "skatehive",
  "skateboarding",
  "skate",
  "skater",
  "skatelife",
];

function markdownToPlainText(md: string): string {
  return md
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTag(raw: string): string | null {
  const cleaned = raw.replace(/[^a-zA-Z0-9_]/g, "");
  if (!cleaned) return null;
  return cleaned.toLowerCase();
}

export type BuildCaptionInput = {
  /** Optional — snaps have no title, long-form posts do. */
  title?: string;
  body: string;
  hiveAuthor: string;
  permalinkUrl: string;
  /** Extra tags coming from the post itself (will be deduped against defaults) */
  extraTags?: string[];
};

export function buildInstagramCaption(input: BuildCaptionInput): string {
  const title = (input.title || "").trim();
  const excerpt = markdownToPlainText(input.body);

  const tagSet = new Set<string>();
  for (const t of DEFAULT_HASHTAGS) {
    const n = normalizeTag(t);
    if (n) tagSet.add(n);
  }
  for (const t of input.extraTags || []) {
    if (tagSet.size >= IG_HASHTAG_LIMIT) break;
    const n = normalizeTag(t);
    if (n) tagSet.add(n);
  }
  const hashtagLine = Array.from(tagSet).slice(0, IG_HASHTAG_LIMIT).map((t) => `#${t}`).join(" ");

  // Plain Hive username (no @) so IG doesn't render it as a tag pointing to a
  // potentially-unrelated Instagram account. When we add hive→IG handle
  // mapping in the DB later, the author can be tagged with their real IG.
  const credit = `By ${input.hiveAuthor} on SkateHive`;
  const link = input.permalinkUrl;

  // Headline = title for long-form, otherwise the credit line itself.
  const headline = title || credit;
  const fixed = [headline, title ? credit : "", link, "", hashtagLine]
    .filter(Boolean)
    .join("\n");
  const remaining = IG_CAPTION_LIMIT - fixed.length - 2; // 2 for blank line around excerpt

  let safeExcerpt = "";
  if (remaining > 40 && excerpt) {
    safeExcerpt = excerpt.length > remaining ? excerpt.slice(0, remaining - 1).trim() + "…" : excerpt;
  }

  const parts: string[] = [headline];
  if (title) parts.push(credit);
  parts.push(link);
  if (safeExcerpt) parts.push("", safeExcerpt);
  parts.push("", hashtagLine);

  return parts.join("\n").slice(0, IG_CAPTION_LIMIT);
}
