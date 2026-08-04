// Theme-aware palette for the /home media magazine.
//
// Was previously a fixed hex palette by design ("the 20 user-selectable
// Chakra themes must not restyle this page") — that decision was reverted
// per user request: the /home page should follow whichever theme the user
// has active. Each key resolves to a Chakra theme CSS variable that every
// theme in `themes/*.ts` defines, so the layout inherits the palette
// without any per-theme wiring.
//
// Chakra emits `theme.colors.<key>` as `--chakra-colors-<key>`. Using vars
// (not raw token strings) means these values work both in Chakra props
// (`bg={P.accent}`) AND in template literals (`border={`2px solid
// ${P.accent}`}` — a plain token string like `"primary"` would resolve to
// literal text there).
//
// Tokens used are the "core seven" every theme file guarantees:
// background, primary, accent, secondary, text, muted, border. Anything
// more exotic (dim, panel, subtle) exists on some themes but not all, so
// we don't depend on them.
export const P = {
  bg: "var(--chakra-colors-background)",
  card: "var(--chakra-colors-muted)",
  ghost: "var(--chakra-colors-border)",
  accent: "var(--chakra-colors-primary)",
  accentHover: "var(--chakra-colors-accent)",
  navTint: "var(--chakra-colors-muted)",
  headline: "var(--chakra-colors-text)",
  body: "var(--chakra-colors-text)",
  bodyMuted: "var(--chakra-colors-secondary)",
  ui: "var(--chakra-colors-secondary)",
  faint: "var(--chakra-colors-muted)",
  faintest: "var(--chakra-colors-muted)",
  onAccent: "var(--chakra-colors-background)",
  onAccentSoft: "var(--chakra-colors-muted)",
} as const;

export const MONO = "var(--font-jetbrains), 'JetBrains Mono', monospace";
