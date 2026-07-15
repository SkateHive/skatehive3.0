// Pure, wallet-agnostic builders for the exact Hive operations HivePredict
// expects. These produce the transaction we *would* broadcast; they perform no
// I/O and no signing, so the whole bet/create shape is unit-testable offline
// (see __tests__/operations.test.ts) without ever touching the chain.
//
// Verified from @hivepredict / bettor account history:
//   Place bet    = [transfer, custom_json]  (single tx, ACTIVE auth)
//   Create market = [custom_json, transfer] (single tx, ACTIVE auth)
// `tx_id` is left "" — it is self-referential within the same transaction and
// the platform resolves it from the containing tx.

import { Operation } from "@hiveio/dhive";
import {
  HIVEPREDICT_ACCOUNT,
  OP_CREATE_MARKET,
  OP_PLACE_PREDICTION,
} from "./constants";
import type { CreateMarketFields, MarketOutcome, MarketToken } from "./types";

// Hive assets are 3-decimal strings suffixed with the symbol, e.g. "1.000 HIVE".
export function formatAmount(amount: number | string, token: MarketToken): string {
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  return `${n.toFixed(3)} ${token}`;
}

// Transfer memo that links a stake to a market + chosen side.
export function betMemo(marketId: string, outcome: MarketOutcome): string {
  return `${marketId}:${outcome}`;
}

// Generate a market id. Kept separate from buildCreateMarketOps so the builder
// stays deterministic/testable (the caller passes the id in).
export function newMarketId(): string {
  return crypto.randomUUID();
}

export interface PlaceBetArgs {
  user: string;
  marketId: string;
  outcome: MarketOutcome;
  amount: number | string;
  token: MarketToken;
}

export function buildPlaceBetOps(args: PlaceBetArgs): Operation[] {
  const { user, marketId, outcome, amount, token } = args;
  const assetAmount = formatAmount(amount, token);

  const transfer: Operation = [
    "transfer",
    {
      from: user,
      to: HIVEPREDICT_ACCOUNT,
      amount: assetAmount,
      memo: betMemo(marketId, outcome),
    },
  ];

  const customJson: Operation = [
    "custom_json",
    {
      required_auths: [user],
      required_posting_auths: [],
      id: OP_PLACE_PREDICTION,
      json: JSON.stringify({
        market_id: marketId,
        outcome,
        amount: assetAmount,
        tx_id: "",
      }),
    },
  ];

  // Order matters: transfer first, matching verified chain history.
  return [transfer, customJson];
}

export interface CreateMarketArgs extends CreateMarketFields {
  user: string;
  marketId: string;
}

export function buildCreateMarketOps(args: CreateMarketArgs): Operation[] {
  const {
    user,
    marketId,
    title,
    description,
    category,
    token,
    outcomes,
    outcomeLabels,
    creatorSide,
    stakeCap,
    minParticipants,
    resolutionType,
    resolutionSource,
    resolutionCriteria,
    bettingClosesAt,
    resolvesAt,
    openingBetAmount,
  } = args;

  const openingAmount = formatAmount(openingBetAmount, token);

  const customJson: Operation = [
    "custom_json",
    {
      required_auths: [user],
      required_posting_auths: [],
      id: OP_CREATE_MARKET,
      json: JSON.stringify({
        market_id: marketId,
        title,
        description,
        category,
        token,
        outcomes,
        outcome_labels: outcomeLabels,
        creator_side: creatorSide,
        stake_cap: stakeCap,
        min_participants: minParticipants,
        resolution_type: resolutionType,
        allow_early_resolution: false,
        resolution_source: resolutionSource,
        resolution_criteria: resolutionCriteria,
        betting_closes_at: bettingClosesAt,
        resolves_at: resolvesAt,
        opening_bet_amount: openingAmount.replace(` ${token}`, ""),
      }),
    },
  ];

  const transfer: Operation = [
    "transfer",
    {
      from: user,
      to: HIVEPREDICT_ACCOUNT,
      amount: openingAmount,
      memo: betMemo(marketId, creatorSide),
    },
  ];

  // Order matters: custom_json first, matching verified chain history.
  return [customJson, transfer];
}
