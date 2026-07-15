// Broadcaster seam: isolates the actual signing/broadcast so bet & create flows
// can run against a dry-run (no signing, no chain) in tests and via a dev
// `?dryRun=1` flag. All broadcasters accept the same op array and return a
// normalized result.

import { Operation } from "@hiveio/dhive";
import { KeyTypes } from "@aioha/aioha";
import { KeychainSDK, KeychainKeyTypes } from "keychain-sdk";

export interface BroadcastResult {
  success: boolean;
  txId?: string;
  error?: string;
  dryRun?: boolean;
  ops?: Operation[];
}

export type Broadcaster = (ops: Operation[]) => Promise<BroadcastResult>;

function extractTxId(raw: any): string | undefined {
  return (
    raw?.result?.id ||
    raw?.result?.tx_id ||
    raw?.tx_id ||
    raw?.id ||
    undefined
  );
}

// Primary path: Aioha (covers Keychain, HiveAuth, PeakVault, Ledger).
export function aiohaBroadcaster(aioha: any): Broadcaster {
  return async (ops: Operation[]) => {
    try {
      const raw = await aioha.signAndBroadcastTx(ops, KeyTypes.Active);
      if (raw && raw.success === false) {
        return { success: false, error: raw.error || "Broadcast rejected" };
      }
      return { success: true, txId: extractTxId(raw) };
    } catch (err: any) {
      return { success: false, error: err?.message || "Broadcast failed" };
    }
  };
}

// Fallback path: direct Keychain (when Aioha is not the active provider).
export function keychainBroadcaster(username: string): Broadcaster {
  return async (ops: Operation[]) => {
    try {
      const keychain = new KeychainSDK(window);
      const raw = await keychain.broadcast({
        username,
        operations: ops as any,
        method: KeychainKeyTypes.active,
      });
      if (raw && (raw as any).success === false) {
        return { success: false, error: (raw as any).message || "Broadcast rejected" };
      }
      return { success: true, txId: extractTxId(raw) };
    } catch (err: any) {
      return { success: false, error: err?.message || "Broadcast failed" };
    }
  };
}

// Dry run: never touches the chain. Returns the ops so the UI/tests can assert
// the exact transaction that *would* be broadcast.
export const dryRunBroadcaster: Broadcaster = async (ops: Operation[]) => {
  // eslint-disable-next-line no-console
  console.info("[predictions dryRun] ops:", JSON.stringify(ops, null, 2));
  return { success: true, dryRun: true, ops, txId: "dry-run" };
};

// Choose a broadcaster. `dryRun` wins; otherwise Aioha if a wallet is present.
export function selectBroadcaster(opts: {
  dryRun?: boolean;
  aioha?: any;
  username?: string;
}): Broadcaster {
  if (opts.dryRun) return dryRunBroadcaster;
  if (opts.aioha) return aiohaBroadcaster(opts.aioha);
  if (opts.username) return keychainBroadcaster(opts.username);
  return dryRunBroadcaster;
}
