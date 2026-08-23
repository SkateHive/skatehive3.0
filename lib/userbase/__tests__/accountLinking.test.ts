/**
 * Unit tests for the multi-account linking helpers.
 * Run with tsx: npx tsx lib/userbase/__tests__/accountLinking.test.ts
 */

import assert from "node:assert";
import {
  resolveSessionHiveOwnership,
  resolveSessionHiveHandle,
  resolveMetadataSourceHandle,
  isAdditionalHiveLogin,
  isMultiAccountTransition,
  type LinkableIdentity,
  type SessionHiveOwnership,
} from "../accountLinking";

let hasFailures = false;

// Runs eagerly (rather than collecting into an array) so each case prints under
// the group header it belongs to.
function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (error) {
    hasFailures = true;
    console.error(`  ❌ ${name}`);
    console.error(`     ${error}`);
  }
}

const hive = (
  handle: string | null,
  is_primary = false
): LinkableIdentity => ({ type: "hive", handle, is_primary });
const evm = (): LinkableIdentity => ({ type: "evm", handle: null });

const owns = (handle: string): SessionHiveOwnership => ({
  status: "resolved",
  handle,
});
const ownsNothing: SessionHiveOwnership = { status: "none", handle: null };
const ownsAmbiguously: SessionHiveOwnership = {
  status: "ambiguous",
  handle: null,
};

console.log("\n📦 resolveSessionHiveOwnership");

it("no identities → none", () => {
  assert.deepStrictEqual(resolveSessionHiveOwnership([]), ownsNothing);
  assert.deepStrictEqual(resolveSessionHiveOwnership(null), ownsNothing);
  assert.deepStrictEqual(resolveSessionHiveOwnership(undefined), ownsNothing);
});

it("session without a Hive identity → none, not ambiguous", () => {
  assert.deepStrictEqual(resolveSessionHiveOwnership([evm()]), ownsNothing);
});

it("single Hive identity → resolved", () => {
  assert.deepStrictEqual(
    resolveSessionHiveOwnership([hive("alice")]),
    owns("alice")
  );
});

it("several identities, exactly one primary → resolved to that primary", () => {
  assert.deepStrictEqual(
    resolveSessionHiveOwnership([hive("alice"), hive("bob", true)]),
    owns("bob")
  );
});

it("several identities, none primary → ambiguous, distinct from none", () => {
  assert.deepStrictEqual(
    resolveSessionHiveOwnership([hive("alice"), hive("bob")]),
    ownsAmbiguously
  );
});

it("several identities, multiple primaries → ambiguous", () => {
  assert.deepStrictEqual(
    resolveSessionHiveOwnership([hive("alice", true), hive("bob", true)]),
    ownsAmbiguously
  );
});

console.log("\n📦 resolveSessionHiveHandle");

it("no identities → null", () => {
  assert.strictEqual(resolveSessionHiveHandle([]), null);
  assert.strictEqual(resolveSessionHiveHandle(null), null);
  assert.strictEqual(resolveSessionHiveHandle(undefined), null);
});

it("session without a Hive identity → null", () => {
  assert.strictEqual(resolveSessionHiveHandle([evm()]), null);
});

it("single Hive identity → that handle", () => {
  assert.strictEqual(resolveSessionHiveHandle([hive("alice")]), "alice");
});

it("several identities, exactly one primary → that primary", () => {
  const identities = [hive("alice"), hive("bob", true)];
  assert.strictEqual(resolveSessionHiveHandle(identities), "bob");
});

it("several identities, none primary → null (fail closed, no arbitrary pick)", () => {
  const identities = [hive("alice"), hive("bob")];
  assert.strictEqual(resolveSessionHiveHandle(identities), null);
});

it("several identities, multiple primaries → null (ambiguous)", () => {
  const identities = [hive("alice", true), hive("bob", true)];
  assert.strictEqual(resolveSessionHiveHandle(identities), null);
});

it("a single Hive identity resolves even without the primary flag", () => {
  assert.strictEqual(resolveSessionHiveHandle([hive("alice")]), "alice");
});

it("lowercases the handle", () => {
  assert.strictEqual(resolveSessionHiveHandle([hive("AlIcE")]), "alice");
});

it("skips Hive rows with a null handle", () => {
  const identities = [hive(null, true), hive("alice")];
  assert.strictEqual(resolveSessionHiveHandle(identities), "alice");
});

it("ignores non-Hive identities when picking", () => {
  const identities = [evm(), hive("alice")];
  assert.strictEqual(resolveSessionHiveHandle(identities), "alice");
});

console.log("\n📦 isAdditionalHiveLogin");

it("session owns no Hive, sole aioha account → false, so first-connect still prompts", () => {
  assert.strictEqual(isAdditionalHiveLogin(ownsNothing, "alice"), false);
  assert.strictEqual(isAdditionalHiveLogin(ownsNothing, "alice", {}), false);
  assert.strictEqual(isAdditionalHiveLogin(ownsNothing, "alice", null), false);
});

