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

// Rough parimutuel payout estimate if `outcome` wins: your stake back plus a
// proportional share of the rest of the pool (lose pool = total − chosen).
// Works for binary and multi-outcome markets.
export function estimatePayout(
  market: Market,
  outcome: MarketOutcome,
  stake: number
): { payout: number; profit: number; multiplier: number } {
  const slices = outcomeBreakdown(market);
  const winPool = slices.find((s) => s.code === outcome)?.pool ?? 0;
  const losePool = Math.max(0, totalPoolOf(market) - winPool);
  const newWinPool = winPool + stake;
  const payout = newWinPool > 0 ? stake + (stake / newWinPool) * losePool : stake;
  return {
    payout,
    profit: payout - stake,
    multiplier: stake > 0 ? payout / stake : 1,
  };
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

// Raw time-to-close info from an ISO timestamp — the consumer localizes the
// label (see formatCloses). null when there's no timestamp.
export interface ClosesInfo {
  closed: boolean;
  days: number;
  hours: number;
  mins: number;
}

export function closesInfo(iso: string | undefined, now: Date): ClosesInfo | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now.getTime();
  if (Number.isNaN(ms)) return null;
  if (ms <= 0) return { closed: true, days: 0, hours: 0, mins: 0 };
  const total = Math.floor(ms / 60000);
  return {
    closed: false,
    days: Math.floor(total / 1440),
    hours: Math.floor((total % 1440) / 60),
    mins: total % 60,
  };
}

// Just the "2d 16h" duration part (no prefix) — d/h/m units are kept universal.
export function durationText(info: ClosesInfo): string {
  if (info.closed) return "";
  if (info.days > 0) return `${info.days}d ${info.hours}h`;
  if (info.hours > 0) return `${info.hours}h ${info.mins}m`;
  return `${info.mins}m`;
}

// Localized "Closes in 2d 16h" / "Betting closed" label.
export function formatCloses(
  info: ClosesInfo | null,
  t: (k: string) => string
): string {
  if (!info) return "";
  if (info.closed) return t("bettingClosed");
  return `${t("closesIn")} ${durationText(info)}`;
}
