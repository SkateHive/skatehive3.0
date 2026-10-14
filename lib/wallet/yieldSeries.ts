/**
 * Earnings timelines for the yield chart, shared by Earn (Morpho USDC) and
 * SkateBank (HBD savings). Pure functions — the fetchers live next to their
 * protocol (lib/evm/earn.ts, lib/hive/savingsHistory.ts).
 *
 * A point is { t, invested, value }: `invested` is net principal (deposits −
 * withdrawals) and `value` what the position is worth at t. Earned = value −
 * invested. Projected points extend the last real value at the current rate
 * so a brand-new position still has a curve to show.
 */

export interface YieldPoint {
  /** unix seconds */
  t: number;
  invested: number;
  value: number;
  projected?: boolean;
}

const DAY = 86_400;

export interface ShareEvent {
  t: number;
  /** signed: + deposit, − withdraw */
  assets: number;
  shares: number;
}

/**
 * ERC4626 position over time: shares held at t × share price at t. One point
 * per day from the first deposit, plus a final point at `now` with the live
 * on-chain value (the indexer's daily price lags the chain).
 */
export function buildVaultSeries(
  events: ShareEvent[],
  sharePrices: { t: number; price: number }[],
  liveValue: number | null,
  now: number,
): YieldPoint[] {
  if (events.length === 0) return [];
  const ev = [...events].sort((a, b) => a.t - b.t);
  const prices = [...sharePrices].sort((a, b) => a.t - b.t);
  const start = ev[0].t;
  const priceAt = (t: number) => {
    let p: number | null = null;
    for (const sp of prices) {
      if (sp.t > t) break;
      p = sp.price;
    }
    return p ?? prices[0]?.price ?? null;
  };

  const points: YieldPoint[] = [];
  let shares = 0;
  let invested = 0;
  let i = 0;
  const push = (t: number) => {
    while (i < ev.length && ev[i].t <= t) {
      shares += ev[i].shares;
      invested += ev[i].assets;
      i++;
    }
    const price = priceAt(t);
    // Before any price is known, the position is worth what went in.
    points.push({ t, invested, value: price == null ? invested : Math.max(0, shares * price) });
  };

  push(start);
  for (let t = Math.floor(start / DAY) * DAY + DAY; t < now; t += DAY) push(t);
  push(now);
  if (liveValue != null) points[points.length - 1].value = liveValue;
  return points;
}

export interface SavingsEvent {
  t: number;
  kind: "deposit" | "withdraw" | "interest";
  amount: number;
}

/**
 * HBD savings over time from on-chain ops. Interest is paid in monthly lumps,
 * so between payments the curve accrues linearly at `apr` and the final point
 * uses the real balance plus interest accrued since the last payment.
 */
export function buildSavingsSeries(
  events: SavingsEvent[],
  currentBalance: number,
  accruedInterest: number,
  apr: number,
  now: number,
): YieldPoint[] {
  const ev = [...events].sort((a, b) => a.t - b.t);
  if (ev.length === 0) {
    return currentBalance > 0 ? [{ t: now, invested: currentBalance, value: currentBalance + accruedInterest }] : [];
  }
  const points: YieldPoint[] = [];
  let invested = 0;
  let balance = 0;
  // Interest accrued since the last payment, settled at every balance change
  // so each segment accrues at the balance it actually had.
  let pending = 0;
  let lastT = ev[0].t;
  const accrue = (to: number) => (balance * apr * (to - lastT)) / (365 * DAY);
  const fillDays = (from: number, to: number) => {
    for (let t = Math.floor(from / DAY) * DAY + DAY; t < to; t += DAY) {
      points.push({ t, invested, value: balance + pending + accrue(t) });
    }
  };

  for (const e of ev) {
    fillDays(lastT, e.t);
    pending += accrue(e.t);
    lastT = e.t;
    if (e.kind === "deposit") {
      invested += e.amount;
      balance += e.amount;
    } else if (e.kind === "withdraw") {
      invested -= e.amount;
      balance -= e.amount;
    } else {
      // The payment realises the accrual (estimate replaced by the real amount).
      balance += e.amount;
      pending = 0;
    }
    points.push({ t: e.t, invested, value: Math.max(0, balance + pending) });
  }
  fillDays(lastT, now);
  // History can be truncated or the estimate off — trust the chain for "now".
  points.push({ t: now, invested, value: currentBalance + accruedInterest });
  return points;
}

/** Monthly projection from the last real point at a constant annual rate. */
export function project(points: YieldPoint[], rate: number, months = 12): YieldPoint[] {
  const last = points[points.length - 1];
  if (!last || rate <= 0) return [];
  const out: YieldPoint[] = [];
  for (let m = 1; m <= months; m++) {
    const t = last.t + m * 30 * DAY;
    out.push({ t, invested: last.invested, value: last.value * Math.pow(1 + rate, (m * 30) / 365), projected: true });
  }
  return out;
}

/** Thin a dense daily series to at most `max` points, always keeping the ends. */
export function downsample(points: YieldPoint[], max = 120): YieldPoint[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: YieldPoint[] = [];
  for (let k = 0; k < max; k++) out.push(points[Math.round(k * step)]);
  return out;
}

export function summarizeYield(points: YieldPoint[]) {
  const real = points.filter((p) => !p.projected);
  const last = real[real.length - 1];
  if (!last) return null;
  const earned = Math.max(0, last.value - last.invested);
  return {
    invested: last.invested,
    value: last.value,
    earned,
    returnPct: last.invested > 0 ? earned / last.invested : 0,
    since: real[0].t,
  };
}