it("session owns no Hive but aioha holds other logins → true (can't attribute, don't offer)", () => {
  assert.strictEqual(
    isAdditionalHiveLogin(ownsNothing, "bob", { alice: "keychain" }),
    true
  );
});

it("ambiguous ownership, sole aioha account → true (must not take the none path)", () => {
  // The regression: with ownership collapsed to null this took the "no Hive
  // identity" branch and offered a stranger's account for linking.
  assert.strictEqual(isAdditionalHiveLogin(ownsAmbiguously, "carol", {}), true);
  assert.strictEqual(isAdditionalHiveLogin(ownsAmbiguously, "carol", null), true);
  assert.strictEqual(isAdditionalHiveLogin(ownsAmbiguously, "carol"), true);
});

it("ambiguous ownership → true even for an account the session may own", () => {
  assert.strictEqual(isAdditionalHiveLogin(ownsAmbiguously, "alice", {}), true);
});

it("no active aioha account → false", () => {
  assert.strictEqual(isAdditionalHiveLogin(owns("alice"), null), false);
  assert.strictEqual(isAdditionalHiveLogin(owns("alice"), undefined), false);
  assert.strictEqual(isAdditionalHiveLogin(ownsAmbiguously, null), false);
});

it("active account is the session owner → false", () => {
  assert.strictEqual(isAdditionalHiveLogin(owns("alice"), "alice"), false);
});

it("active account differs from the session owner → true", () => {
  assert.strictEqual(isAdditionalHiveLogin(owns("alice"), "bob"), true);
});

it("session owner set: other logins don't change the differ check", () => {
  assert.strictEqual(
    isAdditionalHiveLogin(owns("alice"), "alice", { bob: "keychain" }),
    false
  );
});

it("comparison is case-insensitive", () => {
  assert.strictEqual(isAdditionalHiveLogin(owns("alice"), "ALICE"), false);
});

console.log("\n📦 resolveMetadataSourceHandle");

it("session's own Hive identity always wins", () => {
  assert.strictEqual(
    resolveMetadataSourceHandle(owns("alice"), "bob", { bob: "keychain" }),
    "alice"
  );
});

it("no session Hive and no active account → null", () => {
  assert.strictEqual(resolveMetadataSourceHandle(ownsNothing, null, null), null);
});

it("no session Hive, single aioha account → that account", () => {
  assert.strictEqual(
    resolveMetadataSourceHandle(ownsNothing, "alice", {}),
    "alice"
  );
  assert.strictEqual(
    resolveMetadataSourceHandle(ownsNothing, "alice", null),
    "alice"
  );
});

it("no session Hive, several aioha accounts → null (owner can't be attributed)", () => {
  assert.strictEqual(
    resolveMetadataSourceHandle(ownsNothing, "bob", { alice: "keychain" }),
    null
  );
});

it("ambiguous ownership, sole aioha account → null (never falls back)", () => {
  // The regression: an ambiguous session must not mine the active account's
  // profile for linkable addresses just because aioha holds only that one.
  assert.strictEqual(
    resolveMetadataSourceHandle(ownsAmbiguously, "carol", {}),
    null
  );
  assert.strictEqual(
    resolveMetadataSourceHandle(ownsAmbiguously, "carol", null),
    null
  );
});

it("lowercases the fallback account", () => {
  assert.strictEqual(
    resolveMetadataSourceHandle(ownsNothing, "AlIcE", {}),
    "alice"
  );
});

console.log("\n📦 isMultiAccountTransition");

it("no previous account (first connection) → false", () => {
  assert.strictEqual(isMultiAccountTransition(null, { alice: "keychain" }), false);
  assert.strictEqual(isMultiAccountTransition(undefined, {}), false);
});

it("previous account not retained (logout then login) → false", () => {
  assert.strictEqual(isMultiAccountTransition("alice", {}), false);
  assert.strictEqual(isMultiAccountTransition("alice", null), false);
  assert.strictEqual(isMultiAccountTransition("alice", undefined), false);
});

it("previous account kept as an other login (switch or add) → true", () => {
  assert.strictEqual(
    isMultiAccountTransition("alice", { alice: "keychain" }),
    true
  );
});

it("a different account being held does not count", () => {
  assert.strictEqual(
    isMultiAccountTransition("alice", { carol: "keychain" }),
    false
  );
});

it("inherited Object properties are not mistaken for logins", () => {
  // A username like "toString" must not match Object.prototype.
  assert.strictEqual(isMultiAccountTransition("toString", {}), false);
  assert.strictEqual(isMultiAccountTransition("constructor", {}), false);
});

if (hasFailures) {
  console.error("\n❌ accountLinking tests failed\n");
  process.exit(1);
}
console.log("\n✅ accountLinking tests passed\n");
