import assert from "assert";
import { parse, buildDigest } from "../generateDigest";

const lines = [
  "feat(tip): add token dropdown|Gabriel|abc1234",
  "fix: trim amount before parseUnits|Gabriel|def5678",
  "Merge pull request #42 from SkateHive/foo|Gabriel|1111111",
  "Merge branch 'main' into feat/x|Gabriel|2222222",
  "chore(deps): bump next from 15.3.7 to 15.3.8|dependabot[bot]|3333333",
  "chore: release v1.2.3|Gabriel|4444444",
  "refactor: split the queue module|Vlad|5555555",
  "random commit with no prefix|Gabriel|6666666",
  "fix: handle a|b pipe in subject|Gabriel|7777777",
];

const commits = parse(lines);
assert.deepStrictEqual(
  commits.map((c) => `${c.type}:${c.subject}:${c.hash}`),
  [
    "feat:add token dropdown:abc1234",
    "fix:trim amount before parseUnits:def5678",
    "refactor:split the queue module:5555555",
    "fix:handle a|b pipe in subject:7777777",
  ]
);

const md = buildDigest(commits);
assert.ok(md.startsWith("## 🛹 Skatehive Dev Update — Week of "));
assert.ok(
  md.includes("![Skatehive Dev Update](https://skatehive.app/ogimage.png)"),
  "banner image sits below the heading"
);
assert.ok(md.includes("### 🆕 New Features\n- add token dropdown (abc1234)"));
assert.ok(md.includes("### 🐛 Fixes\n- trim amount before parseUnits (def5678)"));
assert.ok(md.includes("### 🔧 Under the hood\n- split the queue module (5555555)"));
assert.ok(!md.includes("### 📚 Docs"), "empty sections are omitted");

assert.strictEqual(buildDigest([]), "", "no commits -> no output");

console.log("✅ generateDigest tests passed");
