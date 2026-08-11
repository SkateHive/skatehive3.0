# Magi RC Enablement — In-App "Claim to BTC" Setup

**Date:** 2026-08-11
**Status:** Design approved (verbal), calibration pending
**Feature area:** Wallet → Claim to BTC (Magi HBD→BTC swap)

## Problem

A user can only run the Magi HBD→BTC swap if their **VSC account has enough
Resource Credits (RC)**. We confirmed (code + live measurement) that this RC is
**NOT** derived from Hive Power — it comes from the balance the account keeps
standing **inside the VSC network**. The current UI has no in-app way to create
that balance, and actively misleads the user:

- The checklist says RC "comes with HP" and offers a **"Power up HIVE to
  qualify"** button. Powering up HIVE does **nothing** for VSC RC → dead end.
- A brand-new user with **zero VSC balance has ~zero RC** and literally cannot
  bootstrap: the swap needs VSC RC to run, but VSC RC requires a prior standing
  VSC balance. The swap's own atomic deposit (`ops[0]`) does not help, because
  RC is checked against the *pre-deposit* ledger.

So "the user can do everything needed to enable this feature within SkateHive"
is currently **false** — the RC step has no in-app remedy.

## Confirmed findings (evidence)

- `checkSwapRc` / `getAccountRc` query the **VSC GraphQL API**
  (`api.vsc.eco/api/v1/graphql`, `getAccountRC { amount, max_rcs }`), keyed by
  `hive:<user>`. This is VSC RC, not Hive L1 RC.
- Live probe of `hive:xvlad`: RC `amount=14503 / max_rcs=18000`, while its VSC
  ledger held **8 HBD + 69 HIVE**. Hive L1 HBD (86) did **not** contribute — the
  RC ceiling tracks the **VSC-held** balance.
- `amount` regenerates over time toward `max_rcs` (Hive-style RC model).
- Deposit format (confirmed in SDK `getHiveDepositOp`): a single Hive
  `transfer` → `vsc.gateway`, amount `<n> HBD|HIVE`, memo `to=<user>`.
- The deposited balance is the user's own VSC balance — **refundable** (can be
  withdrawn back to Hive L1 later); it is an RC stake, not a fee.

## Goals

1. Give every eligible user an **in-app** path to obtain the VSC RC needed to
   swap ("Enable Magi RC" = a small, refundable HBD deposit into VSC).
2. Remove the misleading HP-based RC messaging and the "Power up HIVE for RC"
   dead end.
3. Remove the HP≥500 curation gate (RC is now decoupled from HP; frictionless
   access for all).
4. Keep the RC check fast and non-hanging (already shipped: `getMagiRcStatus`).

## Non-goals (this phase)

- **Lite accounts** (email/EVM-only via `@skateuser`): out of scope. Claim→BTC
  needs the user's own Hive account with Active-key access and their own reward
  HBD.
- **In-app withdraw** of the VSC balance back to Hive L1: Phase 2.
- **SkateHive-sponsored RC** (dapp generates RC for end users): Phase 2, once
  the mechanism is verified. Phase 1 is self-serve deposit.

## Decisions

