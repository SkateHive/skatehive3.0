-- 0027_userbase_cofrinhos_used_challenges.sql
-- Replay protection for cofrinhos auth: a signed challenge mints exactly one
-- session cookie. The verify endpoint records the challenge nonce here on
-- success; the primary key makes the first insert win, so a replayed
-- message+signature fails atomically at the database instead of racing an
-- application-level check.
-- Rows only need to outlive the 10-minute challenge TTL; the verify endpoint
-- deletes expired rows opportunistically (no cron needed).

create table if not exists public.userbase_cofrinhos_used_challenges (
  nonce text primary key,
  hive_account text not null,
  used_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists userbase_cofrinhos_used_challenges_expires_idx
  on public.userbase_cofrinhos_used_challenges (expires_at);

comment on table public.userbase_cofrinhos_used_challenges is
  'Consumed cofrinhos auth challenge nonces; insert-once enforces single-use';

-- RLS: same model as the other cofrinhos tables — service role only.
alter table public.userbase_cofrinhos_used_challenges enable row level security;
alter table public.userbase_cofrinhos_used_challenges force row level security;

create policy "Service role can manage userbase_cofrinhos_used_challenges"
  on public.userbase_cofrinhos_used_challenges
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.userbase_cofrinhos_used_challenges from anon, authenticated;
