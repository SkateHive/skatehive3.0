import { assessInviteReservation, QuotaVerdict } from "../inviteQuota";

const LIMIT = 10;
const ID = "7d4f3c1e-0000-4000-8000-000000000001";

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

const UNAVAILABLE: QuotaVerdict = { allow: false, reason: "unavailable" };

console.log("🔒 assessInviteReservation — an unclear answer must never read as a yes");

// The regression family this file exists for: a failure that arrives looking
// like a successful empty answer.
check("null data with no error is unavailable", assessInviteReservation(null, null, LIMIT), UNAVAILABLE);
check("an empty result is unavailable", assessInviteReservation([], null, LIMIT), UNAVAILABLE);
check(
  "more than one row is unavailable",
  assessInviteReservation(
    [{ reservation_id: ID, used: 0 }, { reservation_id: ID, used: 0 }],
    null,
    LIMIT
  ),
  UNAVAILABLE
);
check(
  "an error is unavailable even when a row came with it",
  assessInviteReservation([{ reservation_id: ID, used: 0 }], { message: "boom" }, LIMIT),
  UNAVAILABLE
);
check(
  "a missing used count is unavailable",
  assessInviteReservation([{ reservation_id: ID }], null, LIMIT),
  UNAVAILABLE
);
check(
  "a NaN used count is unavailable",
  assessInviteReservation([{ reservation_id: ID, used: NaN }], null, LIMIT),
  UNAVAILABLE
);
check(
  "a negative used count is unavailable",
  assessInviteReservation([{ reservation_id: ID, used: -1 }], null, LIMIT),
  UNAVAILABLE
);
check(
  "a missing reservation id is unavailable, not exhausted",
  assessInviteReservation([{ used: 0 }], null, LIMIT),
  UNAVAILABLE
);
check(
  "an empty reservation id is unavailable",
  assessInviteReservation([{ reservation_id: "", used: 0 }], null, LIMIT),
  UNAVAILABLE
);

console.log("📊 the cap itself");

check(
  "a claimed slot is allowed",
  assessInviteReservation([{ reservation_id: ID, used: 0 }], null, LIMIT),
  { allow: true, reservationId: ID, used: 0 }
);
check(
  "the last slot is allowed",
  assessInviteReservation([{ reservation_id: ID, used: LIMIT - 1 }], null, LIMIT),
  { allow: true, reservationId: ID, used: LIMIT - 1 }
);
check(
  "a null id means the cap is spent",
  assessInviteReservation([{ reservation_id: null, used: LIMIT }], null, LIMIT),
  { allow: false, reason: "exhausted", limit: LIMIT }
);

if (failures > 0) {
  console.error(`\n❌ ${failures} inviteQuota test(s) failed`);
  process.exit(1);
}
console.log("\n✨ All inviteQuota tests passed!");
