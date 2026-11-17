/**
 * Quotes for swapping HIVE <-> HBD, mirroring how the chain actually settles.
 *
 * Two routes exist:
 *  - Internal market (limit_order_create, fill-or-kill): instant, no protocol fee,
 *    priced by the live order book.
 *  - Protocol conversion:
 *      HIVE -> HBD (collateralized_convert): only half of the HIVE is converted right
 *      away, at the 3.5-day minimum feed price minus a 5% fee. The other half is held
 *      as collateral for 3.5 days; at settlement the chain charges the HBD back at the
 *      market median price plus 5% and returns what is left.
 *      HBD -> HIVE (convert): settles after 3.5 days at the median feed price, no fee.
 *
 * Amounts are integer milli-units (3 decimals) and the math follows hived's integer
 * arithmetic (libraries/chain/hive_evaluator_transfer.cpp, database_conversion.cpp,
 * protocol/asset.cpp multiply_with_fee), so estimates match what the chain does.
 */

export type HiveAssetSymbol = "HIVE" | "HBD";

export const HIVE_100_PERCENT = 10000n;
export const COLLATERAL_RATIO = 20000n; // HIVE_CONVERSION_COLLATERAL_RATIO (200%)
export const COLLATERALIZED_FEE = 500n; // HIVE_COLLATERALIZED_CONVERSION_FEE (5%)
export const CONVERSION_DELAY_MS = 302_400_000; // 3.5 days
export const DEFAULT_SLIPPAGE_BPS = 50n; // 0.5% tolerance on market orders

export interface RawAssetPrice {
  base: string; // e.g. "0.039 HBD"
  quote: string; // e.g. "1.000 HIVE"
}

/** Price of HIVE in HBD, as integers: `hbd` milli-HBD buys `hive` milli-HIVE. */
export interface FeedPrice {
  hbd: bigint;
  hive: bigint;
}

export interface FeedHistory {
  current_median_history: RawAssetPrice;
  market_median_history?: RawAssetPrice;
  current_min_history: RawAssetPrice;
}

export interface RawOrder {
  hive: number; // milli-HIVE
  hbd: number; // milli-HBD
  order_price: RawAssetPrice;
}

export interface RawOrderBook {
  bids: RawOrder[]; // buying HIVE with HBD, best (highest) first
  asks: RawOrder[]; // selling HIVE for HBD, best (lowest) first
}

export function parseAsset(raw: string): { amount: bigint; symbol: string } {
  const [num, symbol] = raw.trim().split(/\s+/);
  const [whole, frac = ""] = num.split(".");
  const milli = BigInt(whole) * 1000n + BigInt((frac + "000").slice(0, 3));
  return { amount: milli, symbol };
}

/** Parse a feed/order price into milli-HBD per milli-HIVE, whichever side is base. */
export function parseFeedPrice(price: RawAssetPrice): FeedPrice {
  const base = parseAsset(price.base);
  const quote = parseAsset(price.quote);
  if (base.symbol === "HBD" && quote.symbol === "HIVE") {
    return { hbd: base.amount, hive: quote.amount };
  }
  if (base.symbol === "HIVE" && quote.symbol === "HBD") {
    return { hbd: quote.amount, hive: base.amount };
  }
  throw new Error(`Unexpected price ${price.base} / ${price.quote}`);
}

export function toMilli(amount: string | number): bigint {
  const n = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 0n;
  return BigInt(Math.floor(n * 1000 + 1e-6));
}

export function formatMilli(milli: bigint, symbol?: HiveAssetSymbol): string {
  const negative = milli < 0n;
  const abs = negative ? -milli : milli;
  const s = `${negative ? "-" : ""}${abs / 1000n}.${(abs % 1000n).toString().padStart(3, "0")}`;
  return symbol ? `${s} ${symbol}` : s;
}

/** HBD per HIVE as a float, for display only. */
export function hbdPerHive(price: FeedPrice): number {
  return Number(price.hbd) / Number(price.hive);
}

// ─── Internal market ──────────────────────────────────────────────────────────

export interface MarketQuote {
  from: HiveAssetSymbol;
  to: HiveAssetSymbol;
  amountIn: bigint;
  amountOut: bigint;
  /** Enough resting orders to fill the whole amount. */
  filled: boolean;
  /** Best available price, HBD per HIVE. */
  bestPrice: number;
  /** Average fill price, HBD per HIVE. */
  averagePrice: number;
  /** How much worse the average fill is than the best price (0.01 = 1%). */
  priceImpact: number;
  /** Floor to put in min_to_receive so the order still fills on small book moves. */
  minToReceive: bigint;
}

/**
 * Walk the order book to price a market swap.
 * HIVE -> HBD sells into bids; HBD -> HIVE buys from asks.
 */
