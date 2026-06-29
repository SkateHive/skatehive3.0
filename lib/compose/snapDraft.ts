const SNAP_DRAFT_KEY = "skatehive.snap.draft.v1";

export type SnapDraft = {
  body: string;
  images: { url: string; caption: string }[];
  gifUrl: string | null;
  videoUrl: string | null;
  savedAt: string;
};

export function getSnapDraft(): SnapDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNAP_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.body !== "string" ||
      !Array.isArray(parsed?.images) ||
      typeof parsed?.savedAt !== "string"
    )
      return null;
    return parsed as SnapDraft;
  } catch {
    return null;
  }
}

export function saveSnapDraft(draft: Omit<SnapDraft, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SNAP_DRAFT_KEY,
      JSON.stringify({ ...draft, savedAt: new Date().toISOString() })
    );
  } catch {
    // storage quota exceeded or private browsing — fail silently
  }
}

export function clearSnapDraft(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SNAP_DRAFT_KEY);
  } catch {
    // ignore
  }
}
