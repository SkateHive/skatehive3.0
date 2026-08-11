/**
 * Magi (VSC) cross-chain swaps for skatehive — HIVE/HBD → real BTC, routed
 * through HBD. Ported from swapspro (coinmastersguild/swapspro), adapted from
 * its Keychain/KeepKey signer to skatehive's Aioha signer.
 *
 * `buildQuickSwap` returns two Hive ops ([deposit, swap]) that we broadcast
 * OURSELVES via Aioha (`aioha.signAndBroadcastTx(preview.ops, KeyTypes.Active)`)
 * — we do NOT call `client.quickSwap()`, because its internal path gates on the
 * pre-deposit RC simulation, which is ALWAYS a false negative for a real swap
 * (see the RC gating below). Gating lives here so a can't-trade condition
 * disables the button with a reason instead of throwing.
 *
 * ⚠️ MAINNET — moves real funds. SDK v0.0.3; test with small amounts first.
 */

import {
  createMagi,
  createDefaultPoolProvider,
  createPoolPriceProvider,
  CoinAmount,
  MAINNET_CONFIG,
  simCallFromSwapOp,
  type MagiClient,
  type ReferralConfig,
} from "@vsc.eco/crosschain-sdk";
import { withSwapOpRcLimit } from "@vsc.eco/crosschain-core";

export type MagiAssetIn = "HIVE" | "HBD";
export type MagiAssetOut = "BTC";
const DECIMALS: Record<string, number> = { HIVE: 3, HBD: 3, BTC: 8 };

/** Small referral fee on every Magi (→BTC) conversion, paid to @skatehive.
 *  The SDK sends `beneficiary` as-is (no normalization), so it must be a full
 *  VSC address — `hive:<account>`, NOT the bare handle (a bare handle fails
 *  with "beneficiary address [skatehive] invalid"). Tune bps here. */
export const MAGI_FEE: ReferralConfig = { beneficiary: "hive:skatehive", bps: 100 }; // 1%

/** Hive RC an account must hold for the atomic [deposit, swap] (matches the swap
 *  op's declared rc_limit; the real cost is ~8.2k). Gate on this so a swap can't
 *  run out of RC mid-flight and strand deposited HBD. Compare against
 *  MagiPreview.rcAvailable (from checkSwapRc — NOT the SDK's getAccountRc, which
 *  returns VSC-layer RC, ~0 for most accounts). */
export const MAGI_MIN_RC = 10000n;

/** On-chain decimal precision for a Magi sell asset (HIVE/HBD are 3-dp). */
export const magiInputDecimals = (asset: MagiAssetIn): number => DECIMALS[asset] ?? 3;

