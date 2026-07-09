// Fixed terminal palette for the media-magazine /home route — deliberately NOT
// theme tokens (the 20 user-selectable Chakra themes must not restyle this
// page, and this page must not add a 21st). Values are the design handoff's.
export const P = {
  bg: "#0a0a0a",
  card: "#1c1c1c", // major border
  ghost: "#2a2a2a", // secondary/ghost border
  accent: "#cbff3e",
  accentHover: "#eaffb0",
  navTint: "#151f05",
  headline: "#f5f5f5",
  body: "#e8e8e8",
  bodyMuted: "#c7c7c7",
  ui: "#8a8a8a",
  faint: "#666",
  faintest: "#555",
  onAccent: "#0a0a0a",
  onAccentSoft: "#1a1a1a",
} as const;

export const MONO = "var(--font-jetbrains), 'JetBrains Mono', monospace";
