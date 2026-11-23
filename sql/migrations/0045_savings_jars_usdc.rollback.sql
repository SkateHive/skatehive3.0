-- 0045_savings_jars_usdc.rollback.sql
-- Removes USDC jars and the owner_key columns added in 0045. Deletes every
-- USDC jar and its history (no money moves: the USDC stays in the user's
-- Morpho position). HBD jars are untouched.
-- Deploy code that no longer calls cofrinhos_allocate_owner before running this.

begin;

drop function if exists public.cofrinhos_allocate_owner(text, uuid, numeric, numeric, boolean);

-- Jar events cascade with their jars.
delete from public.userbase_savings_jars where currency <> 'HBD';
delete from public.userbase_cofrinhos_used_challenges where hive_account is null;

drop index if exists public.userbase_savings_jars_owner_idx;

alter table public.userbase_savings_jars
  drop constraint if exists userbase_savings_jars_owner_currency,
  drop constraint if exists userbase_savings_jars_evm_address_format,
  drop column if exists owner_key,
  drop column if exists evm_address,
  drop column if exists currency;
alter table public.userbase_savings_jars alter column hive_account set not null;

alter table public.userbase_savings_jar_events
  drop constraint if exists userbase_savings_jar_events_one_owner,
  drop column if exists owner_key,
  drop column if exists evm_address;
alter table public.userbase_savings_jar_events alter column hive_account set not null;

alter table public.userbase_cofrinhos_used_challenges
  drop constraint if exists userbase_cofrinhos_used_challenges_one_owner,
  drop column if exists evm_address;
alter table public.userbase_cofrinhos_used_challenges alter column hive_account set not null;

commit;
