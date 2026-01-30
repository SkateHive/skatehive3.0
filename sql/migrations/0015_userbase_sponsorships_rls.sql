-- 0015_userbase_sponsorships_rls.sql
-- RLS for userbase_sponsorships

alter table public.userbase_sponsorships enable row level security;
alter table public.userbase_sponsorships force row level security;

-- Service role can manage all sponsorships (for background processing)
create policy "Service role can manage userbase_sponsorships" on public.userbase_sponsorships
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- Users can view sponsorships they're involved in (as sponsor or sponsored user)
create policy "Users can view their own sponsorships" on public.userbase_sponsorships
  for select
  using (
    auth.uid()::text = lite_user_id::text
    or auth.uid()::text = sponsor_user_id::text
  );

-- Users can view completed sponsorships (for public leaderboard/feed)
create policy "Anyone can view completed sponsorships" on public.userbase_sponsorships
  for select
  using (status = 'completed');

-- Revoke default permissions
revoke all on table public.userbase_sponsorships from anon, authenticated;

-- Grant select to authenticated users (subject to RLS policies above)
grant select on table public.userbase_sponsorships to authenticated;
