/**
 * Shared helpers for constructing Farcaster cast payloads from a SkateHive
 * snap. Kept in one place so the snap composer and the debug page render
 * the EXACT same output — drift between them would defeat the debug page.
 */

import { limitCastEmbeds, normalizeEmbedUrl } from "@/lib/farcaster/channels";

export const CAST_MAX_CHARS = 1024;

/**
 * Build the text body of a cross-posted cast: snap body trimmed to fit
 * the cast char limit, with the SkateHive URL appended on its own line
 * when present.
 */
export function buildSnapCastText(
  body: string,
  url: string | null
): string {
  const clean = body.trim();
  if (!url) {
    return clean.length > CAST_MAX_CHARS
      ? clean.slice(0, CAST_MAX_CHARS - 1).trim() + "…"
      : clean;
  }
  const urlLine = `\n\n${url}`;
  const budget = CAST_MAX_CHARS - urlLine.length;
  const trimmed =
    clean.length > budget
      ? clean.slice(0, Math.max(0, budget - 1)).trim() + "…"
      : clean;
  return trimmed + urlLine;
}

export interface CastEmbed {
  url: string;
}

export interface BuildSnapCastEmbedsInput {
  /** SkateHive post URL — `/post/{author}/{permlink}`. */
  snapUrl: string;
  /** Image URLs already uploaded to IPFS, in caption order. */
  imageUrls: string[];
  /** Direct video URL (IPFS), if the snap has a video. */
  videoUrl: string | null;
}

/**
 * Result of planning a snap's embeds.
 *
 * `dropped` exists because the 2-embed cap is enforced by a SILENT slice
 * everywhere else — the third candidate vanishes and nobody is told. The
 * canonical client does the same (`syncEmbedsBySourceForCast` ends in
 * `.slice(0, maxEmbedsLength)`), which is fine for a live composer where the
 * user can see what fit. Our cross-post is fire-and-forget, so the caller
 * needs the option to say what was left behind.
 */
export interface SnapCastEmbedPlan {
  embeds: CastEmbed[];
  /** Candidates that did not fit, in the order they were considered. */
  dropped: string[];
}

/**
 * Choose the embeds for a snap cast.
 *
 * The rule follows the canonical Farcaster client
 * (`castComposerEmbedHelpers.ts`, MIT — farcasterxyz/client): embeds are ONE
 * ordered candidate list, not buckets ranked by type. Attachments come first
 * in the order they were attached, then URLs derived from the cast text; the
 * list is deduped by normalized URL and capped at two.
 *
 * Two things this fixes versus ranking by type:
 *
 *  - The snap URL used to be DROPPED whenever the snap had any image, because
 *    images short-circuited the whole function. A one-image snap has a free
 *    slot and now uses it for the snap link.
 *  - The snap URL is also appended to the cast TEXT, and a URL in the text is
 *    an embed candidate to Farcaster clients. It therefore competes for the
 *    same two slots instead of being invisible to the budget.
 *
 * Video stays deliberately excluded as a candidate: Farcaster cannot
 * inline-play an IPFS video, so the raw URL renders as a broken card. The snap
 * URL carries it instead, and people watch in the Mini App.
 */
export function planSnapCastEmbeds({
  snapUrl,
  imageUrls,
  videoUrl,
}: BuildSnapCastEmbedsInput): SnapCastEmbedPlan {
  const candidates: string[] = [
    // Attachments, in attachment order.
    ...imageUrls,
    // Text-derived: the snap URL that buildSnapCastText appends to the body.
    // Last, so an attachment never loses its slot to the link. For a video or
    // text-only snap this is the only candidate, which reproduces the previous
    // behaviour exactly.
    snapUrl,
  ];

  const embeds = limitCastEmbeds(candidates);

  // A candidate counts as dropped only if nothing equivalent was kept — a
  // trailing-slash twin of a kept URL was deduped, not left behind, and
  // reporting it would send the caller chasing a loss that did not happen.
  const keptKeys = new Set(embeds.map(normalizeEmbedUrl));
  const droppedKeys = new Set<string>();
  const dropped: string[] = [];
  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed) continue;
    const key = normalizeEmbedUrl(trimmed);
    if (keptKeys.has(key) || droppedKeys.has(key)) continue;
    droppedKeys.add(key);
    dropped.push(trimmed);
  }

  return { embeds: embeds.map((url) => ({ url })), dropped };
}

/**
 * Backwards-compatible wrapper around {@link planSnapCastEmbeds} for callers
 * that only need the embeds. Prefer the plan when you can surface `dropped`.
 */
export function buildSnapCastEmbeds(
  input: BuildSnapCastEmbedsInput
): CastEmbed[] {
  return planSnapCastEmbeds(input).embeds;
}
