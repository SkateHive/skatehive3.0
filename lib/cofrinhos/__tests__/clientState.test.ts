import assert from "assert";
import { selectOwnJars, toUsdcUnits, usdcUnitsToJarAmount } from "../clientState";

const hiveJar = { id: "h", currency: "HBD" as const, hive_account: "skater", evm_address: null };
const usdcJar = { id: "u", currency: "USDC" as const, hive_account: null, evm_address: "0xabc" };
const otherUsdc = { id: "x", currency: "USDC" as const, hive_account: null, evm_address: "0xdef" };
const balances = { HBD: { savings: 10 }, USDC: { savings: 20 } };

// Both sessions match the connected identities: everything shows.
let own = selectOwnJars({ account: "skater", evm_address: "0xabc", jars: [hiveJar, usdcJar], balances }, "skater", "0xabc");
assert.deepStrictEqual(own.jars.map((j) => j.id), ["h", "u"]);
assert.deepStrictEqual(Object.keys(own.balances).sort(), ["HBD", "USDC"]);
assert.strictEqual(own.staleHive || own.staleEvm, false);

// Wallet-only user: only USDC, and no Hive session to clear.
own = selectOwnJars({ account: null, evm_address: "0xabc", jars: [usdcJar], balances: { USDC: balances.USDC } }, null, "0xabc");
assert.deepStrictEqual(own.jars.map((j) => j.id), ["u"]);
assert.deepStrictEqual(Object.keys(own.balances), ["USDC"]);
assert.strictEqual(own.hiveOk, false);
assert.strictEqual(own.staleHive, false);

// Wallet switched: the old wallet's cookie is stale, its jars and balance are dropped.
own = selectOwnJars({ account: "skater", evm_address: "0xdef", jars: [hiveJar, otherUsdc], balances }, "skater", "0xabc");
assert.deepStrictEqual(own.jars.map((j) => j.id), ["h"]);
assert.deepStrictEqual(Object.keys(own.balances), ["HBD"]);
assert.strictEqual(own.staleEvm, true);
assert.strictEqual(own.staleHive, false);

// Hive account switched while the wallet stays: Hive side dropped.
own = selectOwnJars({ account: "skater", evm_address: "0xabc", jars: [hiveJar, usdcJar], balances }, "other", "0xabc");
assert.deepStrictEqual(own.jars.map((j) => j.id), ["u"]);
assert.strictEqual(own.staleHive, true);

// Disconnected wallet: nothing USDC leaks through.
own = selectOwnJars({ account: null, evm_address: "0xabc", jars: [usdcJar], balances }, null, null);
assert.deepStrictEqual(own.jars, []);
assert.deepStrictEqual(own.balances, {});
assert.strictEqual(own.staleEvm, true);

// Amount conversions
assert.strictEqual(toUsdcUnits(12.345), 12_345_000n);
assert.strictEqual(toUsdcUnits(0.001), 1_000n);
assert.strictEqual(toUsdcUnits(0.1 + 0.2), 300_000n, "float noise is rounded to the jar precision");
assert.strictEqual(usdcUnitsToJarAmount(12_345_999n), 12.345, "floors, never rounds up");
assert.strictEqual(usdcUnitsToJarAmount(999n), 0);
assert.strictEqual(usdcUnitsToJarAmount(undefined), 0);
assert.strictEqual(usdcUnitsToJarAmount(-5n), 0);
assert.strictEqual(usdcUnitsToJarAmount(1_000_000_000_000n), 1_000_000);

console.log("cofrinhos clientState tests passed");
