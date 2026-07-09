import { Beneficiary } from "@/components/compose/BeneficiariesInput";

export type ComposeDraft = {
  id: string;
  title: string;
  markdown: string;
  hashtags: string[];
  selectedThumbnail: string | null;
  uploadedThumbnail: string | null;
  beneficiaries: Beneficiary[];
  sourceTemplateId?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComposeTemplate = {
  id: string;
  title: string;
  description: string;
  markdown: string;
  hashtags: string[];
  isCustom?: boolean;
  updatedAt?: string;
};

export const COMPOSE_DRAFTS_STORAGE_KEY = "skatehive.compose.drafts.v1";
export const COMPOSE_TEMPLATES_STORAGE_KEY = "skatehive.compose.templates.v1";

export const composeTemplates: ComposeTemplate[] = [
  {
    id: "session-report",
    title: "Session Report",
    description: "A clean structure for clips, tricks, and session highlights.",
    hashtags: ["skatehive", "skateboarding", "session"],
    markdown: `# Session at [Spot Name]

## Spot

Describe the location, ground, obstacles, and atmosphere.

## Session

Talk about the tricks, battles, makes, and progression.

## Highlights

- Best trick:
- Hardest battle:
- Crew:

## Final Thoughts

Wrap up the session.`,
  },
  {
    id: "spot-review",
    title: "Spot Review",
    description: "Review a plaza, street spot, DIY, or park for other skaters.",
    hashtags: ["skatehive", "skateboarding", "spotcheck"],
    markdown: `# Spot Review: [Spot Name]

## Location

Where is it and how do skaters get there?

## Terrain

Describe the ground, ledges, rails, gaps, transitions, and flow.

## Best For

- Tricks:
- Skill level:
- Time of day:

## Notes

Share security, respect, local crew, and cleanup notes.`,
  },
  {
    id: "event-coverage",
    title: "Event Coverage",
    description: "Cover contests, jams, meetups, demos, and community sessions.",
    hashtags: ["skatehive", "skateboarding", "event"],
    markdown: `# [Event Name]

## What Happened

Summarize the event, location, date, and vibe.

## Standout Moments

- Best run:
- Best trick:
- Community moment:

## Photos / Clips

Add media and captions here.

## Credits

Credit skaters, filmers, organizers, and sponsors.`,
  },
];

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createTemplateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `template-${crypto.randomUUID()}`;
  }

  return `template-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function safeParseDrafts(raw: string | null): ComposeDraft[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeParseTemplates(raw: string | null): ComposeTemplate[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getStoredDrafts(): ComposeDraft[] {
  if (typeof window === "undefined") return [];

  return safeParseDrafts(window.localStorage.getItem(COMPOSE_DRAFTS_STORAGE_KEY))
    .filter((draft) => draft && typeof draft.id === "string")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function storeDrafts(drafts: ComposeDraft[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(COMPOSE_DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
}

export function upsertDraft(draft: ComposeDraft) {
  const drafts = getStoredDrafts();
  const nextDrafts = [draft, ...drafts.filter((item) => item.id !== draft.id)];
  storeDrafts(nextDrafts);
}

export function deleteDraft(draftId: string) {
  storeDrafts(getStoredDrafts().filter((draft) => draft.id !== draftId));
}

export function getStoredTemplates(): ComposeTemplate[] {
  if (typeof window === "undefined") return [];

  return safeParseTemplates(window.localStorage.getItem(COMPOSE_TEMPLATES_STORAGE_KEY))
    .filter(
      (template) =>
        template &&
        typeof template.id === "string" &&
        typeof template.title === "string" &&
        typeof template.markdown === "string"
    )
    .map((template) => ({
      ...template,
      description: template.description || "Custom saved template.",
      hashtags: Array.isArray(template.hashtags) ? template.hashtags : [],
      isCustom: true,
    }));
}

export function getComposeTemplates(): ComposeTemplate[] {
  const storedTemplates = getStoredTemplates();
  const storedById = new Map(storedTemplates.map((template) => [template.id, template]));
  const defaultIds = new Set(composeTemplates.map((template) => template.id));

  const mergedDefaults = composeTemplates.map((template) => storedById.get(template.id) || template);
  const customOnly = storedTemplates
    .filter((template) => !defaultIds.has(template.id))
    .sort(
      (a, b) =>
        new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );

  return [...customOnly, ...mergedDefaults];
}

export function storeTemplates(templates: ComposeTemplate[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(COMPOSE_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

export function upsertTemplate(template: ComposeTemplate) {
  const templates = getStoredTemplates();
  const nextTemplates = [
    { ...template, isCustom: true },
    ...templates.filter((item) => item.id !== template.id),
  ];
  storeTemplates(nextTemplates);
}

export function createBlankDraft(): ComposeDraft {
  const now = new Date().toISOString();

  return {
    id: createDraftId(),
    title: "",
    markdown: "",
    hashtags: [],
    selectedThumbnail: null,
    uploadedThumbnail: null,
    beneficiaries: [],
    sourceTemplateId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function createDraftFromTemplate(template: ComposeTemplate): ComposeDraft {
  const now = new Date().toISOString();

  return {
    id: createDraftId(),
    title: template.title,
    markdown: template.markdown,
    hashtags: [],
    selectedThumbnail: null,
    uploadedThumbnail: null,
    beneficiaries: [],
    sourceTemplateId: template.id,
    createdAt: now,
    updatedAt: now,
  };
}

export function createTemplateFromDraft(
  draft: Pick<ComposeDraft, "title" | "markdown" | "hashtags" | "sourceTemplateId">,
  existingTemplate?: ComposeTemplate | null
): ComposeTemplate {
  const now = new Date().toISOString();
  const title = draft.title.trim() || existingTemplate?.title || "Untitled Template";

  return {
    id: existingTemplate?.id || draft.sourceTemplateId || createTemplateId(),
    title,
    description:
      existingTemplate?.description ||
      `Saved from ${title}.`,
    markdown: draft.markdown,
    hashtags: draft.hashtags,
    isCustom: true,
    updatedAt: now,
  };
}
