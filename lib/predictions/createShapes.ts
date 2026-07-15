// Pure helpers that turn wizard input into CreateMarketFields fragments.
// No React, no I/O — unit-tested in __tests__/createShapes.test.ts so the
// generated on-chain payload can be verified without broadcasting.

import type { MarketOutcome, SportsEvent } from "./types";

// Leagues supported by hivepredict's /api/sports/:league/events (from the
// endpoint's own "Supported: …" list). Used to build the sports event picker.
export const SPORTS_LEAGUES = [
  "NFL",
  "NBA",
  "MLB",
  "NHL",
  "NCAAF",
  "NCAAB",
  "WNBA",
  "WNCAAB",
  "CFL",
  "UFL",
  "AFL",
  "NRL",
  "NBL",
  "Euroleague",
  "SHL",
  "HockeyAllsvenskan",
  "Soccer",
  "MLS",
  "A-League",
  "UCL",
  "FIFA World Cup",
] as const;

// Sports match bet types shown in the wizard. Only "moneyline" (match winner)
// has a verified on-chain auto-resolve format; the others are created as
// manual markets with structured criteria (no fake auto-resolution).
export type SportsBetType = "moneyline" | "spread" | "totals" | "prop";

export const SPORTS_BET_TYPES: { value: SportsBetType; label: string; auto: boolean }[] = [
  { value: "moneyline", label: "Match winner", auto: true },
  { value: "spread", label: "Spread", auto: false },
  { value: "totals", label: "Over / Under", auto: false },
  { value: "prop", label: "Custom prop", auto: false },
];

// Turn a free-text participant list (one per line or comma separated) into
// O1..On outcome codes + labels.
export function participantsToOutcomes(raw: string): {
  outcomes: MarketOutcome[];
  outcomeLabels: Record<string, string>;
} {
  const names = raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const outcomes: MarketOutcome[] = [];
  const outcomeLabels: Record<string, string> = {};
  names.forEach((name, i) => {
    const code = `O${i + 1}`;
    outcomes.push(code);
    outcomeLabels[code] = name;
  });
  return { outcomes, outcomeLabels };
}

export function multiResolutionCriteria(labels: string[]): string {
  return (
    `Resolve to the single official winner from this field: ${labels.join(", ")}. ` +
    `If the event is cancelled or no official final winner is published by the ` +
    `resolution time, void + refund.`
  );
}

// Add hours to an ISO timestamp, returning ISO.
export function addHoursIso(iso: string, hours: number): string {
  const t = new Date(iso).getTime();
  return new Date(t + hours * 3_600_000).toISOString();
}

export interface SportsMoneyline {
  outcomeLabels: Record<string, string>;
  resolutionSource: string;
  resolutionCriteria: string;
  bettingClosesAt: string;
  resolvesAt: string;
  title: string;
}

// Build the auto-resolve match-winner fragment from a chosen event.
// `homeWins` = which side the YES outcome represents (true = home team wins).
export function sportsMoneyline(event: SportsEvent): SportsMoneyline {
  const { homeTeam, awayTeam, sportKey, id, commenceTime } = event;
  return {
    title: `${homeTeam} vs ${awayTeam}: match winner`,
    outcomeLabels: { YES: `${homeTeam} wins`, NO: `${awayTeam} wins` },
    resolutionSource: `oddsapi:${sportKey}:${id}`,
    resolutionCriteria:
      `moneyline:${homeTeam}|${awayTeam}\n` +
      `Resolve YES if ${homeTeam} wins the match (including overtime/extra time ` +
      `where applicable), otherwise resolve NO if ${awayTeam} wins. If the match ` +
      `is postponed/cancelled or no official final result is available by the ` +
      `resolution time, void + refund.`,
    // Betting closes at kickoff; resolve a few hours later.
    bettingClosesAt: commenceTime,
    resolvesAt: addHoursIso(commenceTime, 4),
  };
}
