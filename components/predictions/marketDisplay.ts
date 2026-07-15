// Pure display helpers for market cards/detail (no React, no I/O).
import type { Market, MarketOutcome, MarketStatus } from "@/lib/predictions/types";

export interface OutcomeSlice {
  code: MarketOutcome; // "YES"/"NO" or "O1".."On"
  label: string;
  pool: number;
  pct: number; // share of total pool (0-100)
}

export function isBinaryMarket(market: Market): boolean {
  const outs = market.outcomes || [];
  return outs.length === 2 && outs.includes("YES") && outs.includes("NO");
}

export function outcomeLabel(market: Market, outcome: MarketOutcome): string {
  return market.outcomeLabels?.[outcome] || outcome;
}

// Per-outcome pool + percentage for either market kind. Binary markets read
// yes/no pools; multi-outcome markets read outcomePools keyed by O1..On.
export function outcomeBreakdown(market: Market): OutcomeSlice[] {
  const codes = market.outcomes || [];
  const poolFor = (code: MarketOutcome): number => {
    if (code === "YES") return Number(market.yesPool ?? 0) || 0;
    if (code === "NO") return Number(market.noPool ?? 0) || 0;
    return Number(market.outcomePools?.[code] ?? 0) || 0;
  };
  const slices = codes.map((code) => ({
    code,
    label: outcomeLabel(market, code),
    pool: poolFor(code),
  }));
  const summed = slices.reduce((a, s) => a + s.pool, 0);
  const total = Number(market.totalPool ?? summed) || summed;
  return slices.map((s) => ({
    ...s,
    pct:
      total > 0
        ? Math.round((s.pool / total) * 100)
        : Math.round(100 / (codes.length || 1)),
  }));
}

export function totalPoolOf(market: Market): number {
  const summed = outcomeBreakdown(market).reduce((a, s) => a + s.pool, 0);
  return Number(market.totalPool ?? summed) || summed;
}

// A small palette of Chakra semantic tokens to color multi-outcome slices.
const OUTCOME_PALETTE = [
  "success",
  "error",
  "primary",
  "accent",
  "warning",
  "secondary",
];

export function sliceColor(
  market: Market,
  code: MarketOutcome,
  index: number
): string {
  if (isBinaryMarket(market)) return code === "NO" ? "error" : "success";
  return OUTCOME_PALETTE[index % OUTCOME_PALETTE.length];
}

// Chakra semantic token names for a status badge.
export function statusColor(status: MarketStatus): string {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "warning";
    case "resolved":
      return "primary";
    case "voided":
    case "cancelled":
      return "error";
    default:
      return "muted";
  }
}

// Visual "heat" flags for a card: 🔥 when the pool is hot (big stake for this
// platform's typical volumes), ⚡ when betting closes within 24h. Both can
// apply at once.
export function marketHeat(
  market: Market,
  now: Date
): { fire: boolean; closingSoon: boolean; emojis: string } {
  const pool = totalPoolOf(market);
  const fire = market.status === "active" && pool >= 20;
  let closingSoon = false;
  if (market.status === "active" && market.bettingClosesAt) {
    const ms = new Date(market.bettingClosesAt).getTime() - now.getTime();
    closingSoon = ms > 0 && ms <= 24 * 3_600_000;
  }
  const emojis = `${fire ? "🔥" : ""}${closingSoon ? "⚡" : ""}`;
  return { fire, closingSoon, emojis };
}

// Short "closes in …" / "closed" label from an ISO timestamp.
export function closesLabel(iso: string | undefined, now: Date): string {
  if (!iso) return "";
  const closes = new Date(iso);
  const ms = closes.getTime() - now.getTime();
  if (Number.isNaN(ms)) return "";
  if (ms <= 0) return "Betting closed";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `Closes in ${days}d ${hours}h`;
  if (hours > 0) return `Closes in ${hours}h ${mins % 60}m`;
  return `Closes in ${mins}m`;
}
