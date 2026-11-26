/**
 * Unit tests for Skate Wallet / KeepKey detection used by the connect modal.
 * Run with tsx: npx tsx lib/wallet/__tests__/injectedWallets.test.ts
 */

import {
  KEEPKEY_HIVE_UNSUPPORTED_ERROR,
  SKATE_WALLET_RDNS,
  hasSkateWalletHiveFlag,
  isKeepKeyHiveKeychain,
  isKeepKeyHiveUnsupportedError,
  isKeepKeyIdentity,
  isSkateWalletIdentity,
} from "../injectedWallets";

const tests: Array<() => void> = [];
let hasFailures = false;
const it = (name: string, fn: () => void) =>
  tests.push(() => {
    try {
      fn();
      console.log(`  ✅ ${name}`);
    } catch (error) {
      console.error(`  ❌ ${name}\n     ${error}`);
      hasFailures = true;
    }
  });
const ok = (cond: boolean, msg: string) => {
  if (!cond) throw new Error(msg);
};

it("detects the Skate Wallet by its EIP-6963 rdns", () => {
  ok(isSkateWalletIdentity({ rdns: SKATE_WALLET_RDNS, name: "Skate Wallet" }), "info rdns");
  ok(isSkateWalletIdentity({ id: SKATE_WALLET_RDNS, name: "Skate Wallet" }), "wagmi connector id");
  ok(isSkateWalletIdentity({ rdns: [SKATE_WALLET_RDNS] }), "rdns array");
});

it("does not mistake MetaMask-compatible wallets for the Skate Wallet", () => {
  ok(!isSkateWalletIdentity({ rdns: "io.metamask", name: "MetaMask" }), "metamask");
  ok(!isSkateWalletIdentity({ id: "injected", name: "Skate Wallet" }), "name alone is not enough");
});

it("detects KeepKey by rdns or name", () => {
  ok(isKeepKeyIdentity({ rdns: "com.keepkey.client" }), "rdns");
  ok(isKeepKeyIdentity({ id: "injected", name: "KeepKey Client" }), "name");
  ok(!isKeepKeyIdentity({ rdns: "io.rabby", name: "Rabby Wallet" }), "rabby");
});

it("reads the isSkateWallet flag on window.hive_keychain", () => {
  ok(hasSkateWalletHiveFlag({ hive_keychain: { isSkateWallet: true } }), "flag set");
  ok(!hasSkateWalletHiveFlag({ hive_keychain: {} }), "plain keychain");
  ok(!hasSkateWalletHiveFlag({}), "no keychain");
  ok(!hasSkateWalletHiveFlag(undefined), "no window");
});

it("recognises the KeepKey Hive sign error by key or translated text", () => {
  ok(isKeepKeyHiveUnsupportedError(KEEPKEY_HIVE_UNSUPPORTED_ERROR), "key");
  ok(isKeepKeyHiveUnsupportedError({ messageKey: KEEPKEY_HIVE_UNSUPPORTED_ERROR }), "messageKey");
  ok(
    isKeepKeyHiveUnsupportedError("KeepKey supports Hive transfers only for now. This operation is coming soon."),
    "english text"
  );
  ok(
    isKeepKeyHiveUnsupportedError({ message: "Por enquanto a KeepKey só faz transferências Hive." }),
    "portuguese text"
  );
  ok(!isKeepKeyHiveUnsupportedError("Request was canceled by the user."), "user cancel");
  ok(!isKeepKeyHiveUnsupportedError(undefined), "undefined");
});

it("tells the KeepKey Client's hive_keychain shim apart from real Keychains", () => {
  const shim = { current_id: 1, requestHandshake: () => {} };
  const keychain = { current_id: 1, requests: {}, requestHandshake: () => {} };
  ok(isKeepKeyHiveKeychain({ hive_keychain: { ...shim, isKeepKey: true } }), "flagged shim");
  ok(isKeepKeyHiveKeychain({ hive_keychain: shim }, true), "unflagged shim, KeepKey announced");
  ok(!isKeepKeyHiveKeychain({ hive_keychain: shim }), "unflagged shim, no KeepKey on EVM");
  ok(!isKeepKeyHiveKeychain({ hive_keychain: keychain }, true), "real Keychain next to KeepKey");
  ok(!isKeepKeyHiveKeychain({ hive_keychain: { ...shim, isSkateWallet: true } }, true), "Skate Wallet");
  ok(!isKeepKeyHiveKeychain({}, true), "no keychain");
  ok(!isKeepKeyHiveKeychain(undefined, true), "no window");
});

console.log("injectedWallets");
tests.forEach((t) => t());
if (hasFailures) process.exit(1);
