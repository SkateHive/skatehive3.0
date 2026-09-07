/**
 * Rewrites raw commit subjects into language a Skatehive user can follow.
 *
 * The commit list is the only source of truth -- this asks Claude to restate
 * what shipped, never to invent it. Structure (heading, banner, date range)
 * stays in generateDigest.ts; only the bullet prose is delegated.
 *
 * No API key -> returns null, and the caller falls back to the raw digest.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { Commit } from "./generateDigest";

export interface DigestSection {
  title: string;
  items: string[];
}

export const HUMANIZED_TITLES = {
  features: "### 🆕 New Features",
  fixes: "### 🐛 Fixes",
  internal: "### 🔧 Under the hood",
} as const;

const SYSTEM = `You write the weekly changelog for Skatehive, a skateboarding community app built on the Hive blockchain.

Your readers are skaters, not developers. They want to know what changed and what got better. They do not know what a commit, a scope, a proxy or a migration is.

Rules:
- Write for someone who uses the app, never for someone who reads the code.
- Drop every commit hash, file path, branch name and PR number.
- Never use developer jargon. Translate the effect instead: "close SSRF holes in the URL-fetching OG routes" becomes "Closed a security hole in how we load link previews."
- Merge commits that are part of the same change into one bullet. Ten commits about one feature is one bullet.
- Only describe what is in the commit list. Never invent a feature, a number or a benefit that is not there.
- Internal work still counts, but describe why a user should care. If a piece of plumbing has no user-visible effect at all, say so plainly and briefly rather than dressing it up.
- One sentence per bullet. Plain, direct, no marketing voice and no exclamation marks.
- Write in English.

Return only JSON, no prose around it, in exactly this shape:
{"features": ["..."], "fixes": ["..."], "internal": ["..."]}

Any of the three arrays may be empty.`;

function commitList(commits: Commit[]): string {
  return commits.map((c) => `- ${c.type}: ${c.subject}`).join("\n");
}

/** Narrow unknown JSON into string[] without trusting the model's shape. */
function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function sectionsFromResponse(raw: string): DigestSection[] | null {
  // The model may wrap JSON in a fence despite instructions.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;
  const sections: DigestSection[] = [
    { title: HUMANIZED_TITLES.features, items: stringArray(obj.features) },
    { title: HUMANIZED_TITLES.fixes, items: stringArray(obj.fixes) },
    { title: HUMANIZED_TITLES.internal, items: stringArray(obj.internal) },
  ];

  // An empty rewrite is a failure, not a quiet week -- the caller has commits.
  if (sections.every((s) => s.items.length === 0)) return null;
  return sections;
}

export async function humanizeCommits(
  commits: Commit[]
): Promise<DigestSection[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set -- falling back to raw commit subjects.");
    return null;
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Here are this week's commits. Rewrite them for the changelog.\n\n${commitList(commits)}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      console.error(
        `Claude declined the rewrite (${response.stop_details?.category ?? "unknown"}) -- falling back to raw commit subjects.`
      );
      return null;
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const sections = sectionsFromResponse(text);
    if (!sections) {
      console.error("Could not parse the rewrite as JSON -- falling back to raw commit subjects.");
    }
    return sections;
  } catch (error) {
    // A transient API failure must not block the weekly post.
    const detail =
      error instanceof Anthropic.APIError
        ? `${error.status} ${error.message}`
        : error instanceof Error
          ? error.message
          : String(error);
    console.error(`Rewrite failed (${detail}) -- falling back to raw commit subjects.`);
    return null;
  }
}
