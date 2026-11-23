/**
 * Unit tests for USDC cofrinhos: wallet challenge + session, signature check,
 * owner rules and balance rounding. No network: on-chain verification is a
 * stub. The SQL side (constraints, atomic allocate, rollback) is covered by
 * scripts/test-0045-savings-jars-usdc.sh.
 * Run with: npx tsx lib/cofrinhos/__tests__/usdcJars.test.ts
 */

process.env.JWT_SECRET = "cofrinhos-test-secret";

import { privateKeyToAccount } from "viem/accounts";
import {
  buildChallenge,
  buildEvmChallenge,
  createEvmSessionToken,
  createSessionToken,
  verifyChallenge,
  verifyEvmChallenge,
  verifyEvmSessionToken,
  verifySessionToken,
} from "../auth";
import { floor3, verifyEvmSignature } from "../evm";
import {
  evmOwner,
  hiveOwner,
  normalizeEvmAddress,
  ownerColumns,
  ownerCurrency,
  ownerForCurrency,
  ownerKey,
  parseCurrency,
} from "../owner";

const tests: Array<() => void | Promise<void>> = [];
let hasFailures = false;

function describe(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

function it(name: string, fn: () => void | Promise<void>) {
  tests.push(async () => {
    try {
      await fn();
      console.log(`  ok ${name}`);
    } catch (error) {
      console.error(`  fail ${name}`);
      console.error(`     ${error}`);
      hasFailures = true;
    }
  });
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(`${message ?? "assertion"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function withNow<T>(now: number, fn: () => T): T {
  const real = Date.now;
  Date.now = () => now;
  try {
    return fn();
  } finally {
    Date.now = real;
  }
}

// Throwaway test keys (never funded).
const alice = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const bob = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const ALICE = alice.address.toLowerCase();
const BOB = bob.address.toLowerCase();

describe("owner rules", () => {
  it("normalizes addresses to lowercase and rejects malformed ones", () => {
    assertEqual(normalizeEvmAddress(alice.address), ALICE);
    assertEqual(normalizeEvmAddress("0x123"), null);
    assertEqual(normalizeEvmAddress("skater"), null);
    assertEqual(normalizeEvmAddress(undefined), null);
  });
  it("owner kind fixes the currency and the owner key", () => {
    assertEqual(ownerCurrency(hiveOwner("Skater")), "HBD");
    assertEqual(ownerCurrency(evmOwner(alice.address)), "USDC");
    assertEqual(ownerKey(hiveOwner("Skater")), "hive:skater");
    assertEqual(ownerKey(evmOwner(alice.address)), `evm:${ALICE}`);
  });
  it("fills exactly one owner column", () => {
    const h = ownerColumns(hiveOwner("skater"));
    assertEqual(h.hive_account, "skater");
    assertEqual(h.evm_address, null);
    const e = ownerColumns(evmOwner(alice.address));
    assertEqual(e.hive_account, null);
    assertEqual(e.evm_address, ALICE);
  });
  it("picks the signed-in owner for a currency", () => {
    const owners = [hiveOwner("skater"), evmOwner(alice.address)];
    assertEqual(ownerKey(ownerForCurrency(owners, "USDC")!), `evm:${ALICE}`);
    assertEqual(ownerForCurrency([hiveOwner("skater")], "USDC"), undefined);
  });
  it("parses currency, defaulting to HBD", () => {
    assertEqual(parseCurrency(undefined), "HBD");
    assertEqual(parseCurrency("usdc"), "USDC");
    assertEqual(parseCurrency("EUR"), null);
  });
});

describe("wallet challenge", () => {
  it("verifies a fresh challenge for the same address (any casing)", () => {
    const { message } = buildEvmChallenge(alice.address);
    const fields = verifyEvmChallenge(ALICE, message);
    if (!fields) throw new Error("expected fields");
    assertEqual(message.includes(`Wallet: ${ALICE}`), true, "message names the wallet");
  });
  it("rejects a challenge issued for another address", () => {
    const { message } = buildEvmChallenge(ALICE);
    assertEqual(verifyEvmChallenge(BOB, message), null);
  });
  it("rejects a tampered challenge", () => {
    const { message } = buildEvmChallenge(ALICE);
    assertEqual(verifyEvmChallenge(ALICE, message.replace(ALICE, BOB)), null);
    assertEqual(verifyEvmChallenge(ALICE, message + " "), null);
  });
  it("rejects an expired challenge", () => {
    const { message } = buildEvmChallenge(ALICE);
    withNow(Date.now() + 11 * 60 * 1000, () => {
      assertEqual(verifyEvmChallenge(ALICE, message), null);
    });
  });
  it("Hive and wallet challenges are not interchangeable", () => {
    const hive = buildChallenge("skater").message;
    const wallet = buildEvmChallenge(ALICE).message;
    assertEqual(verifyEvmChallenge(ALICE, hive), null);
    assertEqual(verifyChallenge("skater", wallet), null);
  });
  it("Hive challenges still verify as before", () => {
    const { message } = buildChallenge("Skater");
    if (!verifyChallenge("skater", message)) throw new Error("hive challenge broke");
  });
});

describe("wallet session token", () => {
  it("round-trips the address", () => {
    assertEqual(verifyEvmSessionToken(createEvmSessionToken(alice.address)), ALICE);
  });
  it("a Hive token is not a wallet token, and the other way round", () => {
    assertEqual(verifyEvmSessionToken(createSessionToken("skater")), null);
    assertEqual(verifySessionToken(createEvmSessionToken(ALICE)), null);
  });
  it("rejects a token whose body was swapped", () => {
    const [, sig] = createEvmSessionToken(ALICE).split(".");
    const [body] = createEvmSessionToken(BOB).split(".");
    assertEqual(verifyEvmSessionToken(`${body}.${sig}`), null);
  });
  it("expires after 7 days", () => {
    const token = createEvmSessionToken(ALICE);
    withNow(Date.now() + 8 * 24 * 60 * 60 * 1000, () => {
      assertEqual(verifyEvmSessionToken(token), null);
    });
  });
  it("rejects missing or malformed tokens", () => {
    assertEqual(verifyEvmSessionToken(undefined), null);
    assertEqual(verifyEvmSessionToken("abc"), null);
    assertEqual(verifyEvmSessionToken("a.b"), null);
  });
});

describe("wallet signature", () => {
  const neverOnChain = async () => {
    throw new Error("on-chain check should not run");
  };
  it("accepts a plain wallet's own signature without touching the chain", async () => {
    const { message } = buildEvmChallenge(ALICE);
    const signature = await alice.signMessage({ message });
    assertEqual(await verifyEvmSignature(ALICE, message, signature, neverOnChain), true);
  });
  it("rejects another wallet's signature when the chain says no", async () => {
    const { message } = buildEvmChallenge(ALICE);
    const signature = await bob.signMessage({ message });
    assertEqual(await verifyEvmSignature(ALICE, message, signature, async () => false), false);
  });
  it("rejects a signature over a different message", async () => {
    const { message } = buildEvmChallenge(ALICE);
    const signature = await alice.signMessage({ message: message + "x" });
    assertEqual(await verifyEvmSignature(ALICE, message, signature, async () => false), false);
  });
  it("defers to the on-chain check for smart-wallet signatures", async () => {
    let asked = false;
    const ok = await verifyEvmSignature(ALICE, "hi", "0x" + "ab".repeat(200), async () => {
      asked = true;
      return true;
    });
    assertEqual(asked, true);
    assertEqual(ok, true);
  });
  it("fails closed when the on-chain check errors", async () => {
    const ok = await verifyEvmSignature(ALICE, "hi", "0x" + "ab".repeat(200), async () => {
      throw new Error("rpc down");
    });
    assertEqual(ok, false);
  });
  it("rejects non-hex signatures before anything else", async () => {
    assertEqual(await verifyEvmSignature(ALICE, "hi", "nope", neverOnChain), false);
    assertEqual(await verifyEvmSignature(ALICE, "hi", "0xabc", neverOnChain), false);
  });
});

describe("balance rounding", () => {
  it("floors the on-chain USDC position to jar precision", () => {
    assertEqual(floor3(10.4999), 10.499);
    assertEqual(floor3(10.5), 10.5);
    assertEqual(floor3(0.0009), 0);
    assertEqual(floor3(0.1 + 0.2), 0.3);
  });
});

(async () => {
  for (const test of tests) await test();
  if (hasFailures) process.exit(1);
  console.log("\nAll USDC cofrinhos tests passed");
})();
