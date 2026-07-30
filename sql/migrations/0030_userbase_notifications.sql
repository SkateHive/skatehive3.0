-- 0030_userbase_notifications.sql
-- App-owned notification store.
--
-- SkateHive's notification page reads Hive's bridge.account_notifications —
-- votes, replies, follows, mentions. Those are blockchain events. Anything the
-- APP decides (a cross-post was approved, a sponsorship went through) has no
-- Hive counterpart and had nowhere to live, so users simply never found out.
--
-- This table is that missing half. First producer is the cross-post curation
-- queue (0029): approve / reject writes a row here for the requesting author.
-- Kept deliberately generic — `type` + `metadata` so new producers don't need
-- a schema change.

create table if not exists public.userbase_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.userbase_users(id) on delete cascade,

  -- crosspost_approved | crosspost_rejected | crosspost_failed | …
  type text not null,

  title text not null,
  body text,
  -- Where clicking it should take the user (relative in-app path, or an
  -- absolute URL for e.g. the published Instagram post).
  link text,

  -- Producer-specific extras (queue_id, target platform, ig_permalink…).
  metadata jsonb not null default '{}'::jsonb,

  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- The inbox query: this user's notifications, newest first.
create index if not exists userbase_notifications_user_created_idx
  on public.userbase_notifications(user_id, created_at desc);

-- The badge query: unread count. Partial so it stays small as history grows.
create index if not exists userbase_notifications_unread_idx
  on public.userbase_notifications(user_id)
  where read_at is null;

-- RLS: service role only. Clients read through /api/userbase/notifications,
-- which resolves the user from the session cookie — never the anon key.
alter table public.userbase_notifications enable row level security;
alter table public.userbase_notifications force row level security;

drop policy if exists "Service role can manage userbase_notifications"
  on public.userbase_notifications;

create policy "Service role can manage userbase_notifications"
  on public.userbase_notifications
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.userbase_notifications from anon, authenticated;

-- INSERT for both writers (this app files `crosspost_queued`, the portal files
-- the outcomes); SELECT and UPDATE for this app's inbox and mark-as-read.
-- Explicit for the same reason as 0029: a missing default privilege should
-- surface as a permission error, not a PGRST205.
grant select, insert, update on table public.userbase_notifications to service_role;
