/**
 * Dev Update digest — turns the last 7 days of commits on main into
 * Hive-flavored markdown. Prints to stdout; prints nothing when there's
 * nothing worth posting.
 *
 * Run: pnpm tsx scripts/dev-digest/generateDigest.ts
 *
 * DRY RUN: nothing is broadcast to Hive yet. See broadcastDigestToHive() below.
 */

import { execFileSync } from "child_process";

// DIGEST_DAYS widens the window for manual testing / backfilling a missed week.
const DAYS = Number(process.env.DIGEST_DAYS) || 7;

// chore/refactor/test/perf all land in "Under the hood"
const SECTIONS = [
  { title: "### 🆕 New Features", types: ["feat"] },
  { title: "### 🐛 Fixes", types: ["fix"] },
  { title: "### 📚 Docs", types: ["docs"] },
  { title: "### 🔧 Under the hood", types: ["chore", "refactor", "test", "perf"] },
];

const TYPES = new Set(SECTIONS.flatMap((s) => s.types));
// `feat(scope)!: subject` — scope and the breaking `!` are both optional
const CONVENTIONAL = /^([a-z]+)(\([^)]*\))?!?:\s*(.+)$/i;

const NOISE = [
  /^Merge pull request/i,
  /^Merge branch/i,
  /^Merge remote-tracking/i,
  /^(chore(\([^)]*\))?:\s*)?(bump|release|v?\d+\.\d+\.\d+)/i, // version-bump-only
];

interface Commit {
  type: string;
  subject: string;
  hash: string;
}

function gitLog(): string[] {
  // ponytail: reads whatever ref exists — CI checks out the branch, not main.
  const ref = ["main", "origin/main", "HEAD"].find((r) => {
    try {
      execFileSync("git", ["rev-parse", "--verify", r], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  })!;

  return execFileSync(
    "git",
    ["log", `--since=${DAYS} days ago`, "--pretty=format:%s|%an|%h", ref],
    { encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean);
}

export function parse(lines: string[]): Commit[] {
  const commits: Commit[] = [];

  for (const line of lines) {
    // subject may itself contain "|", so split off author+hash from the end
    const parts = line.split("|");
    if (parts.length < 3) continue;
    const hash = parts.pop()!;
    const author = parts.pop()!;
    const subject = parts.join("|").trim();

    if (/dependabot/i.test(author)) continue;
    if (NOISE.some((re) => re.test(subject))) continue;

    const match = subject.match(CONVENTIONAL);
    if (!match) continue;
    const type = match[1].toLowerCase();
    if (!TYPES.has(type)) continue;

    commits.push({
      type,
      subject: match[3].trim(),
      hash: hash.trim(),
    });
  }

  return commits;
}

function formatRange(): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const end = new Date();
  const start = new Date(end.getTime() - DAYS * 24 * 60 * 60 * 1000);
  return `${fmt(start)} – ${fmt(end)}`;
}

export function buildDigest(commits: Commit[]): string {
  if (commits.length === 0) return "";

  const body = SECTIONS.flatMap(({ title, types }) => {
    const items = commits.filter((c) => types.includes(c.type));
    if (items.length === 0) return [];
    return [title, ...items.map((c) => `- ${c.subject} (${c.hash})`), ""];
  });

  return [`## 🛹 Skatehive Dev Update — Week of ${formatRange()}`, "", ...body]
    .join("\n")
    .trimEnd();
}

/*
 * TODO(gabriel): wire this up once we have the @skatehive posting key as a
 * GitHub secret. @hiveio/dhive is already a dependency — no new install needed.
 *
 * async function broadcastDigestToHive(markdown: string) {
 *   const { Client, PrivateKey } = await import("@hiveio/dhive");
 *   const client = new Client("https://api.hive.blog");
 *   await client.broadcast.comment(
 *     {
 *       parent_author: "",
 *       parent_permlink: "hive-173115",
 *       author: process.env.HIVE_DIGEST_ACCOUNT!,
 *       permlink: `dev-update-${Date.now()}`,
 *       title: "Skatehive Dev Update",
 *       body: markdown,
 *       json_metadata: JSON.stringify({ tags: ["skatehive", "devlog"], app: "skatehive" }),
 *     },
 *     PrivateKey.fromString(process.env.HIVE_DIGEST_POSTING_KEY!)
 *   );
 * }
 */

// Only run when invoked directly, so tests can import the pure helpers.
if (process.argv[1]?.endsWith("generateDigest.ts")) {
  const digest = buildDigest(parse(gitLog()));
  if (digest) console.log(digest);
}
