/**
 * Magi (VSC) cross-chain swaps for skatehive — HIVE/HBD → real BTC, routed
 * through HBD. Ported from swapspro; here we pass the app's Aioha instance to
 * `createMagi`, so `client.quickSwap` signs + broadcasts via Aioha directly
 * (the ops are Hive transfer/custom_json).
 *
 * ⚠️ MAINNET, real funds. SDK is v0.0.3. BTC pool liquidity may be absent — a
 * quote with 0 output throws instead of returning a confirmable zero.
 */

import { createMagi, createDefaultPoolProvider, CoinAmount, MAINNET_CONFIG, type MagiClient } from "@vsc.eco/crosschain-sdk";

export type MagiAssetIn = "HIVE" | "HBD";
export type MagiAssetOut = "BTC";
const DECIMALS: Record<string, number> = { HIVE: 3, HBD: 3, BTC: 8 };

/** Bitcoin address sanity check (legacy / P2SH / bech32) — rejects xpub/zpub. */
export const BTC_ADDRESS_RE = /^(bc1[ac-hj-np-z02-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/;
export const isValidBtcAddress = (a: string) => BTC_ADDRESS_RE.test((a || "").trim());

/** Create a Magi client bound to the app's Aioha (for signing via quickSwap). */
export function getMagiClient(aioha: unknown): MagiClient {
  return createMagi({ config: MAINNET_CONFIG, pools: createDefaultPoolProvider(), aioha: aioha as never });
}

function fmtUnits(raw: bigint, decimals: number): string {
  const neg = raw < 0n;
  const s = (neg ? -raw : raw).toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, s.length - decimals) || "0";
  const frac = s.slice(s.length - decimals).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
}

export interface MagiSwapInput {
  username: string;
  assetIn: MagiAssetIn;
  assetOut: MagiAssetOut;
  amountIn: string;
  recipient: string;
  slippagePct?: number;
}

function toSdkInput(p: MagiSwapInput) {
  return {
    username: p.username,
    assetIn: p.assetIn,
    amountIn: CoinAmount.fromDecimal(p.amountIn, p.assetIn),
    assetOut: p.assetOut,
    recipient: p.recipient.trim(),
    slippageBps: Math.round((p.slippagePct ?? 0.5) * 100),
  };
}

export interface MagiPreview {
  expectedOut: string;
  minOut: string;
  hops: number;
}

/** Quote only (no signing). Throws when the pool has no liquidity (0 output). */
export async function getMagiPreview(client: MagiClient, p: MagiSwapInput): Promise<MagiPreview> {
  if (p.assetIn !== "HIVE" && p.assetIn !== "HBD") throw new Error("Magi input must be HIVE or HBD");
  if (!isValidBtcAddress(p.recipient)) throw new Error("Enter a valid Bitcoin address");
  if (!(Number(p.amountIn) > 0)) throw new Error("Enter an amount");
  const build = await client.buildQuickSwap(toSdkInput(p));
  if (!(build.preview.expectedOutput > 0n)) {
    throw new Error("Magi has no BTC liquidity for this pair right now — try again later");
  }
  const dec = DECIMALS[p.assetOut];
  return {
    expectedOut: fmtUnits(build.preview.expectedOutput, dec),
    minOut: fmtUnits(build.preview.minAmountOut, dec),
    hops: build.preview.hops,
  };
}

/** Execute: builds (with RC sim) + signs + broadcasts via the client's Aioha. */
export async function executeMagiSwap(client: MagiClient, p: MagiSwapInput): Promise<string> {
  if (!isValidBtcAddress(p.recipient)) throw new Error("Enter a valid Bitcoin address");
  const res = await client.quickSwap(toSdkInput(p));
  return res.txId;
}
