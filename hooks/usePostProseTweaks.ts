"use client";

import { useEffect, useState, useCallback, useRef } from "react";

/* ─── Enum option types ───────────────────────────────────── */
export type ProseBodyFont = "sans" | "pixel";
export type ProseBodyColor = "warm" | "neon" | "white" | "custom";
export type ProseSize = "compact" | "comfortable" | "spacious";
export type ProsePageBg = "theme" | "transparent" | "custom";
export type ProseProseBg = "transparent" | "tint" | "paper" | "custom";
export type ProseHeadingFont = "inherit" | "sans" | "pixel";
export type ProseHeadingColor = "primary" | "accent" | "text" | "custom";
export type ProseLinkColor = "primary" | "accent" | "custom";
export type ProseLinkUnderline = "subtle" | "solid" | "thick" | "none";
export type ProseBlockquoteStyle = "minimal" | "pull-quote" | "box";
export type ProseCodeAccent = "primary" | "accent" | "custom";
export type ProseDropCapColor = "primary" | "accent" | "inherit";
export type ProseHrStyle = "short" | "full" | "fade";
export type ProseBgPattern = "none" | "grid" | "dots";
export type ProsePatternColor = "accent" | "text" | "custom";

export interface PostProseTweaks {
  /* Body typography */
  bodyFont: ProseBodyFont;
  bodyColor: ProseBodyColor;
  bodyColorCustom: string;
  size: ProseSize;
  /* Backwards compat — `size` is still the preset; these override when set
     (sliders surface them in the panel for fine tuning). */
  fontSize: number; // px
  lineHeight: number; // unitless
  letterSpacing: number; // em
  paragraphGap: number; // em

  /* Layout */
  maxWidthCh: number; // 50-120, 120 = full width
  prosePadding: number; // 0-32 px (inner padding on the prose container)

  /* Page + reader + prose background */
  pageBg: ProsePageBg;
  pageBgCustom: string;
  /* Reader = the wider scrollable column that sits behind .post-prose.
     Useful when maxWidthCh is narrow and you want the surrounding area
     to have its own fill (separate from the page and from the prose). */
  readerBg: ProsePageBg;
  readerBgCustom: string;
  readerBgAlpha: number; // 0-100
  proseBg: ProseProseBg;
  proseBgCustom: string;
  proseBgAlpha: number; // 0-100
  bgPattern: ProseBgPattern;
  /* Pattern (grid / dots) appearance */
  bgPatternColor: ProsePatternColor;
  bgPatternColorCustom: string;
  bgPatternOpacity: number; // 0-100 %
  bgPatternSize: number; // px, spacing between lines / dots

  /* Headings */
  headingFont: ProseHeadingFont;
  headingColor: ProseHeadingColor;
  headingColorCustom: string;
  h1Size: number; // rem
  h2Size: number; // rem
  h3Size: number; // rem
  h4Size: number; // rem
  headingWeight: number; // 400-900
  headingLetterSpacing: number; // em
  headingTopMargin: number; // em (space above each heading)

  /* Links */
  linkColor: ProseLinkColor;
  linkColorCustom: string;
  linkUnderline: ProseLinkUnderline;

  /* Blockquote */
  blockquoteStyle: ProseBlockquoteStyle;

  /* Code */
  codeAccent: ProseCodeAccent;
  codeAccentCustom: string;
  codeBgIntensity: number; // 0-30 %

  /* Images */
  imageFrames: boolean;
  imageRadius: number; // 0-24 px
  imageBorder: number; // 0-3 px
  imageShadow: number; // 0-100 intensity

  /* HR */
  hrStyle: ProseHrStyle;
  hrThickness: number; // 1-4 px

  /* Drop cap */
  dropCap: boolean;
  dropCapSize: number; // 2.5-5.0 em
  dropCapColor: ProseDropCapColor;

  /* Existing touches (kept) */
  pullQuote: boolean;
  tightRhythm: boolean;
}

/**
 * Defaults are tuned to read well across every theme in `themes/`.
 * Color choices use Chakra theme tokens ("accent", "primary", "neon" →
 * `var(--chakra-colors-text)`) instead of hard-coded hexes, so the prose
 * automatically picks up whatever the active theme defines.
 *
 * This baseline came out of an editorial typography review (line height
 * 1.55, 75ch measure, weight 800 headings with slight negative tracking,
 * 6px image radius). See conversation in PR introducing reading tweaks.
 */
