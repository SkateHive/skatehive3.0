-- 0045_savings_jars_usdc.sql
-- Cofrinhos in USDC: the same virtual-jar model as HBD, layered over a
-- wallet's USDC position in the Morpho vault used by the wallet Earn tab
-- (lib/evm/earn.ts). See docs/COFRINHOS_SAVINGS_JARS_CONCEPT.md.
--
-- A jar is owned by exactly one identity, and the identity fixes the currency:
--   Hive account  -> HBD  (over the account's HBD savings, unchanged)
--   EVM address   -> USDC (over the address's Morpho USDC position)
-- owner_key ('hive:<account>' | 'evm:<0x address>') gives every query one
-- column to scope by, whatever the owner kind.
--
-- allocated_hbd / target_hbd keep their names (the deployed HBD UI reads them)
-- but hold the amount in the jar's currency. USDC amounts are stored with
-- 3 decimals; the server floors the on-chain position to 3 decimals before
-- the invariant check, so rounding can never allocate money that isn't there.
--
-- Additive and idempotent: existing jars become currency = 'HBD' and keep
-- working with the current code. Rollback: 0045_savings_jars_usdc.rollback.sql

-- ---------------------------------------------------------------------------
-- Jars
-- ---------------------------------------------------------------------------
alter table public.userbase_savings_jars
  add column if not exists currency text not null default 'HBD',
  add column if not exists evm_address text;

alter table public.userbase_savings_jars
  alter column hive_account drop not null;

alter table public.userbase_savings_jars
  drop constraint if exists userbase_savings_jars_owner_currency;
alter table public.userbase_savings_jars
  add constraint userbase_savings_jars_owner_currency check (
    (currency = 'HBD' and hive_account is not null and evm_address is null)
    or (currency = 'USDC' and evm_address is not null and hive_account is null)
  );

alter table public.userbase_savings_jars
  drop constraint if exists userbase_savings_jars_evm_address_format;
alter table public.userbase_savings_jars
  add constraint userbase_savings_jars_evm_address_format
    check (evm_address is null or evm_address ~ '^0x[0-9a-f]{40}$');

alter table public.userbase_savings_jars
  add column if not exists owner_key text generated always as (
    case
      when hive_account is not null then 'hive:' || lower(hive_account)
      else 'evm:' || evm_address
    end
  ) stored;

create index if not exists userbase_savings_jars_owner_idx
  on public.userbase_savings_jars (owner_key, sort_order);

comment on column public.userbase_savings_jars.currency is
  'HBD (Hive savings) or USDC (Morpho vault position); fixed by the owner kind';
comment on column public.userbase_savings_jars.evm_address is
  'Owning EVM address (lowercase) for USDC jars; ownership proven via wallet signature';
comment on column public.userbase_savings_jars.allocated_hbd is
  'Virtual allocation in the jar currency (name kept for compatibility)';
comment on column public.userbase_savings_jars.target_hbd is
  'Goal amount in the jar currency (name kept for compatibility)';

-- ---------------------------------------------------------------------------
-- Events ledger
-- ---------------------------------------------------------------------------
alter table public.userbase_savings_jar_events
  add column if not exists evm_address text;

alter table public.userbase_savings_jar_events
  alter column hive_account drop not null;

alter table public.userbase_savings_jar_events
  drop constraint if exists userbase_savings_jar_events_one_owner;
alter table public.userbase_savings_jar_events
  add constraint userbase_savings_jar_events_one_owner
    check ((hive_account is null) <> (evm_address is null));

alter table public.userbase_savings_jar_events
  add column if not exists owner_key text generated always as (
    case
      when hive_account is not null then 'hive:' || lower(hive_account)
      else 'evm:' || evm_address
    end
  ) stored;

comment on column public.userbase_savings_jar_events.amount_hbd is
  'Amount in the jar currency (name kept for compatibility)';

-- ---------------------------------------------------------------------------
-- Consumed auth challenges (replay protection) now also cover wallet logins
-- ---------------------------------------------------------------------------
alter table public.userbase_cofrinhos_used_challenges
  add column if not exists evm_address text;

alter table public.userbase_cofrinhos_used_challenges
  alter column hive_account drop not null;

alter table public.userbase_cofrinhos_used_challenges
  drop constraint if exists userbase_cofrinhos_used_challenges_one_owner;
alter table public.userbase_cofrinhos_used_challenges
  add constraint userbase_cofrinhos_used_challenges_one_owner
    check ((hive_account is null) <> (evm_address is null));

-- ---------------------------------------------------------------------------
-- Atomic allocate, scoped by owner_key (any currency).
-- Same logic as cofrinhos_allocate (0028), which stays in place for the
-- currently deployed code until it is switched over.
-- ---------------------------------------------------------------------------
create or replace function public.cofrinhos_allocate_owner(
  p_owner_key text,
  p_jar_id uuid,
  p_delta numeric,
  p_on_chain_savings numeric default 0,
  p_check_savings boolean default true
) returns public.userbase_savings_jars
language plpgsql
security definer
set search_path = public
as $$
declare
  jar_row public.userbase_savings_jars;
  new_allocated numeric(12,3);
  other_allocated numeric(12,3);
begin
  if (auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'Unauthorized';
  end if;

  if p_owner_key is null or p_jar_id is null or p_delta is null
     or p_on_chain_savings is null or p_check_savings is null then
    raise exception 'Invalid input';
  end if;

  -- Serialize per owner: lock every jar row of this owner before reading.
  perform 1 from public.userbase_savings_jars
    where owner_key = p_owner_key
    for update;

  select * into jar_row
    from public.userbase_savings_jars
    where id = p_jar_id and owner_key = p_owner_key;

  if jar_row is null then
    raise exception 'Jar not found';
  end if;

  if jar_row.is_wishlist then
    raise exception 'Wishlist jars cannot hold funds';
  end if;

  new_allocated := round(jar_row.allocated_hbd + p_delta, 3);
  if new_allocated < 0 then
    raise exception 'Cannot remove more than the jar holds';
  end if;

  -- An owner's jars all share one currency (owner_currency constraint), so
  -- summing by owner_key is summing within that currency's balance.
  if p_delta > 0 and p_check_savings then
    select coalesce(sum(allocated_hbd), 0) into other_allocated
      from public.userbase_savings_jars
      where owner_key = p_owner_key
        and id <> p_jar_id
        and not is_wishlist;

    if round(other_allocated + new_allocated, 3) > p_on_chain_savings + 0.000001 then
      raise exception 'Not enough unallocated savings';
    end if;
  end if;

  update public.userbase_savings_jars
    set allocated_hbd = new_allocated
    where id = p_jar_id
    returning * into jar_row;

  return jar_row;
end;
$$;

revoke all on function public.cofrinhos_allocate_owner(text, uuid, numeric, numeric, boolean)
  from public, anon, authenticated;
grant execute on function public.cofrinhos_allocate_owner(text, uuid, numeric, numeric, boolean)
  to service_role;
