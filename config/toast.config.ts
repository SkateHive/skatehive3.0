/**
 * Toast Configuration
 * 
 * Configuration for toast notifications throughout the app
 */

export const TOAST_CONFIG = {
  SHOW_INTERVAL: 120000, // Show every 2 minutes
  DISPLAY_DURATION: 16000, // Display for 16 seconds
  INITIAL_DELAY: 5000, // Show first toast after 5 seconds
  WITNESS_DELAY: 15000, // Show witness toast after 15 seconds
  LOGIN_WITNESS_DELAY: 2000, // Show witness toast after login
  VOTE_WEIGHT: 10000, // 100% upvote weight
  DESKTOP_BREAKPOINT: 768, // md breakpoint
  SNOOZE_DURATION: 30 * 60 * 1000, // Dismiss snooze duration (30 minutes)
} as const;

export const TOAST_STYLES = {
  container: {
    background: "var(--chakra-colors-background)",
    borderRadius: "0px",
    padding: "16px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
    minWidth: "300px",
    maxWidth: "400px",
  },
  content: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    fontWeight: "600",
  },
  description: {
    fontSize: "13px",
    color: "var(--chakra-colors-text)",
    lineHeight: "1.4",
  },
  detail: {
    fontSize: "11px",
    color: "var(--chakra-colors-muted)",
    fontFamily: "monospace",
    wordBreak: "break-all" as const,
  },
  buttonContainer: {
    display: "flex",
    gap: "8px",
  },
} as const;
