/**
 * Hive-Engine (layer-2) diesel-pool swaps for SWAP.* tokens (SWAP.HIVE /
 * SWAP.HBD / SWAP.BTC / …). A swap is a single `custom_json` op per hop, signed
 * with Aioha (`aioha.signAndBroadcastTx(ops, KeyTypes.Active)`).
 *
 * Many pairs have no direct pool, so routes go through the SWAP.HIVE hub
 * (e.g. SWAP.HBD → SWAP.HIVE → SWAP.BTC). Ported from swapspro; adapted to
 * Aioha signing and self-contained types.
 *
 * ⚠️ SWAP.BTC liquidity is thin/poorly-arbitraged — quotes reflect the real rate.
 */

const HE_RPC = "https://api.hive-engine.com/rpc/contracts";
export const HE_SIDECHAIN_ID = "ssc-mainnet-hive";
const TRADE_FEE_MUL = 0.9975; // marketpools params (0.25% fee)
const HUB = "SWAP.HIVE";
const HE_TIMEOUT_MS = 12_000;

/** A Hive operation tuple, as Aioha's signAndBroadcastTx expects. */
export type HiveOp = [string, Record<string, unknown>];

async function heFind<T>(contract: string, table: string, query: object, limit = 1000): Promise<T[]> {
  const res = await fetch(HE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method: "find", params: { contract, table, query, limit, offset: 0 }, id: 1 }),
    signal: AbortSignal.timeout(HE_TIMEOUT_MS),
  });
  const body = await res.json();
  if (body.error) throw new Error(body.error.message || "Hive-Engine RPC error");
  return (body.result ?? []) as T[];
}

export interface HePool {
  tokenPair: string; // "TOKEN1:TOKEN2" (base:quote)
  baseQuantity: string;
  quoteQuantity: string;
  precision: number;
}
export interface HeBalanceRow {
  account: string;
  symbol: string;
  balance: string;
}

export interface HeAsset {
  symbol: string;
  name: string;
  cgId: string; // CoinGecko id for USD pricing
  precision: number;
}
export const HE_ASSETS: HeAsset[] = [
  { symbol: "SWAP.HIVE", name: "Wrapped HIVE", cgId: "hive", precision: 8 },
  { symbol: "SWAP.HBD", name: "Wrapped HBD", cgId: "hive_dollar", precision: 8 },
  { symbol: "SWAP.BTC", name: "Wrapped BTC", cgId: "bitcoin", precision: 8 },
];
export const HE_ASSET_BY_SYMBOL: Record<string, HeAsset> = Object.fromEntries(HE_ASSETS.map((a) => [a.symbol, a]));

export const getHeBalances = (account: string) => heFind<HeBalanceRow>("tokens", "balances", { account });

// ---- Routing + constant-product math (pure) ---------------------------------

export interface SwapHop {
  tokenPair: string;
  tokenSymbol: string;
  buySymbol: string;
}

export function findRoute(sell: string, buy: string, pools: Set<string>): SwapHop[] | null {
  if (sell === buy) return null;
  const ab = `${sell}:${buy}`;
  const ba = `${buy}:${sell}`;
  if (pools.has(ab)) return [{ tokenPair: ab, tokenSymbol: sell, buySymbol: buy }];
  if (pools.has(ba)) return [{ tokenPair: ba, tokenSymbol: sell, buySymbol: buy }];
  if (sell !== HUB && buy !== HUB) {
    const a = findRoute(sell, HUB, pools);
    const b = findRoute(HUB, buy, pools);
    if (a && b) return [...a, ...b];
  }
  return null;
}

export function poolAmountOut(amountIn: number, liqIn: number, liqOut: number): number {
  if (!(amountIn > 0) || !(liqIn > 0) || !(liqOut > 0)) return 0;
  const effIn = amountIn * TRADE_FEE_MUL;
  return (effIn * liqOut) / (liqIn + effIn);
}

function orientedReserves(pool: HePool, sellSymbol: string): { liqIn: number; liqOut: number } {
  const [base] = pool.tokenPair.split(":");
  const b = Number(pool.baseQuantity);
  const q = Number(pool.quoteQuantity);
  return sellSymbol === base ? { liqIn: b, liqOut: q } : { liqIn: q, liqOut: b };
}

