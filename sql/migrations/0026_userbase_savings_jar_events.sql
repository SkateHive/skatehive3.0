-- 0026_userbase_savings_jar_events.sql
-- Ledger of cofrinho (savings jar) movements, powering the per-jar history in
-- the wallet UI. Rows are display metadata, not money: the real balance lives
-- on-chain and in userbase_savings_jars.allocated_hbd.
-- See docs/COFRINHOS_SAVINGS_JARS_CONCEPT.md §7.

create table if not exists public.userbase_savings_jar_events (
  id uuid primary key default gen_random_uuid(),
  jar_id uuid not null
    references public.userbase_savings_jars (id) on delete cascade,
  -- Denormalized owner for cheap per-account queries and ownership checks.
  hive_account text not null,
  -- 'create' = jar created, 'fund' = money saved into the jar,
  -- 'withdraw' = money taken out of the jar.
  type text not null
    check (type in ('create', 'fund', 'withdraw')),
  amount_hbd numeric(12,3) not null default 0
    check (amount_hbd >= 0),
  -- Where the money came from / went to: 'savings' = free (unallocated)
  -- savings, metadata-only move; 'wallet' = a real on-chain transfer happened
  -- around this event. Null for events with no counterparty (e.g. 'create').
  via text
    check (via is null or via in ('savings', 'wallet')),
  created_at timestamptz not null default now()
);

create index if not exists userbase_savings_jar_events_jar_idx
  on public.userbase_savings_jar_events (jar_id, created_at desc);

comment on table public.userbase_savings_jar_events is
  'Movement history for cofrinhos; display ledger only, money lives on-chain';

-- RLS: same model as userbase_savings_jars — service role only, ownership is a
-- Hive account proven via Hive-signature auth in the API layer.
alter table public.userbase_savings_jar_events enable row level security;
alter table public.userbase_savings_jar_events force row level security;

create policy "Service role can manage userbase_savings_jar_events"
  on public.userbase_savings_jar_events
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.userbase_savings_jar_events from anon, authenticated;
