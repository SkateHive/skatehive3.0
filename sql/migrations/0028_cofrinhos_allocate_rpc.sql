-- 0028_cofrinhos_allocate_rpc.sql
-- Atomic allocate for cofrinhos: closes the TOCTOU window where two
-- concurrent allocate requests could each read the same jar set, both pass
-- the Sigma(allocated) <= on-chain savings check against that stale
-- snapshot, and then overwrite (or silently drop) each other's write.
-- The read + invariant check + write that used to live in
-- app/api/cofrinhos/[id]/allocate/route.ts now runs inside a single Postgres
-- transaction, serialized per account via row locks — a concurrent call for
-- the same account blocks until the first commits, then reads its result.
-- See docs/COFRINHOS_SAVINGS_JARS_CONCEPT.md and PR #206 review discussion.

create or replace function public.cofrinhos_allocate(
  p_account text,
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

  -- Lock every jar row for this account before reading any of them. A
  -- concurrent cofrinhos_allocate call for the same account blocks here
  -- until this transaction commits or rolls back, so the read-check-write
  -- below is effectively atomic per account.
  perform 1 from public.userbase_savings_jars
    where hive_account = p_account
    for update;

  select * into jar_row
    from public.userbase_savings_jars
    where id = p_jar_id and hive_account = p_account;

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

  -- Only funding (positive delta) needs the savings ceiling check; the
  -- caller passes p_check_savings = false for withdrawals, matching the
  -- original route logic.
  if p_delta > 0 and p_check_savings then
    select coalesce(sum(allocated_hbd), 0) into other_allocated
      from public.userbase_savings_jars
      where hive_account = p_account
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

revoke all on function public.cofrinhos_allocate(text, uuid, numeric, numeric, boolean)
  from anon, authenticated;
