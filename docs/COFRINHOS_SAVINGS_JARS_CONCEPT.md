# SkateHive Savings Jars ("Cofrinhos") — Concept Exploration

> **Status:** Concept / exploration (resolves the exploration scope of [issue #100](https://github.com/SkateHive/skatehive3.0/issues/100))
> **Owners:** @mtlouzada, @BeagleXV
> **Last updated:** 2026-06-28
> **Migrated from Trello:** `[💡] - Cofrinhos da Skatehive Tipo Itau Cofrinhos`

This document satisfies the acceptance criteria of #100:

1. ✅ Clarify the feature concept enough to evaluate product value
2. ✅ Describe the target user flow and wallet/value behavior
3. ✅ Define follow-up implementation issues that can be split from this exploration

It started as a **product + architecture exploration**. The **MVP (follow-up issues 1–4 below) is now implemented** on branch `feat/cofrinhos` alongside this doc; full i18n (issue 5) is the next step. See §9 for status.

---

## 1. Summary

**Cofrinhos** (Portuguese for "piggy banks" / savings jars) lets a user split their HBD savings into multiple **named goals** — e.g. *"New deck"*, *"Trip to the skatepark"*, *"Contest entry fee"* — each with its own target amount, optional deadline, and visual progress.

Inspired by **Itaú "Cofrinhos"** and **Nubank "Caixinhas"**: the bank holds one balance, but the user *experiences* several labelled buckets they can fund toward goals.

The core insight that shapes the whole design:

> **Hive's native savings is a single pool per account.** There is no on-chain concept of multiple named savings buckets. So jars are a **virtual layer**: real money stays in the one HBD Savings balance, and per-jar metadata (name, target, allocated amount, deadline, icon) lives off-chain.

This was the explicitly chosen model (see §5). It reuses the existing 15% APR HBD Savings with **zero extra transaction cost** and **no new blockchain risk**.

---

## 2. Why this fits SkateHive (product value)

| Lever | How cofrinhos help |
|-------|--------------------|
| **Engagement / retention** | Goals are sticky. A skater saving for a new deck has a reason to come back and check progress. |
| **Culture fit** | Skateboarding is goal-driven (a trip, a contest, gear). Named jars map naturally onto how skaters already think about money. |
| **Onboarding to Hive value** | Today HBD Savings ("SkateBank") is a single abstract number. Jars give it *purpose*, nudging more users to actually deposit and earn the 15% APR. |
| **Gamification** | Progress bars, streaks, "auto-save" rules, and milestone celebrations are cheap to add on a virtual layer. |
| **Brazil-first roadmap** | The wallet already has a `PIX Operations (Future)` placeholder ([components/wallet/modals/types.ts](../components/wallet/modals/types.ts)). Cofrinhos + PIX is a recognizable, trusted mental model for the BR community. |

**What it does NOT need:** new smart contracts, cron jobs, background workers, or any change to how Hive savings works. It rides entirely on existing primitives.

---

## 3. Current state in the codebase

Cofrinhos is **not** a greenfield feature — it extends what already ships:

| Piece | File | What it does today |
|-------|------|--------------------|
| SkateBank UI | [components/wallet/SkateBankSection.tsx](../components/wallet/SkateBankSection.tsx) | Shows a single HBD Savings balance, APR info, claimable interest, deposit/withdraw buttons. |
| Bank actions | [hooks/wallet/useBankActions.ts](../hooks/wallet/useBankActions.ts) | `depositToSavings`, `withdrawFromSavings`, `claimInterest` via Hive `transfer_to_savings` / `transfer_from_savings`. |
| Deposit modal | [components/wallet/modals/DepositSavingsModal.tsx](../components/wallet/modals/DepositSavingsModal.tsx) | Move available HBD → savings. |
| Withdraw modal | [components/wallet/modals/WithdrawSavingsModal.tsx](../components/wallet/modals/WithdrawSavingsModal.tsx) | Move savings → available HBD (3-day Hive delay). |
| Modal types | [components/wallet/modals/types.ts](../components/wallet/modals/types.ts) | `WalletCurrency`, modal props, and the `PIX Operations (Future)` placeholder. |

**Implication:** the MVP is mostly a *metadata + presentation layer* on top of `useBankActions`. The hard blockchain plumbing already exists.

---

## 4. The core constraint (read before designing)

- Hive savings = **one balance** per account (`hbd_savings`). You can't natively label or partition it.
- Withdrawals from savings have a **3-day waiting period** (Hive protocol). Any "break the jar / spend now" UX must account for this delay.
- Interest (15% APR) accrues on the **whole** savings balance, not per jar. Jar-level interest is a *display* allocation, not a separate on-chain payment.
- **Lite accounts** (email/EVM/Farcaster users with no own Hive key — see [CLAUDE.md](../CLAUDE.md)) don't have their *own* savings; they post via the shared `@skateuser` account. **Cofrinhos MVP targets Full Accounts** (users who control their own Hive account/keys). Lite-account support is a deliberate later phase (§9).

---

## 5. Chosen model — Virtual jars over a single HBD Savings

Decision (confirmed): **potes virtuais sobre HBD Savings.**

```
                       ┌─────────────────────────────────────┐
                       │   Hive HBD Savings (ONE real pool)   │
                       │            120.000 HBD               │
                       └─────────────────────────────────────┘
                                       ▲
                     virtual allocation (off-chain metadata)
              ┌────────────────┬───────────────┬──────────────────┐
              ▼                ▼               ▼                  ▼
        🛹 New deck      ✈️ Skate trip     🏆 Contest        (unallocated)
        40 / 60 HBD      25 / 100 HBD     10 / 10 HBD ✅      45 HBD free
```

**Invariant:** `Σ(jar.allocated) ≤ hbd_savings_balance`. The difference is shown as "unallocated savings".

Funding a jar does **two** things:
1. (If needed) a real `transfer_to_savings` so the on-chain savings balance covers the new allocation.
2. An off-chain update to that jar's `allocated` amount.

Moving HBD *between jars* is a **pure metadata operation** — no transaction, instant, free. This is the big UX win over "real per-jar transfers".

### Rejected alternatives (recorded so we don't re-litigate)
- **Real transfer per jar** (sub-accounts / contract): Hive has no multi-savings primitive; would need satellite accounts or a custom contract. Far more complexity, custody, and fees. ❌
- **Goal-tracking only (no money)**: pure gamification with no real allocation. Lighter, but loses the "money actually set aside" trust that makes Itaú cofrinhos valuable. Kept as a possible *toggle* per jar (a "wishlist" jar), not the default. ⚠️

---

## 6. Target user flow & wallet/value behavior

### 6.1 Create a jar
1. In SkateBank, user taps **"+ New jar / Novo cofrinho"**.
2. Sets: **name**, **target amount (HBD)**, optional **deadline**, **icon/emoji + color**, optional **auto-save rule**.
3. Jar is created with `allocated = 0`. No transaction yet.

### 6.2 Fund a jar
- **From unallocated savings:** instant metadata move (no tx).
- **From available HBD wallet:** triggers `depositToSavings` (real `transfer_to_savings`) for the shortfall, then allocates to the jar.
- Validation: never let `Σ allocated` exceed real savings.

### 6.3 Track progress
- Per-jar progress bar (`allocated / target`), % complete, optional "on track for {deadline}" hint.
- Milestone celebrations (25/50/75/100%) — cheap engagement wins.

### 6.4 Move between jars
- Drag/realloc HBD from one jar to another, or back to "unallocated". Pure metadata, instant, free.

### 6.5 Break / spend a jar
- "Withdraw" reduces the jar's `allocated`. If the user wants the funds **liquid**, it calls `withdrawFromSavings` → subject to Hive's **3-day delay** (must be surfaced clearly).
- "Goal reached → spend" can route to existing send flows (and later PIX cash-out).

### 6.6 Interest
- Whole-balance 15% APR (unchanged). Display: distribute claimable/earned interest across jars **pro-rata by allocation** for a "your deck jar earned X" story. Default: drip interest into the originating jar or into "unallocated".

### 6.7 Auto-save rules (phase 2, optional)
- Recurring (e.g. 1 HBD/week into "Skate trip").
- % of post rewards / tips routed into a chosen jar.
- Round-ups on send transactions.

---

## 7. Proposed data model (off-chain)

Reuses the project's existing Supabase/userbase stack (same pattern as the `userbase_*` tables in [CLAUDE.md](../CLAUDE.md)).

```sql
-- One row per jar
userbase_savings_jars:
  id            uuid primary key
  user_id       uuid       -- FK to userbase_users (or hive_username for full accounts)
  hive_account  text       -- the Hive account whose savings this jar maps to
  name          text
  target_hbd    numeric    -- goal amount (nullable for open-ended jars)
  allocated_hbd numeric    -- current virtual allocation (default 0)
  deadline      date null
  icon          text       -- emoji or icon key
  color         text
  autosave      jsonb null -- { type: 'recurring'|'reward_pct'|'roundup', ... }
  is_wishlist   boolean    -- true = goal-tracking only, no real allocation
  sort_order    int
  created_at    timestamptz
  updated_at    timestamptz

-- Optional: ledger of jar movements for history/audit
userbase_savings_jar_events:
  id, jar_id, type ('create'|'fund'|'withdraw'|'move'|'interest'), amount_hbd,
  related_tx (nullable Hive txid), created_at
```

**Invariant enforced server-side:** `Σ allocated_hbd (per hive_account) ≤ on-chain hbd_savings`. Re-checked on each mutation and whenever the on-chain balance is fetched (drift can happen if the user withdraws via another client / Keychain directly — see §8).

---

## 8. Edge cases & risks

| Risk | Mitigation |
|------|-----------|
| **Allocation drift** — user withdraws savings via another app, so `Σ allocated > real balance`. | On balance fetch, if real < Σ allocated, proportionally shrink jars and flag "adjusted to match on-chain balance". Never block the user's real funds. |
| **Multi-device / sync** | Server is source of truth for metadata; on-chain is source of truth for total. Reconcile on load. |
| **3-day withdrawal delay** | Surface prominently on "break jar" / spend. Show pending withdrawal state (the section already reads `savings_withdraw_requests`). |
| **Lite accounts (no own savings)** | Out of MVP scope. Later: jars over the shared-account model would need careful attribution — defer. |
| **Interest attribution** | It's a *display* convenience, not on-chain truth. Document clearly so we don't over-promise. |
| **Privacy** | Jar names are off-chain only; they never hit the public blockchain. |
| **HIVE vs HBD** | MVP = HBD only (matches current SkateBank focus + stable USD value for goals). HIVE jars are a possible later addition. |

---

## 9. Phased rollout → follow-up issues to split (#100 criterion 3)

Suggested child issues to open from this exploration:

1. ✅ **`[cofrinhos] Data model + API`** — Supabase `userbase_savings_jars` table + RLS (`sql/migrations/0025_*`) and CRUD API routes under `app/api/cofrinhos`. Hive-signature auth (`lib/cofrinhos/auth.ts`) + server-side invariant check (`lib/cofrinhos/service.ts`). **Done.**
2. ✅ **`[cofrinhos] Jar UI in SkateBank`** — list/create/edit jars, progress bars, reallocate between jars (metadata only). [SavingsJarsSection.tsx](../components/wallet/SavingsJarsSection.tsx) wired into the SkateBank tab in [MainWallet.tsx](../components/wallet/MainWallet.tsx). **Done.**
3. ✅ **`[cofrinhos] Fund / withdraw integration`** — jar funding connected to existing `useBankActions` (`depositToSavings` / `withdrawFromSavings`) via [useSavingsJars.ts](../hooks/wallet/useSavingsJars.ts), with the 3-day-delay UX. **Done.**
4. ✅ **`[cofrinhos] Reconciliation & drift handling`** — read-time on-chain ↔ metadata reconciliation + `over_allocated` flag/warning. (Proportional auto-shrink + history events still to do.) **Basic version done.**
5. ⏳ **`[cofrinhos] i18n`** — strings for en / pt-BR / es / lg. Currently the UI hardcodes English (consistent with the rest of `SkateBankSection`); route through the typed i18n schema next. **Next up.**
6. **`[cofrinhos] Phase 2: auto-save rules`** — recurring / reward-% / round-up funding.
7. **`[cofrinhos] Phase 3: lite-account & HIVE support`** — extend beyond Full Accounts / HBD-only.
8. **`[cofrinhos] (stretch) PIX cash-out`** — tie a completed jar into the planned PIX flow.

**MVP = issues 1–5.** Issues 1–4 are implemented; 5 (i18n) is the immediate follow-up. Everything else is incremental and safe to defer.

---

## 10. Open product decisions

- Default destination for claimed **interest**: into the originating jar, spread pro-rata, or always "unallocated"?
- Do we allow **wishlist jars** (goal tracking with no real allocation) in MVP, or only money-backed jars?
- Max number of jars per user (UI/cognitive load)?
- Should reaching a goal trigger a **post/cast** ("I saved up for my new deck!") for social proof?

---

## 11. TL;DR for reviewers

- Cofrinhos = **virtual named buckets over the existing single HBD Savings**. No new chain mechanics.
- Real money in one savings pool; per-jar name/target/allocation off-chain in Supabase.
- Moving between jars is free/instant; funding from wallet reuses existing `transfer_to_savings`; breaking a jar respects Hive's 3-day delay.
- MVP targets Full Accounts + HBD; lite-accounts, HIVE, auto-save, and PIX are later phases.
- Ready to split into the 8 follow-up issues in §9.