/** Bitcoin address sanity check (legacy / P2SH / bech32) — rejects xpub/zpub. */
export const BTC_ADDRESS_RE = /^(bc1[ac-hj-np-z02-9]{25,62}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/;
export const isValidBtcAddress = (a: string) => BTC_ADDRESS_RE.test((a || "").trim());

// ── Decimal precision helpers (ported from swapspro amounts.ts) ─────────────
// HIVE/HBD are 3-dp on-chain; feeding 4+ dp to CoinAmount.fromDecimal throws
// ("too many decimals"). A quote/input must never fail on a formatting detail.

/** Trim a (possibly mid-typing) numeric string to at most `maxDecimals` places
 *  without rounding — keeps "12", "12." and "12.3" intact but blocks a 4th
 *  decimal on a 3-dp asset. Use on the amount field's onChange. */
export function clampDecimalString(value: string, maxDecimals: number): string {
  const dot = value.indexOf(".");
  if (dot < 0) return value;
  if (maxDecimals <= 0) return value.slice(0, dot);
  return value.slice(0, dot + 1 + maxDecimals);
}

/** Truncate a numeric amount to at most `maxDecimals` places (never rounds up,
 *  so the result can't exceed the user's balance). */
export function truncateToDecimals(value: number, maxDecimals: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  const factor = 10 ** maxDecimals;
  const truncated = Math.floor(value * factor) / factor;
  return String(Number(truncated.toFixed(maxDecimals)));
}

/**
 * Create a Magi client. IMPORTANT: pass the indexer URL — `createDefaultPoolProvider()`
 * with no indexerUrl returns an EMPTY pool set (SDK: `const entries = indexerUrl ? … : []`),
 * which makes every quote come back expectedOutput=0 and look like "no liquidity" when it
 * isn't. Aioha is passed through for compatibility but signing is done by the caller
 * (we broadcast the built ops ourselves rather than via `quickSwap`).
 */
export function getMagiClient(aioha: unknown): MagiClient {
  // One pool provider feeds both routing (`pools`) and the referral-fee
  // price quoting (`prices`) — createMagi requires `prices` when a referral
  // is configured.
  const pools = createDefaultPoolProvider(undefined, MAINNET_CONFIG.indexerUrl);
  return createMagi({
    config: { ...MAINNET_CONFIG, referral: MAGI_FEE },
    pools,
    prices: createPoolPriceProvider(pools),
    aioha: aioha as never,
  });
}


/** Reject a promise if it doesn't settle in `ms` — so a stuck VSC node call
 *  can't leave the UI hanging on "Checking…" forever. */
function withTimeout<T>(p: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

/**
 * Fast, single-call VSC resource-credit status. Returns `{ amount, max }` where
 * `amount` is the current (regenerating) RC the swap consumes and `max` is the
 * ceiling, set by the balance the account keeps standing IN the VSC network
 * (NOT Hive Power). Use this to gate/inform the UI instead of the heavy
 * pre-swap simulation (buildQuickSwap + checkSwapRc), which makes 3 network
 * calls and — if the VSC simulate endpoint stalls — never resolves, leaving the
 * RC check stuck on "Checking…". This is one `getAccountRC` GraphQL call.
 */
export async function getMagiRcStatus(
  client: MagiClient,
  username: string,
  timeoutMs = 8000
): Promise<{ amount: bigint; max: bigint }> {
  const rc = await withTimeout(
    client.getAccountRc(`hive:${username}`),
    timeoutMs,
    "RC status timed out"
  );
  return { amount: rc.amount, max: rc.maxRcs };
}

/** VSC resource-credit amount → compact "k" string for messages. */
function fmtRc(rc: bigint): string {
  return `${(Number(rc) / 1000).toFixed(1)}k`;
}

/** Smallest-unit bigint → human decimal string (trims trailing zeros). */
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

/** The [deposit, swap] Hive ops produced by buildQuickSwap, to be broadcast via Aioha. */
type MagiOps = Awaited<ReturnType<MagiClient["buildQuickSwap"]>>["ops"];

export interface MagiPreview {
  expectedOut: string;
  minOut: string;
  hops: number;
  /** Non-fatal reason the swap can't execute right now (insufficient balance /
   *  RC / unsafe sim). When set, the UI shows the output but disables the CTA. */
  blockReason?: string;
  blockDetail?: string;
  /** The account's available Hive RC (from checkSwapRc) — the value the swap
   *  broadcast actually consumes. Use for the claim→BTC RC pre-check. */
  rcAvailable: bigint;
  /** The ops to sign+broadcast via `aioha.signAndBroadcastTx(ops, KeyTypes.Active)`. */
  ops: MagiOps;
}

/**
 * Quote HIVE/HBD → BTC through Magi + decide tradeable vs blocked. Only a truly
 * UNPRICEABLE route (empty pool → 0 output) throws; every can't-trade condition
 * (insufficient liquid balance, insufficient RC, unsafe sim) RETURNS the quote
 * with the BTC output visible plus a non-fatal `blockReason`. No signing.
 */
export async function getMagiPreview(client: MagiClient, p: MagiSwapInput): Promise<MagiPreview> {
  if (p.assetIn !== "HIVE" && p.assetIn !== "HBD") throw new Error("Magi input must be HIVE or HBD");
  if (!isValidBtcAddress(p.recipient)) throw new Error("Enter a valid Bitcoin address");
  if (!(Number(p.amountIn) > 0)) throw new Error("Enter an amount");

  // Truncate to the asset's on-chain precision so an over-precise amount can
  // never throw in CoinAmount.fromDecimal.
  const sellAmount = truncateToDecimals(Number(p.amountIn), DECIMALS[p.assetIn]);
  if (!(Number(sellAmount) > 0)) throw new Error("Enter an amount");

  const build = await client.buildQuickSwap({
    username: p.username,
    assetIn: p.assetIn,
    amountIn: CoinAmount.fromDecimal(sellAmount, p.assetIn),
    assetOut: p.assetOut,
    recipient: p.recipient.trim(),
    slippageBps: Math.round((p.slippagePct ?? 0.5) * 100),
  });

  // The ONLY fatal case: an empty/unpriceable pool returns 0 output — no rate to show.
  if (!(build.preview.expectedOutput > 0n)) {
    throw new Error("Magi has no BTC liquidity for this pair right now — try again later");
  }

  let blockReason: string | undefined;
  let blockDetail: string | undefined;

  // 1) Liquid Hive L1 balance must cover the deposit (savings/staked don't count).
  //    This is the check that actually matters — the VSC sim below looks at the
  //    VSC ledger, not Hive L1.
  const needRaw = CoinAmount.fromDecimal(sellAmount, p.assetIn).raw;
  const l1 = await client.getBalance(p.username, p.assetIn);
  if (l1 !== null && l1 < needRaw) {
    blockReason = `Insufficient liquid ${p.assetIn}`;
    blockDetail = `Need ${sellAmount} ${p.assetIn}, you have ${fmtUnits(l1, DECIMALS[p.assetIn])} liquid (savings can't be swapped directly).`;
  }

  // 2) RC sufficiency — gate it DIRECTLY. The atomic [deposit, swap] can't be
  //    simulated pre-broadcast (checkSwapRc runs the swap op against the CURRENT
  //    VSC ledger, which can't see the deposit riding in ops[0]), so sim RC is a
  //    false negative. The account must hold at least the swap op's declared
  //    rc_limit (1e4 for cross-chain, safely above the ~8.2k real cost) or the
  //    broadcast runs out of RC mid-swap and STRANDS the deposited HBD.
  const swapCall = simCallFromSwapOp(build.ops[build.ops.length - 1]);
  const requiredRc = BigInt(swapCall.rc_limit || 10000);
  const rc = await client.checkSwapRc({ username: p.username, build });
  if (!blockReason && rc.rcAvailable < requiredRc) {
    blockReason = "Not enough Resource Credits";
    blockDetail = `This Magi swap needs about ${fmtRc(requiredRc)} RC and @${p.username} has ${fmtRc(rc.rcAvailable)}. Wait for your RC to recharge, or power up HIVE.`;
  }

  // A genuine (non-artifact) sim failure means the built ops are unsafe — block
  // execution but still return the quote. The two artifact faces are the
  // pre-deposit ledger gap (insufficient balance) and the collapsed sim rc_limit
  // (cost limit exceeded); neither is a real failure.
  const isPreDepositArtifact =
    !rc.simOk &&
    ((rc.err === "ledger_error" && /insufficient balance/i.test(rc.errMsg ?? "")) ||
      (rc.err === "gas_limit_hit" && /cost limit exceeded/i.test(rc.errMsg ?? "")));
  if (!blockReason && !rc.simOk && !isPreDepositArtifact) {
    blockReason = "Swap can't be simulated";
    blockDetail = rc.errMsg || rc.err || "Magi couldn't simulate this swap right now — try again.";
  }

  // Size the swap op's rc_limit from the sim ONLY when it actually ran (funded
  // account). On the pre-deposit artifact, keep the SDK's default rc_limit — a
  // limit derived from an aborted sim reflects only the failed attempt.
  const ops = [...build.ops] as MagiOps;
  if (rc.simOk) {
    ops[ops.length - 1] = withSwapOpRcLimit(ops[ops.length - 1], rc.broadcastRcLimit);
  }

  const dec = DECIMALS[p.assetOut];
  return {
    expectedOut: fmtUnits(build.preview.expectedOutput, dec),
    minOut: fmtUnits(build.preview.minAmountOut, dec),
    hops: build.preview.hops,
    blockReason,
    blockDetail,
    rcAvailable: rc.rcAvailable,
    ops,
  };
}
