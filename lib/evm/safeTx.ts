/**
 * Safe{Wallet} helpers for the bridge tracker.
 *
 * A Safe connected over WalletConnect answers `eth_sendTransaction` with the
 * **safeTxHash** (hash of the Safe proposal), not an on-chain transaction
 * hash. The proposal only becomes a real transaction once enough owners sign
 * and someone executes it. Polling LI.FI (or waiting for a receipt) with the
 * safeTxHash never resolves — LI.FI answers 1003 "not found in any chain"
 * forever. See BridgeSection for the resolver that turns one into the other.
 */

/** Safe Transaction Service slug per chain (api.safe.global/tx-service/<slug>). */
export const SAFE_TX_SERVICE_SLUG: Record<number, string> = {
  1: "mainnet",
  8453: "base",
  42161: "arbitrum",
};

/** Chain prefix used by app.safe.global URLs (EIP-3770 short names). */
export const SAFE_APP_PREFIX: Record<number, string> = {
  1: "eth",
  8453: "base",
  42161: "arb1",
};

export const EXPLORER_URL: Record<number, string> = {
  1: "https://etherscan.io",
  8453: "https://basescan.org",
  42161: "https://arbiscan.io",
};

export function explorerTxUrl(chainId: number, hash: string): string | null {
  const base = EXPLORER_URL[chainId];
  return base ? `${base}/tx/${hash}` : null;
}

export function safeQueueUrl(chainId: number, safeAddress: string): string | null {
  const prefix = SAFE_APP_PREFIX[chainId];
  return prefix ? `https://app.safe.global/transactions/queue?safe=${prefix}:${safeAddress}` : null;
}

/** Normalised answer from /api/safe/tx. */
export interface SafeTxLookup {
  found: boolean;
  /** Signatures collected so far. */
  confirmations: number;
  confirmationsRequired: number;
  isExecuted: boolean;
  /** null until executed; false means the Safe tx reverted. */
  isSuccessful: boolean | null;
  /** On-chain hash once executed. */
  transactionHash: `0x${string}` | null;
  message?: string;
}

/** Bridge tracker phases — each one must be visually distinguishable. */
export type BridgePhase =
  | "safe-pending"   // proposal waiting for owner signatures / execution
  | "submitted"      // real tx hash known, waiting for bridge to complete
  | "done"
  | "failed"
  | "timeout";

/** Give up (honestly) after this long without a terminal status. */
export const BRIDGE_TRACK_TIMEOUT_MS = 20 * 60 * 1000;

/** LI.FI quotes carry a signed 10-minute validity (Layerswap: SignatureExpired(),
 *  Intents: fill deadline). A Safe must collect signatures AND execute inside it. */
export const LIFI_QUOTE_VALIDITY_MS = 10 * 60 * 1000;

/** Known revert selectors seen from the LiFiDiamond, for honest error messages. */
export const KNOWN_REVERTS: Record<string, string> = {
  "0x5ded5997": "NativeAssetNotSupported() — this LI.FI route cannot take native ETH",
  "0x0819bdcd": "SignatureExpired() — the quote's 10-minute validity has passed, re-quote",
  "0x08c379a0": "Error(string)",
};

/** Decode a revert payload into something a human can act on. */
export function describeRevert(data?: string | null): string {
  if (!data || data === "0x") return "reverted without reason";
  const sel = data.slice(0, 10).toLowerCase();
  if (sel === "0x08c379a0") {
    try {
      const hex = data.slice(10 + 128, 10 + 128 + 2 * parseInt(data.slice(10 + 64, 10 + 128), 16));
      return `Error: ${Buffer.from(hex, "hex").toString("utf8")}`;
    } catch { /* fall through */ }
  }
  return KNOWN_REVERTS[sel] ?? `reverted with ${sel}`;
}
