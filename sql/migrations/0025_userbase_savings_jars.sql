-- 0025_userbase_savings_jars.sql
-- Cofrinhos / Savings Jars: virtual named buckets layered over a Hive account's
-- single HBD Savings balance. The real money lives in one on-chain savings pool;
-- each jar is an off-chain allocation with its own name, goal and progress.
-- See docs/COFRINHOS_SAVINGS_JARS_CONCEPT.md

create table if not exists public.userbase_savings_jars (
  id uuid primary key default gen_random_uuid(),
  -- The Hive account that owns this jar. Ownership is proven via Hive-signature
  -- auth (see app/api/cofrinhos/auth), not a Supabase auth.uid mapping.
  hive_account text not null,
  name text not null,
  -- Goal amount in HBD (nullable for open-ended jars).
  target_hbd numeric(12,3),
  -- Current virtual allocation in HBD. Sum of allocations per account must stay
  -- <= the on-chain HBD savings balance (enforced in the API layer).
  allocated_hbd numeric(12,3) not null default 0,
  deadline date,
  icon text not null default '🐷',
  color text not null default '#34d399',
  -- Goal-tracking only (no real allocation backing it).
  is_wishlist boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint userbase_savings_jars_allocated_nonneg check (allocated_hbd >= 0),
  constraint userbase_savings_jars_target_pos
    check (target_hbd is null or target_hbd > 0),
  constraint userbase_savings_jars_name_len
    check (char_length(name) between 1 and 60)
);

-- Primary lookup: all jars for an account, in display order.
create index if not exists userbase_savings_jars_account_idx
  on public.userbase_savings_jars (lower(hive_account), sort_order);

comment on table public.userbase_savings_jars is
  'Virtual savings jars (cofrinhos) layered over a Hive account HBD savings balance';
comment on column public.userbase_savings_jars.hive_account is
  'Owning Hive account; ownership proven via Hive-signature auth in the API layer';
comment on column public.userbase_savings_jars.allocated_hbd is
  'Virtual HBD allocated to this jar; sum per account must stay <= on-chain savings';
comment on column public.userbase_savings_jars.is_wishlist is
  'When true the jar is a goal tracker only, not backed by a real allocation';

-- Keep updated_at fresh on every mutation.
create or replace function public.userbase_savings_jars_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists userbase_savings_jars_touch
  on public.userbase_savings_jars;
create trigger userbase_savings_jars_touch
  before update on public.userbase_savings_jars
  for each row execute function public.userbase_savings_jars_touch_updated_at();