| Question | Decision |
|---|---|
| RC enablement mechanism | **Both** — Phase 1 self-serve deposit; Phase 2 sponsored |
| HP≥500 curation gate | **Removed** |
| Deposit asset | **HBD** (user already holds it; it's the reward asset) |
| Deposit amount | Calibrated to clear the RC gate with headroom (see Calibration) |

## Components

### 1. `lib/hive/magi.ts` — helpers

- `getMagiRcStatus(client, username, timeoutMs=8000): Promise<{amount, max}>`
  **(SHIPPED)** — one timeout-guarded `client.getAccountRc("hive:"+username)`
  call. Replaces the 3-call `getMagiPreview` probe that hung on "Checking…".
- `buildVscTopUpOp(username, asset, amountDecimal): TransferOp` — thin wrapper
  over the SDK's `getHiveDepositOp({ from: username, toDid: "hive:"+username,
  amount: CoinAmount.fromDecimal(amountDecimal, asset), config: MAINNET_CONFIG })`.
  Returns the single `["transfer", …]` op to sign with **Active** key.
- `MAGI_RC_GATE` — export the gate value (currently `MAGI_MIN_RC = 10000n`)
  used by both the modal and the swap panel.
- `suggestRcTopUpHbd(status): number` — given `{amount, max}`, return the HBD
  amount to deposit to reach a target ceiling (gate + headroom). Ratio constant
  set from Calibration.

### 2. `EnableMagiRcButton` (new, reusable) — `components/wallet/components/`

Props: `{ username, client, currentRc, onEnabled? }`.
Behavior:
- Shows `RC amount / max` vs gate, and the suggested deposit (e.g. "Deposit
  2 HBD into Magi — refundable, powers your swaps").
- On click: build `buildVscTopUpOp`, `aioha.signAndBroadcastTx([op],
  KeyTypes.Active)`.
- Poll `getMagiRcStatus` (a few tries, ~2s apart) until `max` rises; then call
  `onEnabled?()`.
- Handle the **ceiling-vs-current** nuance: depositing raises `max` immediately,
  but `amount` regenerates. If `max ≥ gate` but `amount < gate`, show "Deposit
  received — RC recharging, try the swap in a few minutes" (don't enable swap
  yet).

### 3. `ClaimToBtcModal` — simplify

- Checklist → **3 items**: ① Bitcoin address · ② Magi RC (with
  `EnableMagiRcButton` as the remedy) · ③ ≥0.5 HBD reward.
- Remove: HP check, `MIN_HP_FOR_BTC`, "Power up HIVE to qualify" button,
  `PowerUpModal` usage here. Fix the RC hint copy.
- `allOk = addrOk && rcOk && amountOk` (no `hpOk`).

### 4. `CrossChainSwapPanel` — mirror

- When `mPreview.blockReason === "Not enough Resource Credits"`, render
  `EnableMagiRcButton` inline so the swap-tab entry point self-heals too.

### 5. i18n — `lib/i18n/locales/{en,pt-BR,es,lg}.ts`

New keys for: enable-RC title/description/button, "refundable stake" note,
"recharging" note.

## Data flow (enable → swap)

```
User opens Claim to BTC
  → getMagiRcStatus (fast) → RC row ✓/✗
  RC ✗ → EnableMagiRcButton
       → buildVscTopUpOp(HBD) → sign(Active) → transfer to vsc.gateway (memo to=user)
       → poll getMagiRcStatus until max ≥ gate
       → RC row ✓ (or "recharging" if amount < gate)
  All ✓ → Claim & convert (existing 2-step: claimRewards, then Magi [deposit,swap])
```

## Error handling

- Deposit rejected/failed → nothing moved (single atomic transfer). Safe; show
  error, allow retry.
- Deposit succeeded but RC didn't rise within the poll window → "received,
  updates shortly; reopen".
- `amount < gate` while `max ≥ gate` → guide to wait for recharge; keep swap
  disabled.

## Calibration (pending — does not block build)

The exact HBD→RC ceiling ratio is empirical. Measure via a real deposit:
1. Record `getAccountRC` `max_rcs` before.
2. Deposit a known HBD amount to `vsc.gateway` (memo `to=<user>`).
3. Record `max_rcs` after → Δ per HBD.

Set `suggestRcTopUpHbd`'s ratio + headroom from this. Until measured, default to
a conservative amount that comfortably clears a 10k gate (e.g. target ~14k
ceiling). @xvlad's point (8 HBD + 69 HIVE → 18k) is a rough anchor.

## Testing

- Read-only RC probes (before/after a deposit) to confirm the ratio.
- Unit: `buildVscTopUpOp` produces `transfer → vsc.gateway`, memo `to=<user>`,
  correct asset unit/precision.
- E2E (mainnet, small): enable RC (deposit) → claim → convert → sats land.

## Phasing

- **Phase 1 (this spec):** hotfix (done) + `buildVscTopUpOp` +
  `EnableMagiRcButton` + modal simplification + swap-panel mirror + i18n.
- **Phase 2:** SkateHive-sponsored RC; in-app withdraw of VSC balance.
