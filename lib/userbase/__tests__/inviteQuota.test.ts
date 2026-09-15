import { assessInviteQuota, QuotaVerdict } from "../inviteQuota";

const LIMIT = 10;

let failures = 0;

function check(name: string, actual: QuotaVerdict, expected: QuotaVerdict) {
  const got = JSON.stringify(actual);
  const want = JSON.stringify(expected);
  if (got === want) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.log(`  ❌ ${name}\n      expected ${want}\n      got      ${got}`);
  }
}

console.log("🔒 assessInviteQuota — an unknown count must never read as zero");

// The regression this file exists for. Supabase answers a count query against a
// missing table with { error: null, count: null } and a 204, so the failure
// arrives looking exactly like a successful "no invites yet".
check(
  "null count with no error is unavailable, not zero",
  assessInviteQuota(null, null, LIMIT),
  { allow: false, reason: "unavailable" }
);

check(
  "undefined count is unavailable",
  assessInviteQuota(undefined, null, LIMIT),
  { allow: false, reason: "unavailable" }
);

check(
  "NaN is unavailable",
  assessInviteQuota(NaN, null, LIMIT),
  { allow: false, reason: "unavailable" }
);

check(
  "a negative count is unavailable",
  assessInviteQuota(-1, null, LIMIT),
  { allow: false, reason: "unavailable" }
);

check(
  "an error is unavailable even when a count came with it",
  assessInviteQuota(0, { message: "boom" }, LIMIT),
  { allow: false, reason: "unavailable" }
);

console.log("📊 the cap itself");

check("no invites yet is allowed", assessInviteQuota(0, null, LIMIT), {
  allow: true,
  used: 0,
});

check("one below the cap is allowed", assessInviteQuota(LIMIT - 1, null, LIMIT), {
  allow: true,
  used: LIMIT - 1,
});

check("exactly at the cap is exhausted", assessInviteQuota(LIMIT, null, LIMIT), {
  allow: false,
  reason: "exhausted",
  limit: LIMIT,
});

check(
  "over the cap is exhausted",
  assessInviteQuota(LIMIT + 5, null, LIMIT),
  { allow: false, reason: "exhausted", limit: LIMIT }
);

if (failures > 0) {
  console.error(`\n❌ ${failures} inviteQuota test(s) failed`);
  process.exit(1);
}
console.log("\n✨ All inviteQuota tests passed!");
