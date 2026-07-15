import assert from "assert";
import { validateBet, validateCreateMarket } from "../validation";
import type { CreateMarketFields, Market } from "../types";

const NOW = new Date("2026-07-14T12:00:00.000Z");

function market(overrides: Partial<Market> = {}): Market {
  return {
    id: "m1",
    title: "Test market",
    token: "HIVE",
    outcomes: ["YES", "NO"],
    status: "active",
    stakeCap: "1000.000",
    bettingClosesAt: "2026-07-15T12:00:00.000Z",
    ...overrides,
  };
}

// --- validateBet ----------------------------------------------------------
assert.ok(
  validateBet({ market: market(), stake: 5, balance: 10, now: NOW }).ok,
  "happy path passes"
);
assert.ok(
  !validateBet({ market: market({ status: "pending" }), stake: 5, balance: 10, now: NOW }).ok,
  "non-active market rejected"
);
assert.ok(
  !validateBet({
    market: market({ bettingClosesAt: "2026-07-14T11:00:00.000Z" }),
    stake: 5,
    balance: 10,
    now: NOW,
  }).ok,
  "closed betting rejected"
);
assert.ok(
  !validateBet({ market: market({ stakeCap: "3.000" }), stake: 5, balance: 10, now: NOW }).ok,
  "over stake cap rejected"
);
assert.ok(
  !validateBet({ market: market(), stake: 5, balance: 2, now: NOW }).ok,
  "insufficient balance rejected"
);
assert.ok(
  !validateBet({ market: market(), stake: 0, balance: 10, now: NOW }).ok,
  "zero stake rejected"
);

// --- validateCreateMarket -------------------------------------------------
function fields(overrides: Partial<CreateMarketFields> = {}): CreateMarketFields {
  return {
    title: "Will it happen?",
    description: "desc",
    category: "sports",
    token: "HIVE",
    outcomeLabels: { YES: "Yes", NO: "No" },
    creatorSide: "YES",
    stakeCap: 1000,
    minParticipants: 3,
    resolutionCriteria: "official result",
    bettingClosesAt: "2026-07-20T12:00:00.000Z",
    resolvesAt: "2026-07-20T14:00:00.000Z",
    openingBetAmount: 1,
    ...overrides,
  };
}

assert.ok(validateCreateMarket({ fields: fields(), now: NOW }).ok, "happy path passes");
assert.ok(!validateCreateMarket({ fields: fields({ title: "  " }), now: NOW }).ok, "empty title rejected");
assert.ok(
  !validateCreateMarket({ fields: fields({ openingBetAmount: 2000 }), now: NOW }).ok,
  "opening bet over cap rejected"
);
assert.ok(
  !validateCreateMarket({ fields: fields({ bettingClosesAt: "2026-07-10T12:00:00.000Z" }), now: NOW }).ok,
  "past close time rejected"
);
assert.ok(
  !validateCreateMarket({
    fields: fields({ bettingClosesAt: "2026-07-20T14:00:00.000Z", resolvesAt: "2026-07-20T12:00:00.000Z" }),
    now: NOW,
  }).ok,
  "resolve before close rejected"
);

console.log("✅ predictions/validation tests passed");
