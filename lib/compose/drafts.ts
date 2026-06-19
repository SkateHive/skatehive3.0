import { Beneficiary } from "@/components/compose/BeneficiariesInput";

export const COMPOSE_DRAFTS_STORAGE_KEY = "skatehive.compose.drafts.v1";
export const ACTIVE_COMPOSE_DRAFT_KEY = "skatehive.compose.activeDraftId.v1";

export type ComposeDraft = {
  id: string;
  title: string;
  markdown: string;
  hashtags: string[];
  selectedThumbnail: string | null;
  uploadedThumbnail: string | null;
  beneficiaries: Beneficiary[];
  createdAt: string;
  updatedAt: string;
};

export type ComposeTemplate = {
  id: string;
  titleKey: string;
  descriptionKey: string;
  bodyKey: string;
};

export const COMPOSE_TEMPLATES: ComposeTemplate[] = [
  {
    id: "session-report",
    titleKey: "sessionReport",
    descriptionKey: "sessionReportDescription",
    bodyKey: "sessionReportBody",
  },
  {
    id: "spot-review",
    titleKey: "spotReview",
    descriptionKey: "spotReviewDescription",
    bodyKey: "spotReviewBody",
  },
  {
    id: "event-coverage",
    titleKey: "eventCoverage",
    descriptionKey: "eventCoverageDescription",
    bodyKey: "eventCoverageBody",
  },
  {
    id: "video-breakdown",
    titleKey: "videoBreakdown",
    descriptionKey: "videoBreakdownDescription",
    bodyKey: "videoBreakdownBody",
  },
  {
    id: "travel-skate-trip",
    titleKey: "travelSkateTrip",
    descriptionKey: "travelSkateTripDescription",
    bodyKey: "travelSkateTripBody",
  },
];

export function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readComposeDrafts(): ComposeDraft[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(COMPOSE_DRAFTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((draft): draft is ComposeDraft => {
      return (
        typeof draft?.id === "string" &&
        typeof draft?.title === "string" &&
        typeof draft?.markdown === "string" &&
        Array.isArray(draft?.hashtags) &&
        Array.isArray(draft?.beneficiaries) &&
        typeof draft?.createdAt === "string" &&
        typeof draft?.updatedAt === "string"
      );
    });
  } catch {
    return [];
  }
}

export function writeComposeDrafts(drafts: ComposeDraft[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPOSE_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
}

export function saveComposeDraft(draft: ComposeDraft) {
  const drafts = readComposeDrafts();
  const nextDrafts = [
    draft,
    ...drafts.filter((existingDraft) => existingDraft.id !== draft.id),
  ].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  writeComposeDrafts(nextDrafts);
  window.localStorage.setItem(ACTIVE_COMPOSE_DRAFT_KEY, draft.id);

  return draft;
}

export function deleteComposeDraft(id: string) {
  writeComposeDrafts(readComposeDrafts().filter((draft) => draft.id !== id));

  if (window.localStorage.getItem(ACTIVE_COMPOSE_DRAFT_KEY) === id) {
    window.localStorage.removeItem(ACTIVE_COMPOSE_DRAFT_KEY);
  }
}

export function getComposeDraft(id: string) {
  return readComposeDrafts().find((draft) => draft.id === id) ?? null;
}
