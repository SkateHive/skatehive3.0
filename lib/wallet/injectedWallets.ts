/**
 * Detection of browser-extension wallets we give a dedicated entry in the
 * "connect wallet" modal: the Skate Wallet and KeepKey.
 *
 * - Skate Wallet injects `window.hive_keychain` with the exact Hive Keychain
 *   API, so on the Hive side it is driven through Aioha's Keychain provider.
 *   Newer builds set `window.hive_keychain.isSkateWallet = true`; older store
 *   builds only reveal themselves through their EIP-6963 announcement
 *   (rdns `app.skatehive.wallet`). Either signal counts.
 *   It also sets `isMetaMask = true` on its EVM provider for compatibility, so
 *   never use `window.ethereum.isMetaMask` to tell wallets apart.
 * - KeepKey is reached on EVM through the KeepKey Client extension, matched by
 *   rdns/name containing "keepkey". The same extension also injects a partial
 *   `window.hive_keychain` (only when no real Keychain is installed), so on the
 *   Hive side it is driven through Aioha's Keychain provider too. Newer builds
 *   set `window.hive_keychain.isKeepKey = true`; see isKeepKeyHiveKeychain.
 */

export const SKATE_WALLET_RDNS = "app.skatehive.wallet";

export interface Eip6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

/** Minimal shape shared by EIP-6963 infos and wagmi connectors. */
interface WalletIdentity {
  id?: string;
  rdns?: string | readonly string[];
  name?: string;
}

const rdnsList = (w: WalletIdentity): string[] => {
  const r = w.rdns;
  const list = Array.isArray(r) ? [...r] : r ? [r as string] : [];
  if (w.id) list.push(w.id);
  return list.map((s) => s.toLowerCase());
};

export function isSkateWalletIdentity(w: WalletIdentity): boolean {
  return rdnsList(w).includes(SKATE_WALLET_RDNS);
}

export function isKeepKeyIdentity(w: WalletIdentity): boolean {
  if (rdnsList(w).some((r) => r.includes("keepkey"))) return true;
  return /keep\s*key/i.test(w.name ?? "");
}

/** True when the injected Hive Keychain API is the Skate Wallet's. */
export function hasSkateWalletHiveFlag(win: unknown): boolean {
  const keychain = (win as { hive_keychain?: { isSkateWallet?: unknown } } | undefined)
    ?.hive_keychain;
  return keychain?.isSkateWallet === true;
}

/**
 * True when `window.hive_keychain` is the KeepKey Client's shim.
 *
 * Newer KeepKey builds flag it with `isKeepKey`. Older ones carry no flag, so
 * when a KeepKey extension announced itself on EVM we also accept a keychain
 * that is not the Skate Wallet's and lacks the `requests` map every real
 * Keychain (and the Skate Wallet, its fork) keeps; the shim has none.
 */
export function isKeepKeyHiveKeychain(win: unknown, keepKeyAnnounced = false): boolean {
  const keychain = (win as { hive_keychain?: Record<string, unknown> } | undefined)
    ?.hive_keychain;
  if (!keychain || typeof keychain !== "object") return false;
  if (keychain.isKeepKey === true) return true;
  if (keychain.isSkateWallet === true) return false;
  return keepKeyAnnounced && !("requests" in keychain);
}

/**
 * The Skate Wallet refuses to sign Hive messages (login challenge) with an
 * account whose key lives on a KeepKey: it answers with the error key
 * `keepkey_hive_operation_coming_soon`. Aioha forwards only the extension's
 * translated text, and every translation names "KeepKey", so match either.
 */
export const KEEPKEY_HIVE_UNSUPPORTED_ERROR = "keepkey_hive_operation_coming_soon";

export function isKeepKeyHiveUnsupportedError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "string") {
    return error.includes(KEEPKEY_HIVE_UNSUPPORTED_ERROR) || /keep\s*key/i.test(error);
  }
  const e = error as { message?: unknown; error?: unknown; messageKey?: unknown };
  return [e.messageKey, e.message, e.error].some(
    (v) => typeof v === "string" && isKeepKeyHiveUnsupportedError(v)
  );
}
