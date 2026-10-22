import * as dhive from "@hiveio/dhive";
import {
  assessInviteClaim,
  ChainAccount,
  INVITE_MAIL_WINDOW_MS,
} from "../verifyNewAccount";

const USERNAME = "newskater";
const PASSWORD = "SKATE000P5Kexampleexample";
const NOW = Date.parse("2026-09-29T12:00:00Z");

let failures = 0;

function check(name: string, pass: boolean, detail = "") {
  if (pass) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.log(`  ❌ ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

function ownerPubkey(username: string, password: string) {
  return dhive.PrivateKey.fromLogin(username, password, "owner")
    .createPublic()
    .toString();
}

/** Hive's shape: `created` in UTC with no zone marker. */
function account(overrides: Partial<ChainAccount> = {}): ChainAccount {
  return {
    name: USERNAME,
    created: "2026-09-29T11:58:00",
    recovery_account: "inviter",
    owner: { key_auths: [[ownerPubkey(USERNAME, PASSWORD), 1]] },
    ...overrides,
  };
}

console.log("🔑 assessInviteClaim — only the account's creator can mail its keys");

const good = assessInviteClaim(account(), USERNAME, PASSWORD, NOW);
check("the creator's master password is accepted", good.ok);
if (good.ok) {
  check(
    "the creator is read from the chain, not the request",
    good.createdBy === "inviter"
  );
  check(
    "keys are derived server-side and match the owner on chain",
    good.keys.ownerPubkey === ownerPubkey(USERNAME, PASSWORD) &&
      ["owner", "active", "posting", "memo"].every((r) => good.keys[r]?.startsWith("5"))
  );
}

// The attack this file exists for: an existing account name and a password the
// caller made up. Before, the route mailed whatever it was given.
check(
  "a guessed password for a real account is refused",
  JSON.stringify(assessInviteClaim(account(), USERNAME, "SKATE000wrongwrongwrong1", NOW)) ===
    JSON.stringify({ ok: false, reason: "key_mismatch" })
);

check(
  "a missing account is not_found, so the caller can wait for the block",
  JSON.stringify(assessInviteClaim(null, USERNAME, PASSWORD, NOW)) ===
    JSON.stringify({ ok: false, reason: "not_found" })
);

check(
  "an account under another name is not_found",
  !assessInviteClaim(account({ name: "someoneelse" }), USERNAME, PASSWORD, NOW).ok
);

check(
  "an account older than the window is refused",
  JSON.stringify(
    assessInviteClaim(account({ created: "2026-09-27T11:58:00" }), USERNAME, PASSWORD, NOW)
  ) === JSON.stringify({ ok: false, reason: "too_old" })
);

// Checked the other way round, an old account answered key_mismatch or too_old
// depending on the guess, which let anyone test passwords against it.
check(
  "an old account answers too_old whether or not the password is right",
  JSON.stringify(
    assessInviteClaim(account({ created: "2026-09-27T11:58:00" }), USERNAME, "SKATE000wrongwrongwrong1", NOW)
  ) === JSON.stringify({ ok: false, reason: "too_old" })
);

check(
  "the window edge still counts as fresh",
  assessInviteClaim(
    account({ created: new Date(NOW - INVITE_MAIL_WINDOW_MS).toISOString().slice(0, 19) }),
    USERNAME,
    PASSWORD,
    NOW
  ).ok
);

check(
  "an unparseable creation date is refused, not treated as fresh",
  !assessInviteClaim(account({ created: "not a date" }), USERNAME, PASSWORD, NOW).ok
);

// dhive may hand back PublicKey objects instead of strings.
check(
  "owner keys given as PublicKey objects still match",
  assessInviteClaim(
    account({
      owner: { key_auths: [[dhive.PublicKey.fromString(ownerPubkey(USERNAME, PASSWORD)), 1]] },
    }),
    USERNAME,
    PASSWORD,
    NOW
  ).ok
);

if (failures > 0) {
  console.error(`\n❌ ${failures} verifyNewAccount test(s) failed`);
  process.exit(1);
}
console.log("\n✨ All verifyNewAccount tests passed!");
