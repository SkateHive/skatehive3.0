/**
 * Shared prose-rendering helpers used by both the post detail page
 * (`PostDetails.tsx`) and the flipbook magazine (`Magazine.tsx`).
 *
 * Why this lives in `lib/`: the post page and the magazine render the same
 * markdown body through different layouts, but both should use the same
 * editorial typography (font, drop cap, blockquote, image frame, etc.).
 * Centralizing the "tweaks → CSS variables" resolver here means a single
 * set of defaults and one place to evolve the prose look.
 */

import type { CSSProperties } from "react";
import type { PostProseTweaks } from "@/hooks/usePostProseTweaks";

export const PROSE_FONT_STACKS: Record<"sans" | "pixel", string> = {
  sans: "'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
  pixel: "'Joystix', 'VT323', 'Fira Mono', monospace",
};

/**
 * Reader bg = the wider scrollable column behind .post-prose. When
 * pageBg/readerBg are "theme" we return undefined so chakra's normal
 * background painting takes over.
 */
export function resolveReaderBg(t: PostProseTweaks): string | undefined {
  if (t.readerBg === "theme") return undefined;
  if (t.readerBg === "transparent") return "transparent";
  const a = Math.max(0, Math.min(1, t.readerBgAlpha / 100));
  if (/^#[0-9a-fA-F]{6}$/.test(t.readerBgCustom)) {
    const alphaHex = Math.round(a * 255).toString(16).padStart(2, "0");
    return `${t.readerBgCustom}${alphaHex}`;
  }
  return `color-mix(in srgb, ${t.readerBgCustom} ${Math.round(a * 100)}%, transparent)`;
}

/**
 * Build the CSS custom properties consumed by `.post-prose` rules in
 * `styles/markdown.css`. Every enum (bodyFont, headingColor, …) resolves
 * to a concrete font stack, hex, or Chakra theme variable so the same
 * tweaks JSON works on every theme.
 */
export function buildProseStyleVars(t: PostProseTweaks): CSSProperties {
  const fontStack = PROSE_FONT_STACKS[t.bodyFont];
  const headingFontStack =
    t.headingFont === "inherit" ? fontStack : PROSE_FONT_STACKS[t.headingFont];

  const bodyColor =
    t.bodyColor === "warm"
      ? "#ece4cf"
      : t.bodyColor === "neon"
        ? "var(--chakra-colors-text, #adff2f)"
        : t.bodyColor === "white"
          ? "#ffffff"
          : t.bodyColorCustom;

  const headingColor =
    t.headingColor === "primary"
      ? "var(--chakra-colors-primary, #adff2f)"
      : t.headingColor === "accent"
        ? "var(--chakra-colors-accent, #adff2f)"
        : t.headingColor === "text"
          ? "var(--chakra-colors-text, #fff)"
          : t.headingColorCustom;

  const linkColor =
    t.linkColor === "primary"
      ? "var(--chakra-colors-primary, #adff2f)"
      : t.linkColor === "accent"
        ? "var(--chakra-colors-accent, #adff2f)"
        : t.linkColorCustom;

  const codeAccent =
    t.codeAccent === "primary"
      ? "var(--chakra-colors-primary, #adff2f)"
      : t.codeAccent === "accent"
        ? "var(--chakra-colors-accent, #adff2f)"
        : t.codeAccentCustom;

  const dropCapColor =
    t.dropCapColor === "primary"
      ? "var(--chakra-colors-primary, #adff2f)"
      : t.dropCapColor === "accent"
        ? "var(--chakra-colors-accent, #adff2f)"
        : bodyColor;

  // Prose background — three named presets + custom, all alpha-modulated.
  const a = Math.max(0, Math.min(1, t.proseBgAlpha / 100));
  let proseBg = "transparent";
  if (t.proseBg === "tint") {
    proseBg = `color-mix(in srgb, var(--chakra-colors-primary, #adff2f) ${(a * 12).toFixed(1)}%, transparent)`;
  } else if (t.proseBg === "paper") {
    proseBg = `rgba(236, 228, 207, ${a.toFixed(2)})`;
  } else if (t.proseBg === "custom") {
    if (/^#[0-9a-fA-F]{6}$/.test(t.proseBgCustom)) {
      const alphaHex = Math.round(a * 255).toString(16).padStart(2, "0");
      proseBg = `${t.proseBgCustom}${alphaHex}`;
    } else {
      proseBg = `color-mix(in srgb, ${t.proseBgCustom} ${Math.round(a * 100)}%, transparent)`;
    }
  }

  const linkUnderlineThickness =
    t.linkUnderline === "thick"
      ? "2px"
      : t.linkUnderline === "subtle"
        ? "1px"
        : t.linkUnderline === "solid"
          ? "1px"
          : "0";

  const maxWidth = t.maxWidthCh >= 120 ? "100%" : `${t.maxWidthCh}ch`;

  const patternBase =
    t.bgPatternColor === "custom"
      ? t.bgPatternColorCustom
      : t.bgPatternColor === "text"
        ? "var(--chakra-colors-text, #adff2f)"
        : "var(--chakra-colors-primary, #adff2f)";
  const patternOpacityPct = Math.max(0, Math.min(100, t.bgPatternOpacity));
  const patternColor = `color-mix(in srgb, ${patternBase} ${patternOpacityPct}%, transparent)`;

  return {
    ["--pp-font" as string]: fontStack,
    ["--pp-heading-font" as string]: headingFontStack,
    ["--pp-color" as string]: bodyColor,
    ["--pp-accent" as string]: "var(--chakra-colors-primary, #adff2f)",
    ["--pp-heading-color" as string]: headingColor,
    ["--pp-link-color" as string]: linkColor,
    ["--pp-code-accent" as string]: codeAccent,
    ["--pp-drop-cap-color" as string]: dropCapColor,
    ["--pp-bg" as string]: proseBg,
    ["--pp-size" as string]: `${t.fontSize}px`,
    ["--pp-leading" as string]: String(t.lineHeight),
    ["--pp-letter-spacing" as string]: `${t.letterSpacing}em`,
    ["--pp-paragraph-gap" as string]: `${t.paragraphGap}em`,
    ["--pp-max-width" as string]: maxWidth,
    ["--pp-padding" as string]: `${t.prosePadding}px`,
    ["--pp-h1-size" as string]: `${t.h1Size}rem`,
    ["--pp-h2-size" as string]: `${t.h2Size}rem`,
    ["--pp-h3-size" as string]: `${t.h3Size}rem`,
    ["--pp-h4-size" as string]: `${t.h4Size}rem`,
    ["--pp-heading-weight" as string]: String(t.headingWeight),
    ["--pp-heading-letter-spacing" as string]: `${t.headingLetterSpacing}em`,
    ["--pp-heading-top-margin" as string]: `${t.headingTopMargin}em`,
    ["--pp-link-underline-thickness" as string]: linkUnderlineThickness,
    ["--pp-image-radius" as string]: `${t.imageRadius}px`,
    ["--pp-image-border" as string]: `${t.imageBorder}px`,
    ["--pp-image-shadow" as string]: (t.imageShadow / 100).toFixed(2),
    ["--pp-hr-thickness" as string]: `${t.hrThickness}px`,
    ["--pp-drop-cap-size" as string]: `${t.dropCapSize}em`,
    ["--pp-code-bg-intensity" as string]: `${t.codeBgIntensity}%`,
    ["--pp-pattern-color" as string]: patternColor,
    ["--pp-pattern-size" as string]: `${t.bgPatternSize}px`,
  };
}

