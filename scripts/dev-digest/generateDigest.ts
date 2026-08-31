/**
 * Dev Update digest — turns the last 7 days of commits on the checked-out
 * branch into Hive-flavored markdown. Prints to stdout; prints nothing when
 * there's nothing worth posting.
 *
 * Run: pnpm tsx scripts/dev-digest/generateDigest.ts
 *
 * DRY RUN: nothing is broadcast to Hive yet. See broadcastDigestToHive() below.
 */

import { execFileSync } from "child_process";

// Served by Next.js from public/ogimage.png at the site root.
const DEFAULT_DIGEST_IMAGE_URL = "https://skatehive.app/ogimage.png";

// DIGEST_DAYS widens the window for manual testing / backfilling a missed week.
// It arrives from a workflow_dispatch input, so it is untrusted: a negative
// value would hand git an inverted range and publish a backwards date header.
// Ten years. Past roughly 1e8 days the Date math overflows and the heading
// renders "Invalid Date"; nothing legitimate needs a wider window anyway.
const MAX_DAYS = 3650;

export function resolveDays(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 7;
  return Math.min(Math.floor(n), MAX_DAYS);
}

const DAYS = resolveDays(process.env.DIGEST_DAYS);

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
  // HEAD first, so the digest reflects the branch that was actually checked
  // out. Preferring origin/main here silently digests a stale remote ref when
  // the workflow is dispatched against a feature branch.
  const ref = ["HEAD", "main", "origin/main"].find((r) => {
    try {
      execFileSync("git", ["rev-parse", "--verify", r], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  })!;

  return execFileSync(
    "git",
    // NUL-delimited fields: neither a subject nor an author name can contain
    // one, whereas "|" can appear in both. Records stay newline-separated --
    // %s is a single line by definition and git forbids LF in ident fields.
    ["log", `--since=${DAYS} days ago`, "--pretty=format:%s%x00%an%x00%h", ref],
    { encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean);
}

export function parse(lines: string[]): Commit[] {
  const commits: Commit[] = [];

  for (const line of lines) {
    const [rawSubject, author, hash] = line.split("\x00");
    if (!rawSubject || !author || !hash) continue;
    const subject = rawSubject.trim();

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

  return [
    `## 🛹 Skatehive Dev Update — Week of ${formatRange()}`,
    "",
    `![Skatehive Dev Update](${DEFAULT_DIGEST_IMAGE_URL})`,
    "",
    ...body,
  ]
    .join("\n")
    .trimEnd();
}

/*
 * TODO(gabriel): wire this up once we have the @skatehive posting key as a
 * GitHub secret. @hiveio/dhive is already a dependency — no new install needed.
 *
 * When wiring this up, json_metadata.image MUST be set to
 * [DEFAULT_DIGEST_IMAGE_URL]. That is what makes Hive frontends (peakd,
 * ecency, skatehive itself) render it as the post's thumbnail/preview — it is
 * separate from, and not inferred from, the inline image in the body.
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
 *       json_metadata: JSON.stringify({
 *         tags: ["skatehive", "devlog"],
 *         app: "skatehive",
 *         image: [DEFAULT_DIGEST_IMAGE_URL], // drives the frontend thumbnail
 *       }),
 *     },
 *     PrivateKey.fromString(process.env.HIVE_DIGEST_POSTING_KEY!)
 *   );
 * }
 */

// Only run when invoked directly, so tests can import the pure helpers.
if (process.argv[1]?.endsWith("generateDigest.ts")) {
  // --print-days lets the workflow report the window the digest actually used,
  // instead of echoing back a raw input this script may have rejected.
  if (process.argv.includes("--print-days")) {
    console.log(DAYS);
  } else {
    const digest = buildDigest(parse(gitLog()));
    if (digest) console.log(digest);
  }
}
