/**
 * Unit tests for the multi-account linking helpers.
 * Run with tsx: npx tsx lib/userbase/__tests__/accountLinking.test.ts
 */

import assert from "node:assert";
import {
  resolveSessionHiveHandle,
  resolveMetadataSourceHandle,
  isAdditionalHiveLogin,
  isMultiAccountTransition,
  type LinkableIdentity,
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

it("prefers the primary over the first", () => {
  const identities = [hive("alice"), hive("bob", true)];
  assert.strictEqual(resolveSessionHiveHandle(identities), "bob");
});

it("falls back to the first when none is primary", () => {
  const identities = [hive("alice"), hive("bob")];
  assert.strictEqual(resolveSessionHiveHandle(identities), "alice");
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

it("session owns no Hive → false, so first-connect still prompts", () => {
  assert.strictEqual(isAdditionalHiveLogin(null, "alice"), false);
});

it("no active aioha account → false", () => {
  assert.strictEqual(isAdditionalHiveLogin("alice", null), false);
  assert.strictEqual(isAdditionalHiveLogin("alice", undefined), false);
});

it("active account is the session owner → false", () => {
  assert.strictEqual(isAdditionalHiveLogin("alice", "alice"), false);
});

it("active account differs from the session owner → true", () => {
  assert.strictEqual(isAdditionalHiveLogin("alice", "bob"), true);
});

it("comparison is case-insensitive", () => {
  assert.strictEqual(isAdditionalHiveLogin("alice", "ALICE"), false);
});

console.log("\n📦 resolveMetadataSourceHandle");

it("session's own Hive identity always wins", () => {
  assert.strictEqual(
    resolveMetadataSourceHandle("alice", "bob", { bob: "keychain" }),
    "alice"
  );
});

it("no session Hive and no active account → null", () => {
  assert.strictEqual(resolveMetadataSourceHandle(null, null, null), null);
});

it("no session Hive, single aioha account → that account", () => {
  assert.strictEqual(resolveMetadataSourceHandle(null, "alice", {}), "alice");
  assert.strictEqual(resolveMetadataSourceHandle(null, "alice", null), "alice");
});

it("no session Hive, several aioha accounts → null (owner is ambiguous)", () => {
  assert.strictEqual(
    resolveMetadataSourceHandle(null, "bob", { alice: "keychain" }),
    null
  );
});

it("lowercases the fallback account", () => {
  assert.strictEqual(resolveMetadataSourceHandle(null, "AlIcE", {}), "alice");
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
