import assert from "node:assert/strict";
import { LinkCodeRequestGuard } from "../linkCodeRequest";

// A response that arrives after an account switch must not be shown.
{
  const g = new LinkCodeRequestGuard();
  const t = g.begin();
  assert.equal(g.isCurrent(t), true);
  g.invalidate(); // user A -> user B while the request is in flight
  assert.equal(g.isCurrent(t), false);
}

// Only the latest of overlapping requests applies.
{
  const g = new LinkCodeRequestGuard();
  const first = g.begin();
  const second = g.begin();
  assert.equal(g.isCurrent(first), false);
  assert.equal(g.isCurrent(second), true);
}

// Simulated in-flight switch with a real promise.
(async () => {
  const g = new LinkCodeRequestGuard();
  let shown: string | null = null;
  let resolve!: (code: string) => void;
  const pending = new Promise<string>((r) => (resolve = r));
  const token = g.begin();
  const apply = pending.then((code) => {
    if (g.isCurrent(token)) shown = code;
  });
  g.invalidate(); // account changed before the API answered
  resolve("SK-USERACOD");
  await apply;
  assert.equal(shown, null);
})()
  .then(() => console.log("linkCodeRequest: ok"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
