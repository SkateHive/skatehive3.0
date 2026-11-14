import {
  generatePassword,
  isGeneratedInvitePassword,
} from "../helpers";

let failures = 0;

function check(name: string, pass: boolean, detail = "") {
  if (pass) {
    console.log(`  ✅ ${name}`);
  } else {
    failures++;
    console.log(`  ❌ ${name}${detail ? `\n      ${detail}` : ""}`);
  }
}

console.log("\n🔑 invite password shape\n");

// The route rejects anything this pattern refuses, so a drift between the two
// would silently stop every paid invite from sending its email.
const rejected = Array.from({ length: 2000 }, generatePassword).filter(
  (password) => !isGeneratedInvitePassword(password)
);
check(
  "every generated password is accepted",
  rejected.length === 0,
  `rejected: ${rejected.slice(0, 3).join(", ")}`
);

const crafted: Array<[string, unknown]> = [
  ["phishing text", "Your account is suspended, log in at skatehive-login.co"],
  ["right prefix, free text after", "SKATE0005Hvisit evil.co now"],
  ["right length, not base58", "SKATE0005Hl0OIl0OIl0OIl0O"],
  ["one character too long", "SKATE0005HabcdefghijkmnopQ"],
  ["one character too short", "SKATE0005Habcdefghijkmno"],
  ["missing prefix", "5HabcdefghijkmnopqrstuvwxyzAB"],
  ["trailing newline", "SKATE0005Habcdefghijkmnop\n"],
  ["empty string", ""],
  ["not a string", 12345],
  ["undefined", undefined],
];
for (const [label, value] of crafted) {
  check(`rejects ${label}`, !isGeneratedInvitePassword(value));
}

if (failures > 0) {
  console.error(`\n❌ ${failures} invitePassword test(s) failed`);
  process.exit(1);
}
console.log("\n✨ All invitePassword tests passed!");
