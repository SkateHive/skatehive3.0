-- 0025_userbase_savings_jars_rls.sql
-- RLS for userbase_savings_jars.
-- Jars are not mapped to a Supabase auth.uid; ownership is a Hive account proven
-- via Hive-signature auth in the API layer, which uses the service role client.
-- So the table is locked down to service role only; the API enforces per-account
-- ownership before every read/write.

alter table public.userbase_savings_jars enable row level security;
alter table public.userbase_savings_jars force row level security;

-- Service role (our API routes) can manage all jars.
create policy "Service role can manage userbase_savings_jars"
  on public.userbase_savings_jars
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- No direct anon/authenticated access: everything goes through the API.
revoke all on table public.userbase_savings_jars from anon, authenticated;
