import assert from "assert";
import { parse, buildDigest, resolveDays } from "../generateDigest";

// Fields are NUL-delimited, matching the git --pretty format the script uses.
// "|" appears in both a subject and an author name below on purpose.
const lines = [
  "feat(tip): add token dropdown\x00Gabriel\x00abc1234",
  "fix: trim amount before parseUnits\x00Gabriel\x00def5678",
  "Merge pull request #42 from SkateHive/foo\x00Gabriel\x001111111",
  "Merge branch 'main' into feat/x\x00Gabriel\x002222222",
  "chore(deps): bump next from 15.3.7 to 15.3.8\x00dependabot[bot]\x003333333",
  "chore: release v1.2.3\x00Gabriel\x004444444",
  "refactor: split the queue module\x00Vlad\x005555555",
  "random commit with no prefix\x00Gabriel\x006666666",
  "fix: handle a|b pipe in subject\x00Gabriel\x007777777",
  "perf: pipe in the author name\x00Foo|Bar\x008888888",
];

// DIGEST_DAYS comes from a workflow_dispatch input, so it is untrusted.
// A negative value used to reach git as an inverted range.
for (const [raw, want] of [
  ["7", 7],
  ["30", 30],
  ["1", 1],
  ["-2", 7],
  ["0", 7],
  ["abc", 7],
  ["", 7],
  [undefined, 7],
  ["3.9", 3],
  ["1e9", 3650],
  ["100000000", 3650],
  ["3650", 3650],
  ["3651", 3650],
] as [string | undefined, number][]) {
  assert.strictEqual(resolveDays(raw), want, `resolveDays(${JSON.stringify(raw)})`);
}

const commits = parse(lines);
assert.deepStrictEqual(
  commits.map((c) => `${c.type}:${c.subject}:${c.hash}`),
  [
    "feat:add token dropdown:abc1234",
    "fix:trim amount before parseUnits:def5678",
    "refactor:split the queue module:5555555",
    "fix:handle a|b pipe in subject:7777777",
    "perf:pipe in the author name:8888888",
  ]
);

const md = buildDigest(commits);
assert.ok(md.startsWith("## 🛹 Skatehive Dev Update — Week of "));
assert.ok(
  md.includes("![Skatehive Dev Update](https://skatehive.app/ogimage.png)"),
  "banner image sits below the heading"
);
assert.ok(md.includes("- add token dropdown (abc1234)"));
assert.ok(md.includes("- trim amount before parseUnits (def5678)"));
assert.ok(md.includes("- split the queue module (5555555)"));
assert.ok(
  md.includes("- pipe in the author name (8888888)"),
  "an author name containing | must not leak into the subject"
);
assert.ok(!md.includes("Docs"), "empty sections are omitted");

assert.ok(
  !buildDigest(commits).includes("Invalid Date"),
  "the date range must always render"
);

assert.strictEqual(buildDigest([]), "", "no commits -> no output");

console.log("✅ generateDigest tests passed");
