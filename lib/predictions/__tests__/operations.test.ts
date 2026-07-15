import assert from "assert";
import {
  betMemo,
  buildCreateMarketOps,
  buildPlaceBetOps,
  formatAmount,
} from "../operations";
import {
  HIVEPREDICT_ACCOUNT,
  OP_CREATE_MARKET,
  OP_PLACE_PREDICTION,
} from "../constants";
import type { CreateMarketFields } from "../types";

// --- formatAmount ---------------------------------------------------------
assert.strictEqual(formatAmount(1, "HIVE"), "1.000 HIVE");
assert.strictEqual(formatAmount("2.5", "HBD"), "2.500 HBD");
assert.strictEqual(formatAmount(0.1 + 0.2, "HIVE"), "0.300 HIVE", "rounds to 3dp");
assert.strictEqual(formatAmount(1.9999, "HIVE"), "2.000 HIVE", "rounds up");
assert.throws(() => formatAmount("abc", "HIVE"), "rejects non-numeric amount");

// --- betMemo --------------------------------------------------------------
assert.strictEqual(betMemo("mkt-1", "YES"), "mkt-1:YES");

// --- buildPlaceBetOps -----------------------------------------------------
{
  const ops = buildPlaceBetOps({
    user: "alice",
    marketId: "042ac39a-6af4-4405-8628-cc5b7ea887ce",
    outcome: "YES",
    amount: 1,
    token: "HIVE",
  });

  assert.strictEqual(ops.length, 2, "bet is exactly 2 ops");

  // Order: transfer first.
  const [transfer, customJson] = ops;
  assert.strictEqual(transfer[0], "transfer");
  assert.deepStrictEqual(transfer[1], {
    from: "alice",
    to: HIVEPREDICT_ACCOUNT,
    amount: "1.000 HIVE",
    memo: "042ac39a-6af4-4405-8628-cc5b7ea887ce:YES",
  });

  assert.strictEqual(customJson[0], "custom_json");
  const cj = customJson[1] as any;
  assert.strictEqual(cj.id, OP_PLACE_PREDICTION);
  assert.deepStrictEqual(cj.required_auths, ["alice"], "ACTIVE auth");
  assert.deepStrictEqual(cj.required_posting_auths, []);
  const payload = JSON.parse(cj.json);
  assert.deepStrictEqual(payload, {
    market_id: "042ac39a-6af4-4405-8628-cc5b7ea887ce",
    outcome: "YES",
    amount: "1.000 HIVE",
    tx_id: "",
  });
  assert.strictEqual(payload.tx_id, "", "tx_id stays empty (self-referential)");
}

// HBD flows to both the transfer amount and the custom_json amount.
{
  const ops = buildPlaceBetOps({
    user: "bob",
    marketId: "m2",
    outcome: "NO",
    amount: "3",
    token: "HBD",
  });
  assert.strictEqual((ops[0][1] as any).amount, "3.000 HBD");
  assert.strictEqual(JSON.parse((ops[1][1] as any).json).amount, "3.000 HBD");
  assert.strictEqual((ops[0][1] as any).memo, "m2:NO");
}

// --- buildCreateMarketOps -------------------------------------------------
{
  const fields: CreateMarketFields = {
    title: "World Cup 2026: Norway Vs England",
    description: "Who wins?",
    category: "sports",
    token: "HIVE",
    outcomeLabels: { YES: "Norway", NO: "England" },
    creatorSide: "YES",
    stakeCap: 1000,
    minParticipants: 3,
    resolutionCriteria: "FIFA official result",
    bettingClosesAt: "2026-07-11T21:00:00.000Z",
    resolvesAt: "2026-07-11T21:00:00.000Z",
    openingBetAmount: 1,
  };
  const ops = buildCreateMarketOps({
    user: "carol",
    marketId: "54f6a38b-ec28-4846-9792-2cfa861cdc4a",
    ...fields,
  });

  assert.strictEqual(ops.length, 2, "create is exactly 2 ops");

  // Order: custom_json first, transfer second.
  const [customJson, transfer] = ops;
  assert.strictEqual(customJson[0], "custom_json");
  const cj = customJson[1] as any;
  assert.strictEqual(cj.id, OP_CREATE_MARKET);
  assert.deepStrictEqual(cj.required_auths, ["carol"], "ACTIVE auth");
  assert.deepStrictEqual(cj.required_posting_auths, []);
  const payload = JSON.parse(cj.json);
  assert.strictEqual(payload.market_id, "54f6a38b-ec28-4846-9792-2cfa861cdc4a");
  assert.strictEqual(payload.title, fields.title);
  assert.deepStrictEqual(payload.outcomes, ["YES", "NO"]);
  assert.deepStrictEqual(payload.outcome_labels, { YES: "Norway", NO: "England" });
  assert.strictEqual(payload.creator_side, "YES");
  assert.strictEqual(payload.stake_cap, 1000);
  assert.strictEqual(payload.min_participants, 3);
  assert.strictEqual(payload.resolution_type, "manual");
  assert.strictEqual(payload.allow_early_resolution, false);
  assert.strictEqual(payload.resolution_source, null);
  assert.strictEqual(payload.betting_closes_at, "2026-07-11T21:00:00.000Z");
  assert.strictEqual(payload.opening_bet_amount, "1.000", "3dp string, no symbol");

  assert.strictEqual(transfer[0], "transfer");
  assert.deepStrictEqual(transfer[1], {
    from: "carol",
    to: HIVEPREDICT_ACCOUNT,
    amount: "1.000 HIVE",
    memo: "54f6a38b-ec28-4846-9792-2cfa861cdc4a:YES",
  });
}

console.log("✅ predictions/operations tests passed");
