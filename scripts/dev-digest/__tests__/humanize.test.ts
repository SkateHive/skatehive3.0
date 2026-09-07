import assert from "assert";
import { sectionsFromResponse, HUMANIZED_TITLES } from "../humanize";
import { renderDigest } from "../generateDigest";

// Happy path: plain JSON.
const ok = sectionsFromResponse(
  '{"features":["Spot photos load faster."],"fixes":["Link previews are safe again."],"internal":[]}'
);
assert.ok(ok, "plain JSON parses");
assert.deepStrictEqual(
  ok.map((s) => [s.title, s.items]),
  [
    [HUMANIZED_TITLES.features, ["Spot photos load faster."]],
    [HUMANIZED_TITLES.fixes, ["Link previews are safe again."]],
    [HUMANIZED_TITLES.internal, []],
  ]
);

// The model may fence the JSON despite instructions.
const fenced = sectionsFromResponse(
  'Here you go:\n```json\n{"features":["A thing shipped."],"fixes":[],"internal":[]}\n```'
);
assert.ok(fenced, "fenced JSON still parses");
assert.deepStrictEqual(fenced[0].items, ["A thing shipped."]);

// Non-string entries are dropped rather than rendered as "[object Object]".
const dirty = sectionsFromResponse(
  '{"features":["Real bullet",42,null,{"a":1},"  "],"fixes":[],"internal":[]}'
);
assert.ok(dirty, "mixed array still parses");
assert.deepStrictEqual(dirty[0].items, ["Real bullet"]);

// Missing keys are treated as empty, not as a crash.
const partial = sectionsFromResponse('{"features":["Only this"]}');
assert.ok(partial, "missing keys tolerated");
assert.deepStrictEqual(partial[1].items, []);

// Failures must return null so the caller falls back to raw subjects.
for (const bad of [
  "no json here at all",
  "{not valid json}",
  '{"features":[],"fixes":[],"internal":[]}', // empty rewrite is a failure
  '{"features":[1,2,3],"fixes":[],"internal":[]}', // nothing usable survives
  "[]",
  "null",
]) {
  assert.strictEqual(
    sectionsFromResponse(bad),
    null,
    `must reject: ${bad.slice(0, 40)}`
  );
}

// Rendering: humanized bullets carry no hashes, and empty sections vanish.
const md = renderDigest(ok);
assert.ok(md.startsWith("## 🛹 Skatehive Dev Update — Week of "));
assert.ok(md.includes("![Skatehive Dev Update](https://skatehive.app/ogimage.png)"));
assert.ok(md.includes("- Spot photos load faster."));
assert.ok(!md.includes("Under the hood"), "empty section omitted");
assert.ok(!/\([0-9a-f]{7,8}\)/.test(md), "no commit hashes in humanized output");

assert.strictEqual(renderDigest([]), "", "nothing to render -> empty string");
assert.strictEqual(
  renderDigest([{ title: HUMANIZED_TITLES.fixes, items: [] }]),
  "",
  "all-empty sections -> empty string"
);

console.log("✅ humanize tests passed");
