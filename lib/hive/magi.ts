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
import { withSwapOpRcLimit } from "@vsc.eco/crosschain-core";
import { KeyTypes } from "@aioha/aioha";

/** Minimal Aioha surface we need to broadcast the [deposit, swap] ops ourselves. */
type AiohaLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signAndBroadcastTx: (ops: any[], keyType: any) => Promise<{ success: boolean; result?: string; error?: string }>;
};

export type MagiAssetIn = "HIVE" | "HBD";
export type MagiAssetOut = "BTC";
const DECIMALS: Record<string, number> = { HIVE: 3, HBD: 3, BTC: 8 };

/** Bitcoin address sanity check (legacy / P2SH / bech32) — rejects xpub/zpub. */
export const BTC_ADDRESS_RE = /^(bc1[ac-hj-np-z02-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/;
export const isValidBtcAddress = (a: string) => BTC_ADDRESS_RE.test((a || "").trim());

/** Create a Magi client bound to the app's Aioha (for signing via quickSwap). */
export function getMagiClient(aioha: unknown): MagiClient {
  // IMPORTANT: pass the indexer URL. createDefaultPoolProvider() with no indexerUrl
  // returns EMPTY pools (SDK: `const entries = indexerUrl ? … : []`), so every quote
  // comes back expectedOutput=0 and looks like "no liquidity" — it isn't.
  return createMagi({
    config: MAINNET_CONFIG,
    pools: createDefaultPoolProvider(undefined, MAINNET_CONFIG.indexerUrl),
    aioha: aioha as never,
  });
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

/**
 * Execute a Magi swap: build the [deposit, swap] ops, gate on the checks that
 * actually matter, and broadcast atomically via Aioha.
 *
 * We do NOT use `client.quickSwap` — it hard-throws on `checkSwapRc.!simOk`, and
 * that sim runs the swap op against the CURRENT VSC ledger, which can't see the
 * deposit op riding in the SAME broadcast (ops[0]). The VSC node credits the
 * deposit synchronously before the swap op executes, so the atomic broadcast
 * succeeds — the sim's `ledger_error: insufficient balance` is a false negative
 * for any account without a pre-existing VSC balance (i.e. every first-time
 * swapper). Verified end-to-end on mainnet (2 HBD → BTC settled on-chain).
 */
export async function executeMagiSwap(client: MagiClient, aioha: AiohaLike, p: MagiSwapInput): Promise<string> {
  if (!isValidBtcAddress(p.recipient)) throw new Error("Enter a valid Bitcoin address");

  const build = await client.buildQuickSwap(toSdkInput(p));
  if (!(build.preview.expectedOutput > 0n)) {
    throw new Error("Magi has no BTC liquidity for this pair right now — try again later");
  }

  // The real, knowable pre-broadcast gate (the VSC sim can't see Hive L1): does the
  // user hold enough LIQUID HIVE/HBD for the deposit? (savings/staked don't count.)
  const needRaw = CoinAmount.fromDecimal(p.amountIn, p.assetIn).raw;
  const l1 = await client.getBalance(p.username, p.assetIn);
  if (l1 !== null && l1 < needRaw) {
    throw new Error(`Not enough liquid ${p.assetIn} — need ${p.amountIn}, have ${fmtUnits(l1, DECIMALS[p.assetIn])} (savings can't be swapped directly)`);
  }

  // RC + sim gate: bypass ONLY the pre-deposit ledger false-negative; still fail on
  // any other sim error and on real RC shortfalls.
  const rc = await client.checkSwapRc({ username: p.username, build });
  const preDepositGap = !rc.simOk && rc.err === "ledger_error" && /insufficient balance/i.test(rc.errMsg ?? "");
  if (!rc.simOk && !preDepositGap) {
    throw new Error(rc.errMsg || rc.err || "Magi simulation failed — try again");
  }
  if (rc.simOk && !rc.sufficient) {
    throw new Error("Not enough Resource Credits for this swap — power up HIVE or wait for RC to recharge.");
  }

  // Size the swap op's rc_limit from the sim only when the sim actually ran; otherwise
  // keep the SDK's default (a broadcastRcLimit from an aborted sim is meaningless).
  const ops = [...build.ops];
  if (rc.simOk) ops[ops.length - 1] = withSwapOpRcLimit(ops[ops.length - 1], rc.broadcastRcLimit);

  // Atomic broadcast: VSC processes deposit → swap in order within this one Hive tx.
  const res = await aioha.signAndBroadcastTx(ops, KeyTypes.Active);
  if (!res?.success) throw new Error(res?.error || "Broadcast rejected");
  return res.result || "";
}
