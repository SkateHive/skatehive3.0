/**
 * The size budget of a Farcaster cast.
 *
 * The protocol limit is 1024 BYTES of UTF-8, not 1024 JavaScript characters.
 * Those are the same number only for ASCII, which is why measuring with
 * `.length` looked correct for as long as it did:
 *
 *   "a".repeat(1024)  ->  1024 chars, 1024 bytes  ✅
 *   "á".repeat(1024)  ->  1024 chars, 2048 bytes  ❌ rejected by Farcaster
 *   "🛹".repeat(512)  ->  1024 chars, 2048 bytes  ❌
 *
 * So a cast written in Portuguese — accents everywhere — could pass every one
 * of our checks and still be refused, or be silently cut by a client at a byte
 * boundary we never chose. That hits our main community hardest.
 */

export const CAST_MAX_BYTES = 1024;

const encoder = new TextEncoder();

/** Size of `text` as Farcaster counts it: UTF-8 bytes. */
export function castByteLength(text: string): number {
  return encoder.encode(text).length;
}

/**
 * The units we are willing to cut between.
 *
 * Grapheme clusters when the runtime has `Intl.Segmenter` — every browser and
 * Node version we ship on does — so a flag, a skin-toned emoji or a ZWJ family
 * is never split into its pieces. Code points otherwise, which is still enough
 * to never split a surrogate pair into two lone halves (the failure that
 * produces a literal "�" in the cast).
 */
function cuttableUnits(text: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: unknown }).Segmenter as
    | (new (
        locale?: string,
        options?: { granularity: "grapheme" }
      ) => { segment(input: string): Iterable<{ segment: string }> })
    | undefined;

  if (typeof Segmenter === "function") {
    const segmenter = new Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  // Array.from iterates by code point, not by UTF-16 unit.
  return Array.from(text);
}

/**
 * Cut `text` down to at most `maxBytes` UTF-8 bytes, never mid-character.
 *
 * Returns the longest prefix that fits. A single character larger than the
 * whole budget yields an empty string rather than a broken one.
 */
export function truncateToBytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  if (castByteLength(text) <= maxBytes) return text;

  let out = "";
  let used = 0;
  for (const unit of cuttableUnits(text)) {
    const size = castByteLength(unit);
    if (used + size > maxBytes) break;
    out += unit;
    used += size;
  }
  return out;
}
