import { VALID_QUERIES } from "@/config/blog.config";

/**
 * Public `/search` target.
 *
 * Blog sorting lives at `/blog?query=` (`created`, `trending`, `hot`, …).
 * A free-text query is not one of those sorts — `/blog?query=skate` would
 * ignore the word and show the default feed. Tag listings at `/blog/tag/`
 * are the existing post search, so `q=skate` goes there.
 */
export function resolveSearchPath(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "/blog";

  if ((VALID_QUERIES as readonly string[]).includes(trimmed)) {
    return `/blog?query=${encodeURIComponent(trimmed)}`;
  }

  const tag = trimmed
    .replace(/^#/, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  if (tag.length > 0 && tag.length <= 64 && /^[a-z0-9][a-z0-9-]*$/.test(tag)) {
    return `/blog/tag/${tag}`;
  }

  return "/blog";
}
