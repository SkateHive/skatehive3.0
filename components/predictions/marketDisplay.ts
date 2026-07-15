// Pure display helpers for market cards/detail (no React, no I/O).
import type { Market, MarketOutcome, MarketStatus } from "@/lib/predictions/types";

export function poolNumbers(market: Market) {
  const yes = Number(market.yesPool ?? 0) || 0;
  const no = Number(market.noPool ?? 0) || 0;
  const total = Number(market.totalPool ?? yes + no) || yes + no;
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 50;
  return { yes, no, total, yesPct, noPct: 100 - yesPct };
}

export function outcomeLabel(market: Market, outcome: MarketOutcome): string {
  return market.outcomeLabels?.[outcome] || outcome;
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
