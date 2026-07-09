-- 0024_userbase_moderation.sql
-- Userbase moderation labels used to hide abusive app-account content.

alter table public.userbase_users
add column if not exists moderation_status text not null default 'clear';

alter table public.userbase_users
add column if not exists moderation_reason text;

alter table public.userbase_users
add column if not exists moderated_at timestamptz;

alter table public.userbase_users
add column if not exists moderated_by text;

alter table public.userbase_users
add column if not exists moderation_metadata jsonb not null default '{}'::jsonb;

alter table public.userbase_users
drop constraint if exists userbase_users_moderation_status_check;

alter table public.userbase_users
add constraint userbase_users_moderation_status_check
check (moderation_status in ('clear', 'suspicious', 'blocked'));

create index if not exists userbase_users_moderation_status_idx
on public.userbase_users(moderation_status)
where moderation_status <> 'clear';

create table if not exists public.userbase_moderation_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.userbase_users(id) on delete cascade,
  previous_status text,
  status text not null,
  reason text,
  actor text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists userbase_moderation_events_user_created_idx
on public.userbase_moderation_events(user_id, created_at desc);

alter table public.userbase_moderation_events enable row level security;
alter table public.userbase_moderation_events force row level security;

drop policy if exists "Service role can manage userbase_moderation_events"
on public.userbase_moderation_events;

create policy "Service role can manage userbase_moderation_events"
on public.userbase_moderation_events
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

revoke all on table public.userbase_moderation_events from anon, authenticated;
