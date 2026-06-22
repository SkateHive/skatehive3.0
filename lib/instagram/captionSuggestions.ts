/**
 * Smart caption helpers for the Instagram cross-post dialog.
 *
 * Scans the snap text for skate trick names and spot references, then proposes
 * one-tap CTAs + hashtags the user can append to the IG caption. Pure + no deps
 * so it's trivial to unit-test and extend with more tricks/spots over time.
 */

export type SuggestionKind = "trick" | "spot" | "cta" | "hashtag";

export interface CaptionSuggestion {
  /** Stable id (also used for de-dupe). */
  id: string;
  /** Short chip label shown in the dialog. */
  label: string;
  /** Text appended to the caption when the chip is tapped. */
  insert: string;
  kind: SuggestionKind;
}

/** Common tricks → the hashtag we suggest. Patterns are matched case-insensitive
 *  against the snap text. Order = priority (first matches surface first). */
const TRICKS: { pattern: RegExp; tag: string }[] = [
  { pattern: /\bnollie\b/, tag: "nollie" },
  { pattern: /\bkick ?flip\b/, tag: "kickflip" },
  { pattern: /\bheel ?flip\b/, tag: "heelflip" },
  { pattern: /\bhard ?flip\b/, tag: "hardflip" },
  { pattern: /\b(tre ?flip|360 ?flip|360 ?shove)\b/, tag: "treflip" },
  { pattern: /\b(shuv(it)?|shove[- ]?it|pop ?shove)\b/, tag: "shuvit" },
  { pattern: /\bbig ?spin\b/, tag: "bigspin" },
  { pattern: /\bimpossible\b/, tag: "impossible" },
  { pattern: /\bboard ?slide\b/, tag: "boardslide" },
  { pattern: /\blip ?slide\b/, tag: "lipslide" },
  { pattern: /\bnose ?slide\b/, tag: "noseslide" },
  { pattern: /\btail ?slide\b/, tag: "tailslide" },
  { pattern: /\bblunt ?slide\b/, tag: "bluntslide" },
  { pattern: /\b50[- ]?50\b/, tag: "5050" },
  { pattern: /\bsmith ?grind\b/, tag: "smithgrind" },
  { pattern: /\b(crooked|crook)\b/, tag: "crooks" },
  { pattern: /\bnose ?grind\b/, tag: "nosegrind" },
  { pattern: /\bwall ?ride\b/, tag: "wallride" },
  { pattern: /\bmanual\b/, tag: "manual" },
  { pattern: /\bollie\b/, tag: "ollie" },
  { pattern: /\bgrind\b/, tag: "grind" },
];

/** Words that imply the clip features a spot worth tagging. */
const SPOT_PATTERN =
  /\b(spot|skate ?park|ledge|hand ?rail|\brail\b|stairs?|gap|bowl|mini ?ramp|\bvert\b|quarter ?pipe|half ?pipe|manny ?pad|\bbank\b|plaza|\bd\.?i\.?y\.?\b|\bcurb\b|hubba|pump ?track)\b/;

const MAX_SUGGESTIONS = 6;

/**
 * Build the list of caption suggestions for a snap.
 *
 * @param sourceText  the snap body (what describes the clip)
 * @param existingCaption  the current caption — suggestions already present
 *                         in it are filtered out so chips don't re-offer them.
 */
export function suggestCaptionCTAs(sourceText: string, existingCaption: string): CaptionSuggestion[] {
  const haystack = `${sourceText || ""} ${existingCaption || ""}`.toLowerCase();
  const out: CaptionSuggestion[] = [];
  const seen = new Set<string>();
  const add = (s: CaptionSuggestion) => {
    if (!seen.has(s.id)) {
      seen.add(s.id);
      out.push(s);
    }
  };

  // 1. Trick hashtags (highest signal — the trick is the content).
  for (const t of TRICKS) {
    if (t.pattern.test(haystack)) {
      add({ id: `trick-${t.tag}`, label: `#${t.tag}`, insert: `#${t.tag}`, kind: "trick" });
    }
  }

  // 2. Spot-aware CTA + hashtag.
  if (SPOT_PATTERN.test(haystack)) {
    add({
      id: "spot-cta",
      label: "📍 Tag the spot",
      insert: "📍 Spot like this? Add it to the map on SkateHive.",
      kind: "spot",
    });
    add({ id: "spot-tag", label: "#skatespot", insert: "#skatespot", kind: "hashtag" });
  }

  // 3. Evergreen CTAs.
  add({
    id: "cta-follow",
    label: "Follow CTA",
    insert: "Follow @skatehive for your daily dose of skateboarding 🛹",
    kind: "cta",
  });
  add({ id: "cta-tag", label: "Tag a friend", insert: "Tag someone who'd send this 👇", kind: "cta" });
  add({ id: "cta-comment", label: "Comment CTA", insert: "Drop a 🛹 if this was clean.", kind: "cta" });

  // Drop anything already in the caption, cap the list.
  const cap = (existingCaption || "").toLowerCase();
  return out.filter((s) => !cap.includes(s.insert.toLowerCase())).slice(0, MAX_SUGGESTIONS);
}

/** Append a suggestion to a caption: hashtags inline, CTAs on their own line. */
export function appendSuggestion(caption: string, s: CaptionSuggestion, limit: number): string {
  const base = caption.replace(/\s+$/, "");
  const joined =
    s.kind === "trick" || s.kind === "hashtag"
      ? `${base} ${s.insert}`.trim()
      : `${base}\n\n${s.insert}`;
  return joined.slice(0, limit);
}
