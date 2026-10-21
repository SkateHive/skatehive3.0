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
  return readDraftsAt(draftsKeyFor(userKey));
}

function readDraftsAt(storageKey: string): ComposeDraft[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey);
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

// Picks the namespace compose drafts are stored under and the older
// namespaces that get folded into it. The active Hive account wins so
// switching Hive accounts keeps drafts apart; lite users fall back to their
// userbase id. The userbase bucket is only claimed by the Hive account linked
// to that same userbase user: a different Hive account active in the browser
// (e.g. another Keychain login) must never absorb, and delete, its drafts.
export function resolveComposeDraftKeys({
  activeHiveHandle,
  linkedHiveHandle,
  userbaseId,
}: {
  activeHiveHandle: string | null | undefined;
  linkedHiveHandle: string | null | undefined;
  userbaseId: string | null | undefined;
}): { draftKey: string | null; draftAliasKeys: string[] } {
  const userbaseKey = userbaseId ? `ub:${userbaseId}` : null;
  if (!activeHiveHandle) return { draftKey: userbaseKey, draftAliasKeys: [] };

  const ownsUserbaseDrafts =
    !!userbaseKey &&
    !!linkedHiveHandle &&
    linkedHiveHandle.toLowerCase() === activeHiveHandle.toLowerCase();

  return {
    draftKey: `hive:${activeHiveHandle}`,
    draftAliasKeys: ownsUserbaseDrafts ? [userbaseKey] : [],
  };
}

// Folds drafts from the pre-namespacing global keys and from any alias
// namespaces into the user's bucket, then removes the sources. Runs on every
// load but is a no-op once the sources are gone. Legacy drafts are only
// claimed by a logged-in user, never by the guest bucket.
export function migrateComposeDrafts(userKey: string | null, aliasKeys: string[] = []) {
  if (typeof window === "undefined" || !userKey) return;

  try {
    const storage = window.localStorage;
    const sources = [
      { drafts: COMPOSE_DRAFTS_STORAGE_KEY, active: ACTIVE_COMPOSE_DRAFT_KEY },
      ...aliasKeys
        .filter((aliasKey) => aliasKey !== userKey)
        .map((aliasKey) => ({
          drafts: draftsKeyFor(aliasKey),
          active: activeDraftKeyFor(aliasKey),
        })),
    ].filter((source) => storage.getItem(source.drafts) !== null || storage.getItem(source.active) !== null);

    if (sources.length === 0) return;

    const merged = new Map(readComposeDrafts(userKey).map((draft) => [draft.id, draft]));
    let activeDraftId = getActiveComposeDraftId(userKey);

    for (const source of sources) {
      for (const draft of readDraftsAt(source.drafts)) {
        const existing = merged.get(draft.id);
        if (!existing || Date.parse(draft.updatedAt) > Date.parse(existing.updatedAt)) {
          merged.set(draft.id, draft);
        }
      }
      activeDraftId = activeDraftId || storage.getItem(source.active);
    }

    writeComposeDrafts(
      [...merged.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
      userKey
    );
    if (activeDraftId) storage.setItem(activeDraftKeyFor(userKey), activeDraftId);

    for (const source of sources) {
      storage.removeItem(source.drafts);
      storage.removeItem(source.active);
    }
  } catch {
    // Storage full or unavailable: leave the sources in place for next time.
  }
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
