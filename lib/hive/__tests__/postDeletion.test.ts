import assert from "assert";
import { canDeleteOnChain, PAID_OUT_CASHOUT } from "../postDeletion";

const fresh = { children: 0, cashout_time: "2026-10-20T12:00:00", net_rshares: 0, active_votes: [] };

assert.strictEqual(canDeleteOnChain(fresh), true, "fresh post with no votes or replies is deletable");

assert.strictEqual(
  canDeleteOnChain({ ...fresh, children: 1 }),
  false,
  "a reply blocks delete_comment"
);
assert.strictEqual(
  canDeleteOnChain({ ...fresh, net_rshares: "1200000" }),
  false,
  "net positive votes block delete_comment"
);
assert.strictEqual(
  canDeleteOnChain({ ...fresh, net_rshares: "-500" }),
  true,
  "a net-downvoted post can still be deleted"
);
assert.strictEqual(
  canDeleteOnChain({ ...fresh, cashout_time: PAID_OUT_CASHOUT }),
  false,
  "a paid-out post can't be deleted"
);

// Feeds without net_rshares fall back to the vote list.
const { net_rshares: _omit, ...noRshares } = fresh;
assert.strictEqual(
  canDeleteOnChain({ ...noRshares, active_votes: [{ rshares: "900" }] }),
  false,
  "an upvote in active_votes blocks delete when net_rshares is missing"
);
assert.strictEqual(
  canDeleteOnChain({ ...noRshares, active_votes: [{ percent: -10000 }] }),
  true,
  "only downvotes in active_votes still allow delete"
);

console.log("✅ postDeletion tests passed");
