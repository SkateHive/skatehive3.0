import assert from "assert";
import { sectionsFromResponse, HUMANIZED_TITLES } from "../humanize";
import { renderDigest } from "../generateDigest";

const N = 5; // pretend the week had 5 commits, numbered 1..5

// Happy path: plain JSON, every bullet grounded in real commit numbers.
const ok = sectionsFromResponse(
  '{"features":[{"text":"Spot photos load faster.","commits":[1,2]}],' +
    '"fixes":[{"text":"Link previews are safe again.","commits":[3]}],' +
    '"internal":[{"text":"Groundwork you will not notice.","commits":[4,5]}]}',
  N
);
assert.ok(ok, "plain JSON parses");
assert.deepStrictEqual(
  ok.map((s) => [s.title, s.items]),
  [
    [HUMANIZED_TITLES.features, ["Spot photos load faster."]],
    [HUMANIZED_TITLES.fixes, ["Link previews are safe again."]],
    [HUMANIZED_TITLES.internal, ["Groundwork you will not notice."]],
  ]
);

// The model may fence the JSON despite instructions.
const fenced = sectionsFromResponse(
  'Here you go:\n```json\n{"features":[{"text":"A thing shipped.","commits":[1]}],"fixes":[],"internal":[]}\n```',
  N
);
assert.ok(fenced, "fenced JSON still parses");
assert.deepStrictEqual(fenced[0].items, ["A thing shipped."]);

// Grounding: a fabricated bullet citing nothing real must not render.
const fabricated = sectionsFromResponse(
  '{"features":[{"text":"Real one.","commits":[1]},' +
    '{"text":"We added NFT support!","commits":[]},' +
    '{"text":"Out of range.","commits":[99]},' +
    '{"text":"Not a number.","commits":["1"]},' +
    '{"text":"Fractional.","commits":[1.5]}],' +
    '"fixes":[],"internal":[]}',
  N
);
assert.ok(fabricated, "survives with the grounded bullet");
assert.deepStrictEqual(
  fabricated[0].items,
  ["Real one."],
  "only the bullet citing a real commit survives"
);

// Partially valid citations still ground the bullet.
const partialCites = sectionsFromResponse(
  '{"features":[{"text":"Mixed cites.","commits":[99,2]}],"fixes":[],"internal":[]}',
  N
);
assert.ok(partialCites);
assert.deepStrictEqual(partialCites[0].items, ["Mixed cites."]);

// Malformed entries are dropped, not rendered as "[object Object]".
const dirty = sectionsFromResponse(
  '{"features":[{"text":"Kept.","commits":[1]},42,null,"bare string",' +
    '{"commits":[2]},{"text":"   ","commits":[3]}],"fixes":[],"internal":[]}',
  N
);
assert.ok(dirty);
assert.deepStrictEqual(dirty[0].items, ["Kept."]);

// Missing keys are treated as empty, not as a crash.
const partial = sectionsFromResponse(
  '{"features":[{"text":"Only this.","commits":[1]}]}',
  N
);
assert.ok(partial, "missing keys tolerated");
assert.deepStrictEqual(partial[1].items, []);

// Failures must return null so the caller falls back to raw subjects.
for (const bad of [
  "no json here at all",
  "{not valid json}",
  '{"features":[],"fixes":[],"internal":[]}', // empty rewrite is a failure
  '{"features":[{"text":"Ungrounded.","commits":[]}],"fixes":[],"internal":[]}',
  '{"features":[{"text":"All out of range.","commits":[42]}],"fixes":[],"internal":[]}',
  "[]",
  "null",
]) {
  assert.strictEqual(
    sectionsFromResponse(bad, N),
    null,
    `must reject: ${bad.slice(0, 45)}`
  );
}

// A zero-commit week can ground nothing, so nothing can survive.
assert.strictEqual(
  sectionsFromResponse('{"features":[{"text":"x","commits":[1]}]}', 0),
  null,
  "no commits -> nothing is groundable"
);

// Rendering: humanized bullets carry no hashes, and empty sections vanish.
const md = renderDigest(ok);
assert.ok(md.startsWith("## 🛹 Skatehive Dev Update — Week of "));
assert.ok(md.includes("![Skatehive Dev Update](https://skatehive.app/ogimage.png)"));
assert.ok(md.includes("- Spot photos load faster."));
assert.ok(!/\([0-9a-f]{7,8}\)/.test(md), "no commit hashes in humanized output");
assert.ok(!/\[\d+\]/.test(md), "no citation arrays leak into the text");

assert.ok(
  !renderDigest(fenced).includes("Under the hood"),
  "empty section omitted"
);
assert.strictEqual(renderDigest([]), "", "nothing to render -> empty string");
assert.strictEqual(
  renderDigest([{ title: HUMANIZED_TITLES.fixes, items: [] }]),
  "",
  "all-empty sections -> empty string"
);

console.log("✅ humanize tests passed");