/**
 * Minimum visible body length before we apply a drop cap. Drop caps signal
 * "long-form editorial" — on a one-line announcement or short reply they
 * read as pretentious. 360 chars ≈ a short paragraph, which feels right.
 */
const DROP_CAP_MIN_VISIBLE_CHARS = 360;

/**
 * Bilingual posts on Hive commonly open with a short language label like
 * `(Engl)`, `(Port)`, `[ES]`, `(Português)` before each translated block.
 * These shouldn't get the drop cap — skip past them and let the next real
 * paragraph claim it instead.
 *
 * Matches short parenthesized OR bracketed runs of letters (≤12), with no
 * whitespace inside. Won't false-positive on `(this is real text)` because
 * of the no-space constraint.
 */
const LANGUAGE_LABEL_PATTERN = /^[\(\[][A-Za-zÀ-ſ]{2,12}[\)\]]\s*$/;

/**
 * Pre-wrap the first Unicode letter of the body in `<span class="pp-cap">`
 * so the drop cap CSS can target only the letter (and not any preceding
 * punctuation, which is what `::first-letter` would do per CSS spec).
 *
 * Skipped when:
 *   - body is empty
 *   - body is too short (<DROP_CAP_MIN_VISIBLE_CHARS visible chars) — no
 *     drop cap on one-liners and short replies
 *   - the first non-empty line isn't a regular paragraph (heading, list,
 *     blockquote, code fence, image, html block)
 *   - the first line contains no Unicode letter at all
 *
 * Skips PAST (does not bail on) language-label lines like `(Engl)` so a
 * bilingual post still gets the drop cap on the real opening paragraph.
 */
export function wrapDropCapFirstLetter(body: string): string {
  if (!body) return body;

  const visibleLength = body.replace(/\s+/g, " ").trim().length;
  if (visibleLength < DROP_CAP_MIN_VISIBLE_CHARS) return body;

  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (!trimmed) continue;

    // Author wrote a language label like "(Engl)" / "[Port]" — not a real
    // paragraph; advance and keep looking for the actual first paragraph.
    if (LANGUAGE_LABEL_PATTERN.test(trimmed)) continue;

    if (
      trimmed.startsWith("#") ||
      trimmed.startsWith(">") ||
      trimmed.startsWith("```") ||
      trimmed.startsWith("![") ||
      trimmed.startsWith("|") ||
      trimmed.startsWith("---") ||
      trimmed.startsWith("<") ||
      /^[-*+]\s/.test(trimmed) ||
      /^\d+[.)]\s/.test(trimmed)
    ) {
      return body;
    }

    const match = trimmed.match(/^([^\p{L}]*)(\p{L})(.*)$/u);
    if (!match) return body;

    const [, lead, letter, rest] = match;
    const indent = line.slice(0, line.length - trimmed.length);
    lines[i] = `${indent}${lead}<span class="pp-cap">${letter}</span>${rest}`;
    return lines.join("\n");
  }
  return body;
}
