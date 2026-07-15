// Pure preflight checks. No I/O — the hook fetches balance/time and passes them
// in, so every bet-blocking rule is unit-testable (see __tests__/validation.test.ts).

import type { CreateMarketFields, Market } from "./types";

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

const OK: ValidationResult = { ok: true };
const fail = (error: string): ValidationResult => ({ ok: false, error });

export interface ValidateBetArgs {
  market: Market;
  stake: number;
  balance: number;
  now: Date;
}

export function validateBet({
  market,
  stake,
  balance,
  now,
}: ValidateBetArgs): ValidationResult {
  // "pending" markets are still forming (activate at min participants) and
  // accept bets — hivepredict's own UI allows betting while FORMING.
  if (market.status !== "active" && market.status !== "pending") {
    return fail("This market is not open for betting.");
  }
  if (market.bettingClosesAt && now >= new Date(market.bettingClosesAt)) {
    return fail("Betting has closed for this market.");
  }
  if (!Number.isFinite(stake) || stake <= 0) {
    return fail("Enter a stake greater than zero.");
  }
  const cap = market.stakeCap == null ? null : Number(market.stakeCap);
  if (cap != null && Number.isFinite(cap) && cap > 0 && stake > cap) {
    return fail(`Stake exceeds the market cap of ${cap} ${market.token}.`);
  }
  if (stake > balance) {
    return fail(`Insufficient ${market.token} balance.`);
  }
  return OK;
}

export interface ValidateCreateMarketArgs {
  fields: CreateMarketFields;
  now: Date;
}

export function validateCreateMarket({
  fields,
  now,
}: ValidateCreateMarketArgs): ValidationResult {
  if (!fields.title.trim()) return fail("Title is required.");
  if (!fields.description.trim()) return fail("Description is required.");
  if (!fields.category.trim()) return fail("Category is required.");
  if (!fields.outcomes || fields.outcomes.length < 2) {
    return fail("At least two outcomes are required.");
  }
  const missingLabel = fields.outcomes.find(
    (o) => !fields.outcomeLabels[o]?.trim()
  );
  if (missingLabel) return fail("Every outcome needs a label.");
  if (!fields.outcomes.includes(fields.creatorSide)) {
    return fail("Your chosen side must be one of the outcomes.");
  }
  if (fields.resolutionType === "auto" && !fields.resolutionSource) {
    return fail("Auto-resolved markets need a resolution source.");
  }
  if (!fields.resolutionCriteria.trim()) {
    return fail("Resolution criteria is required.");
  }
  if (!Number.isFinite(fields.stakeCap) || fields.stakeCap <= 0) {
    return fail("Stake cap must be greater than zero.");
  }
  if (!Number.isFinite(fields.openingBetAmount) || fields.openingBetAmount <= 0) {
    return fail("Opening bet must be greater than zero.");
  }
  if (fields.openingBetAmount > fields.stakeCap) {
    return fail("Opening bet cannot exceed the stake cap.");
  }
  if (!Number.isInteger(fields.minParticipants) || fields.minParticipants < 1) {
    return fail("Minimum participants must be at least 1.");
  }
  const closes = new Date(fields.bettingClosesAt);
  const resolves = new Date(fields.resolvesAt);
  if (Number.isNaN(closes.getTime())) return fail("Invalid betting close time.");
  if (Number.isNaN(resolves.getTime())) return fail("Invalid resolve time.");
  if (closes <= now) return fail("Betting close time must be in the future.");
  if (resolves < closes) {
    return fail("Resolve time cannot be before betting closes.");
  }
  return OK;
}
