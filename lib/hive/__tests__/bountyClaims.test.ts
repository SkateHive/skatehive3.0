import assert from "node:assert/strict";
import { isActiveBountyClaim } from "../bountyClaims";

const votes = [
  { voter: "xvlad", percent: 10000 },
  { voter: "blessskateshop", percent: 10000 },
  ...Array.from({ length: 20 }, (_, i) => ({ voter: `trail-${i}`, percent: 0 })),
  { voter: "downvoter", percent: -10000 },
  { voter: "Tallessilva", percent: 10000 },
  { voter: "missing-weight" },
];
assert.deepEqual(votes.filter(v => isActiveBountyClaim(v, "tallessilva")).map(v => v.voter),
  ["xvlad", "blessskateshop"]);
assert.equal(isActiveBountyClaim({ voter: "low-hp", percent: 1 }, "tallessilva"), true);
assert.equal(isActiveBountyClaim({ percent: 10000 }, "tallessilva"), false);
console.log("Bounty claims: zeroed trail votes, downvotes and author excluded; legitimate claims preserved");