export function quoteMarketSwap(
  book: RawOrderBook,
  from: HiveAssetSymbol,
  amountIn: bigint,
  slippageBps: bigint = DEFAULT_SLIPPAGE_BPS,
): MarketQuote {
  const to: HiveAssetSymbol = from === "HIVE" ? "HBD" : "HIVE";
  const levels = from === "HIVE" ? book.bids : book.asks;

  let remaining = amountIn;
  let out = 0n;
  let bestPrice = 0;

  for (const order of levels) {
    if (remaining <= 0n) break;
    const price = parseFeedPrice(order.order_price);
    if (price.hbd <= 0n || price.hive <= 0n) continue;
    if (bestPrice === 0) bestPrice = hbdPerHive(price);

    // What this resting order will take from us, in our input asset.
    const capacity = BigInt(from === "HIVE" ? order.hive : order.hbd);
    if (capacity <= 0n) continue;
    const take = remaining < capacity ? remaining : capacity;

    out +=
      from === "HIVE"
        ? (take * price.hbd) / price.hive
        : (take * price.hive) / price.hbd;
    remaining -= take;
  }

  const filled = amountIn > 0n && remaining === 0n;
  const hiveSide = from === "HIVE" ? amountIn - remaining : out;
  const hbdSide = from === "HIVE" ? out : amountIn - remaining;
  const averagePrice = hiveSide > 0n ? Number(hbdSide) / Number(hiveSide) : 0;
  const priceImpact =
    bestPrice > 0 && averagePrice > 0
      ? from === "HIVE"
        ? 1 - averagePrice / bestPrice
        : 1 - bestPrice / averagePrice
      : 0;
  const minToReceive = (out * (HIVE_100_PERCENT - slippageBps)) / HIVE_100_PERCENT;

  return {
    from,
    to,
    amountIn,
    amountOut: out,
    filled,
    bestPrice,
    averagePrice,
    priceImpact: Math.max(0, priceImpact),
    minToReceive,
  };
}

// ─── Protocol conversions ─────────────────────────────────────────────────────

export interface CollateralizedQuote {
  amountIn: bigint; // HIVE locked
  hbdNow: bigint; // HBD credited immediately
  hiveRequired: bigint; // HIVE the chain keeps at settlement (estimate)
  hiveReturned: bigint; // HIVE returned after 3.5 days (estimate)
  /** Value lost vs the median feed price (0.05 = 5%). */
  effectiveCost: number;
}

/** HIVE -> HBD via collateralized_convert. */
export function quoteCollateralizedConvert(
  amountIn: bigint,
  feed: FeedHistory,
): CollateralizedQuote {
  const min = parseFeedPrice(feed.current_min_history);
  const median = parseFeedPrice(feed.market_median_history ?? feed.current_median_history);

  // Immediate part: half the HIVE, at the minimum price, with the fee applied to HIVE.
  const forImmediate = (amountIn * HIVE_100_PERCENT) / COLLATERAL_RATIO;
  const hbdNow =
    (forImmediate * min.hbd * HIVE_100_PERCENT) /
    (min.hive * (HIVE_100_PERCENT + COLLATERALIZED_FEE));

  // Settlement: HIVE needed for that HBD at the median price, plus the fee again.
  let hiveRequired =
    median.hbd > 0n
      ? (hbdNow * median.hive * (HIVE_100_PERCENT + COLLATERALIZED_FEE)) /
        (median.hbd * HIVE_100_PERCENT)
      : amountIn;
  if (hiveRequired > amountIn) hiveRequired = amountIn;
  const hiveReturned = amountIn - hiveRequired;

  const valueInHive = median.hbd > 0n ? (Number(hbdNow) * Number(median.hive)) / Number(median.hbd) : 0;
  const effectiveCost = hiveRequired > 0n ? 1 - valueInHive / Number(hiveRequired) : 0;

  return { amountIn, hbdNow, hiveRequired, hiveReturned, effectiveCost: Math.max(0, effectiveCost) };
}

export interface ConvertQuote {
  amountIn: bigint; // HBD
  hiveOut: bigint; // HIVE after 3.5 days, at today's median (estimate)
}

/** HBD -> HIVE via convert: no fee, settles after 3.5 days at the median feed price. */
export function quoteConvert(amountIn: bigint, feed: FeedHistory): ConvertQuote {
  const median = parseFeedPrice(feed.current_median_history);
  const hiveOut = median.hbd > 0n ? (amountIn * median.hive) / median.hbd : 0n;
  return { amountIn, hiveOut };
}

// ─── Operations ───────────────────────────────────────────────────────────────

/** Hive timestamps are UTC without a zone suffix: 2026-11-17T19:42:56 */
function hiveTime(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

/** A fill-or-kill order: it either fills completely right now or is rejected. */
export function buildMarketOrder(
  owner: string,
  quote: MarketQuote,
  now: number = Date.now(),
  orderid: number = Math.floor(Math.random() * 0xffffffff),
): ["limit_order_create", Record<string, unknown>] {
  return [
    "limit_order_create",
    {
      owner,
      orderid,
      amount_to_sell: formatMilli(quote.amountIn, quote.from),
      min_to_receive: formatMilli(quote.minToReceive, quote.to),
      fill_or_kill: true,
      expiration: hiveTime(now + 60 * 60 * 1000),
    },
  ];
}