export const DEFAULT_POST_PROSE_TWEAKS: PostProseTweaks = {
  // Body
  bodyFont: "sans",
  bodyColor: "neon", // = var(--chakra-colors-text) — adapts per theme
  bodyColorCustom: "#ece4cf",
  size: "spacious",
  fontSize: 19,
  lineHeight: 1.55,
  letterSpacing: 0.005,
  paragraphGap: 1.05,

  // Layout
  maxWidthCh: 75,
  prosePadding: 8,

  // Backgrounds — let theme show through by default
  pageBg: "theme",
  pageBgCustom: "#0f1011",
  readerBg: "transparent",
  readerBgCustom: "#1a1c1e",
  readerBgAlpha: 50,
  proseBg: "transparent",
  proseBgCustom: "#1a1c1e",
  proseBgAlpha: 70,
  bgPattern: "grid",
  bgPatternColor: "accent",
  bgPatternColorCustom: "#adff2f",
  bgPatternOpacity: 6,
  bgPatternSize: 16,

  // Headings — accent picks up the theme's secondary highlight color
  headingFont: "inherit",
  headingColor: "accent",
  headingColorCustom: "#adff2f",
  h1Size: 1.9,
  h2Size: 1.45,
  h3Size: 1.2,
  h4Size: 1.05,
  headingWeight: 800,
  headingLetterSpacing: -0.01,
  headingTopMargin: 2.2,

  // Links
  linkColor: "accent",
  linkColorCustom: "#adff2f",
  linkUnderline: "subtle",

  // Blockquote
  blockquoteStyle: "pull-quote",

  // Code
  codeAccent: "primary",
  codeAccentCustom: "#adff2f",
  codeBgIntensity: 8,

  // Images
  imageFrames: true,
  imageRadius: 6,
  imageBorder: 1,
  imageShadow: 45,

  // HR
  hrStyle: "short",
  hrThickness: 1,

  // Drop cap
  dropCap: true,
  dropCapSize: 3.6,
  dropCapColor: "primary",

  // Touches — leave tightRhythm OFF so the new heading top-margin
  // (2.2em) actually applies. tightRhythm overrides it with 1.6em.
  pullQuote: true,
  tightRhythm: false,
};

const STORAGE_KEY = "skatehive:post-prose-tweaks";
const SYNC_EVENT = "skatehive:post-prose-tweaks:sync";

function readFromStorage(): PostProseTweaks {
  if (typeof window === "undefined") return DEFAULT_POST_PROSE_TWEAKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_POST_PROSE_TWEAKS;
    const merged = { ...DEFAULT_POST_PROSE_TWEAKS, ...JSON.parse(raw) };
    // Migrate the now-removed "serif" font choice to "sans" so old
    // localStorage entries don't leave the renderer with an unmapped font.
    if ((merged as { bodyFont?: string }).bodyFont === "serif") {
      merged.bodyFont = "sans";
    }
    if ((merged as { headingFont?: string }).headingFont === "serif") {
      merged.headingFont = "sans";
    }
    return merged;
  } catch {
    return DEFAULT_POST_PROSE_TWEAKS;
  }
}

export function usePostProseTweaks() {
  const [tweaks, setTweaks] = useState<PostProseTweaks>(DEFAULT_POST_PROSE_TWEAKS);
  const tweaksRef = useRef<PostProseTweaks>(DEFAULT_POST_PROSE_TWEAKS);
  tweaksRef.current = tweaks;

  useEffect(() => {
    setTweaks(readFromStorage());
    const sync = () => setTweaks(readFromStorage());
    window.addEventListener(SYNC_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SYNC_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((partial: Partial<PostProseTweaks>) => {
    const next = { ...tweaksRef.current, ...partial };
    tweaksRef.current = next;
    setTweaks(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      window.dispatchEvent(new Event(SYNC_EVENT));
    } catch {}
  }, []);

  const reset = useCallback(() => {
    tweaksRef.current = DEFAULT_POST_PROSE_TWEAKS;
    setTweaks(DEFAULT_POST_PROSE_TWEAKS);
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.dispatchEvent(new Event(SYNC_EVENT));
    } catch {}
  }, []);

  const importTweaks = useCallback((json: string): { ok: boolean; error?: string } => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed || typeof parsed !== "object") {
        return { ok: false, error: "Expected a JSON object." };
      }
      // Shallow-merge over defaults so partial exports still apply cleanly.
      const next: PostProseTweaks = { ...DEFAULT_POST_PROSE_TWEAKS, ...parsed };
      tweaksRef.current = next;
      setTweaks(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        window.dispatchEvent(new Event(SYNC_EVENT));
      } catch {}
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }, []);

  return { tweaks, update, reset, importTweaks };
}
