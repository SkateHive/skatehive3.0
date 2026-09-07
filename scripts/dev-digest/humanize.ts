/**
 * Rewrites raw commit subjects into language a Skatehive user can follow.
 *
 * Structure (heading, banner, date range) stays in generateDigest.ts; only the
 * bullet prose is delegated.
 *
 * Model output is untrusted. Each bullet must cite the indexes of the commits
 * it came from, and a bullet citing nothing real is dropped -- the prompt's
 * "do not invent" instruction is not by itself checkable. The citations stay
 * out of the rendered text; they exist only to be validated here.
 *
 * No API key, an API error, a refusal, or nothing left after validation all
 * return null, and the caller falls back to the raw digest.
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
- Drop every commit hash, file path, branch name and PR number from the text.
- Never use developer jargon. Translate the effect instead: "close SSRF holes in the URL-fetching OG routes" becomes "Closed a security hole in how we load link previews."
- Merge commits that are part of the same change into one bullet. Ten commits about one feature is one bullet.
- Only describe what is in the commit list. Never invent a feature, a number or a benefit that is not there.
- Internal work still counts, but describe why a user should care. If a piece of plumbing has no user-visible effect at all, say so plainly and briefly rather than dressing it up.
- One sentence per bullet. Plain, direct, no marketing voice and no exclamation marks.
- Write in English.

Every commit is numbered. Each bullet must list the numbers of the commits it is based on, in a "commits" array. A bullet you cannot ground in at least one numbered commit must not be written at all.

Return only JSON, no prose around it, in exactly this shape:
{"features": [{"text": "...", "commits": [1, 4]}], "fixes": [], "internal": []}

Any of the three arrays may be empty.`;

/** 1-indexed so the numbering reads naturally in the prompt. */
function commitList(commits: Commit[]): string {
  return commits.map((c, i) => `${i + 1}. ${c.type}: ${c.subject}`).join("\n");
}

interface Grounded {
  text: string;
  commits: number[];
}

/**
 * Keeps only bullets that are non-empty and cite at least one commit index
 * that actually exists. Returns the surviving text plus every cited index.
 */
function groundedItems(
  value: unknown,
  commitCount: number,
  rejected: string[]
): { items: string[]; cited: Set<number> } {
  const cited = new Set<number>();
  if (!Array.isArray(value)) return { items: [], cited };

  const items: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      rejected.push(`not an object: ${JSON.stringify(entry)}`);
      continue;
    }
    const { text, commits } = entry as Partial<Grounded>;
    if (typeof text !== "string" || !text.trim()) {
      rejected.push(`missing text: ${JSON.stringify(entry)}`);
      continue;
    }
    const valid = (Array.isArray(commits) ? commits : []).filter(
      (n): n is number => Number.isInteger(n) && n >= 1 && n <= commitCount
    );
    if (valid.length === 0) {
      rejected.push(`ungrounded: ${text.trim()}`);
      continue;
    }
    for (const n of valid) cited.add(n);
    items.push(text.trim());
  }
  return { items, cited };
}

export function sectionsFromResponse(
  raw: string,
  commitCount: number
): DigestSection[] | null {
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
  const rejected: string[] = [];
  const features = groundedItems(obj.features, commitCount, rejected);
  const fixes = groundedItems(obj.fixes, commitCount, rejected);
  const internal = groundedItems(obj.internal, commitCount, rejected);

  for (const reason of rejected) {
    console.error(`Dropped bullet -- ${reason}`);
  }

  const sections: DigestSection[] = [
    { title: HUMANIZED_TITLES.features, items: features.items },
    { title: HUMANIZED_TITLES.fixes, items: fixes.items },
    { title: HUMANIZED_TITLES.internal, items: internal.items },
  ];

  // An empty rewrite is a failure, not a quiet week -- the caller has commits.
  if (sections.every((s) => s.items.length === 0)) return null;

  // Coverage is reported, not enforced: merging related commits and skipping
  // pure noise are both intended, so a gap is worth seeing but not a failure.
  const covered = new Set([
    ...features.cited,
    ...fixes.cited,
    ...internal.cited,
  ]);
  if (covered.size < commitCount) {
    const missing = Array.from({ length: commitCount }, (_, i) => i + 1)
      .filter((n) => !covered.has(n))
      .join(", ");
    console.error(
      `${commitCount - covered.size} of ${commitCount} commits not cited by any bullet: ${missing}`
    );
  }

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
          content: `Here are this week's commits, numbered. Rewrite them for the changelog.\n\n${commitList(commits)}`,
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

    const sections = sectionsFromResponse(text, commits.length);
    if (!sections) {
      console.error(
        "Rewrite produced nothing usable -- falling back to raw commit subjects."
      );
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
