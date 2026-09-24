import { Beneficiary } from "@/components/compose/BeneficiariesInput";

export const COMPOSE_DRAFTS_STORAGE_KEY = "skatehive.compose.drafts.v1";
export const ACTIVE_COMPOSE_DRAFT_KEY = "skatehive.compose.activeDraftId.v1";
export const COMPOSE_TEMPLATES_STORAGE_KEY = "skatehive.compose.templates.v1";

// Drafts are namespaced per logged-in user so switching accounts on the same
// browser never shows (or overwrites) another user's in-progress draft.
const GUEST_DRAFT_NAMESPACE = "guest";

function draftsKeyFor(userKey: string | null | undefined) {
  return userKey
    ? `${COMPOSE_DRAFTS_STORAGE_KEY}.user.${encodeURIComponent(userKey)}`
    : `${COMPOSE_DRAFTS_STORAGE_KEY}.${GUEST_DRAFT_NAMESPACE}`;
}

function activeDraftKeyFor(userKey: string | null | undefined) {
  return userKey
    ? `${ACTIVE_COMPOSE_DRAFT_KEY}.user.${encodeURIComponent(userKey)}`
    : `${ACTIVE_COMPOSE_DRAFT_KEY}.${GUEST_DRAFT_NAMESPACE}`;
}

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
  titleKey?: string;
  descriptionKey?: string;
  bodyKey?: string;
  title?: string;
  description?: string;
  markdown?: string;
  isCustom?: boolean;
  updatedAt?: string;
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
];

export function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function readComposeDrafts(userKey?: string | null): ComposeDraft[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(draftsKeyFor(userKey));
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

export function writeComposeDrafts(drafts: ComposeDraft[], userKey?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(draftsKeyFor(userKey), JSON.stringify(drafts));
}

export function saveComposeDraft(draft: ComposeDraft, userKey?: string | null) {
  const drafts = readComposeDrafts(userKey);
  const nextDrafts = [
    draft,
    ...drafts.filter((existingDraft) => existingDraft.id !== draft.id),
  ].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

  writeComposeDrafts(nextDrafts, userKey);
  window.localStorage.setItem(activeDraftKeyFor(userKey), draft.id);

  return draft;
}

export function deleteComposeDraft(id: string, userKey?: string | null) {
  writeComposeDrafts(
    readComposeDrafts(userKey).filter((draft) => draft.id !== id),
    userKey
  );

  if (window.localStorage.getItem(activeDraftKeyFor(userKey)) === id) {
    window.localStorage.removeItem(activeDraftKeyFor(userKey));
  }
}

export function getComposeDraft(id: string, userKey?: string | null) {
  return readComposeDrafts(userKey).find((draft) => draft.id === id) ?? null;
}

export function getActiveComposeDraftId(userKey?: string | null): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(activeDraftKeyFor(userKey));
}

export function clearActiveComposeDraftId(userKey?: string | null) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(activeDraftKeyFor(userKey));
}

export function readComposeTemplates(): ComposeTemplate[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(COMPOSE_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((template): template is ComposeTemplate => {
      return (
        typeof template?.id === "string" &&
        typeof template?.title === "string" &&
        typeof template?.markdown === "string"
      );
    });
  } catch {
    return [];
  }
}

export function writeComposeTemplates(templates: ComposeTemplate[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COMPOSE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

export function getComposeTemplates() {
  const storedTemplates = readComposeTemplates();
  const defaultIds = new Set(COMPOSE_TEMPLATES.map((template) => template.id));
  const customTemplates = storedTemplates
    .filter((template) => !defaultIds.has(template.id))
    .sort((a, b) => Date.parse(b.updatedAt || "") - Date.parse(a.updatedAt || ""));

  const storedById = new Map(storedTemplates.map((template) => [template.id, template]));
  const mergedDefaults = COMPOSE_TEMPLATES.map((template) => storedById.get(template.id) || template);

  return [...customTemplates, ...mergedDefaults];
}

export function saveComposeTemplate(template: ComposeTemplate) {
  const templates = readComposeTemplates();
  const nextTemplates = [
    { ...template, isCustom: true },
    ...templates.filter((existingTemplate) => existingTemplate.id !== template.id),
  ];

  writeComposeTemplates(nextTemplates);
  return template;
}

export function createTemplateFromDraft(draft: Pick<ComposeDraft, "title" | "markdown">) {
  const now = new Date().toISOString();
  const title = draft.title.trim() || "Untitled Template";

  return {
    id: `template-${createDraftId()}`,
    title,
    description: `Saved from ${title}.`,
    markdown: draft.markdown,
    isCustom: true,
    updatedAt: now,
  };
}