export function formatHeAmount(amount: number, precision = 8): string {
  return amount.toFixed(precision);
}

export interface ExecHop {
  tokenPair: string;
  tokenSymbol: string;
  tokenAmount: string;
  minAmountOut: string;
}

/** Conservative plan: each hop consumes the previous hop's guaranteed-min output,
 *  so all ops broadcast in one transaction without a later hop reverting. */
export function buildExecPlan(route: SwapHop[], amountIn: number, slippagePct: number, byPair: Record<string, HePool>): ExecHop[] {
  const plan: ExecHop[] = [];
  let inAmt = amountIn;
  for (const hop of route) {
    const pool = byPair[hop.tokenPair];
    if (!pool) throw new Error(`Missing pool ${hop.tokenPair}`);
    const { liqIn, liqOut } = orientedReserves(pool, hop.tokenSymbol);
    const out = poolAmountOut(inAmt, liqIn, liqOut);
    if (!(out > 0)) throw new Error("Insufficient pool liquidity for this size");
    plan.push({ tokenPair: hop.tokenPair, tokenSymbol: hop.tokenSymbol, tokenAmount: formatHeAmount(inAmt), minAmountOut: formatHeAmount(out * (1 - slippagePct / 100)) });
    inAmt = out * (1 - slippagePct / 100);
  }
  return plan;
}

/** The `custom_json` op for one pool swap (exactInput with slippage floor). */
export function buildHeSwapOp(username: string, hop: ExecHop): HiveOp {
  return [
    "custom_json",
    {
      required_auths: [username],
      required_posting_auths: [],
      id: HE_SIDECHAIN_ID,
      json: JSON.stringify({
        contractName: "marketpools",
        contractAction: "swapTokens",
        contractPayload: {
          tokenPair: hop.tokenPair,
          tokenSymbol: hop.tokenSymbol,
          tokenAmount: hop.tokenAmount,
          tradeType: "exactInput",
          minAmountOut: hop.minAmountOut,
        },
      }),
    },
  ];
}

// ---- Live pools + quote -----------------------------------------------------

let poolCache: { at: number; set: Set<string>; byPair: Record<string, HePool> } | null = null;
const POOL_TTL_MS = 60_000;

async function getPoolGraph(): Promise<{ set: Set<string>; byPair: Record<string, HePool> }> {
  if (poolCache && Date.now() - poolCache.at < POOL_TTL_MS) return poolCache;
  const pools = await heFind<HePool>("marketpools", "pools", {}, 1000);
  const set = new Set<string>();
  const byPair: Record<string, HePool> = {};
  for (const p of pools) {
    set.add(p.tokenPair);
    byPair[p.tokenPair] = p;
  }
  poolCache = { at: Date.now(), set, byPair };
  return poolCache;
}

export interface HeQuote {
  route: SwapHop[];
  execPlan: ExecHop[];
  expectedOut: number;
  minOut: number;
  hops: number;
}

/** Quote a Hive-Engine swap (auto multi-hop via SWAP.HIVE). Throws if unroutable. */
export async function getHiveEngineQuote(params: {
  sellSymbol: string;
  buySymbol: string;
  amountIn: string;
  slippagePct?: number;
}): Promise<HeQuote> {
  const amountIn = Number(params.amountIn) || 0;
  if (!(amountIn > 0)) throw new Error("Enter an amount");
  const { set, byPair } = await getPoolGraph();
  const route = findRoute(params.sellSymbol, params.buySymbol, set);
  if (!route) throw new Error(`No Hive-Engine route for ${params.sellSymbol} → ${params.buySymbol}`);
  const slippage = params.slippagePct ?? 0.5;

  // Expected (optimistic) chain for display.
  let expected = amountIn;
  for (const hop of route) {
    const { liqIn, liqOut } = orientedReserves(byPair[hop.tokenPair], hop.tokenSymbol);
    expected = poolAmountOut(expected, liqIn, liqOut);
  }
  if (!(expected > 0)) throw new Error("Insufficient pool liquidity for this size");

  const execPlan = buildExecPlan(route, amountIn, slippage, byPair);
  return {
    route,
    execPlan,
    expectedOut: expected,
    minOut: Number(execPlan[execPlan.length - 1].minAmountOut),
    hops: route.length,
  };
}
