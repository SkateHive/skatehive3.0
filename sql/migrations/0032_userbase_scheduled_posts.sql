-- 0032_userbase_scheduled_posts.sql
-- ⚠ APPLY MANUALLY in the Supabase SQL editor — this repo has no migration
--   runner. Nothing schedules until this has been run.
-- (Renumbered from 0025: main already had two 0025_* migrations.)
-- Scheduled posts: Hive posts queued for future broadcast via posting authority delegation.
-- The cron broadcasts them as author = hive_author once scheduled_at is reached,
-- signing with DEFAULT_HIVE_POSTING_KEY (the account must have granted posting authority).

create table if not exists public.userbase_scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.userbase_users(id) on delete cascade,
  hive_author text not null,          -- real Hive account; appears as author on-chain
  parent_author text not null default '',
  parent_permlink text not null,       -- community tag or category (e.g. "hive-173115")
  permlink text not null,
  title text not null default '',
  body text not null,
  json_metadata jsonb not null default '{}'::jsonb,
  beneficiaries jsonb not null default '[]'::jsonb,
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'broadcasted', 'failed', 'cancelled')),
  -- Set by the atomic claim in /scheduled-posts/process. Two trigger sources
  -- exist on purpose (Vercel daily cron + the SOPA portal's hourly external
  -- tick), so a row must be claimed (pending → processing) before broadcast.
  claimed_at timestamptz,
  last_error text,
  broadcasted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevent the same (author, permlink) from ever reaching the chain twice
create unique index if not exists userbase_scheduled_posts_author_permlink_uniq
  on public.userbase_scheduled_posts(hive_author, permlink);

-- Cron fast path: pending posts ordered by due time (partial index keeps it tiny)
create index if not exists userbase_scheduled_posts_pending_due_idx
  on public.userbase_scheduled_posts(scheduled_at asc)
  where status = 'pending';

-- Per-user listing in the UI
create index if not exists userbase_scheduled_posts_user_id_idx
  on public.userbase_scheduled_posts(user_id, created_at desc);

comment on table public.userbase_scheduled_posts is 'Posts scheduled for future broadcast via Hive posting authority delegation';
comment on column public.userbase_scheduled_posts.hive_author is 'Real Hive account appearing as author on-chain; must have granted posting authority to DEFAULT_HIVE_POSTING_ACCOUNT before scheduled_at';
comment on column public.userbase_scheduled_posts.parent_permlink is 'Community tag or category, e.g. hive-173115 for SkateHive community';
comment on column public.userbase_scheduled_posts.permlink is 'Generated at creation time so it is stable and idempotent across cron retries';
comment on column public.userbase_scheduled_posts.status is 'pending → processing → broadcasted | failed | cancelled';

-- RLS: only the service role touches this table directly; the client goes through API routes
alter table public.userbase_scheduled_posts enable row level security;
alter table public.userbase_scheduled_posts force row level security;

create policy "Service role can manage userbase_scheduled_posts"
  on public.userbase_scheduled_posts
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.userbase_scheduled_posts from anon, authenticated;

-- Liveness for the external trigger: every /process tick upserts its row here.
-- The UI reads it to tell users when processing is delayed (no tick for >3h)
-- instead of silently sitting on their scheduled posts.
create table if not exists public.userbase_cron_heartbeat (
  id text primary key,
  last_tick_at timestamptz not null default now(),
  source text
);
alter table public.userbase_cron_heartbeat enable row level security;
alter table public.userbase_cron_heartbeat force row level security;
create policy "Service role can manage userbase_cron_heartbeat"
  on public.userbase_cron_heartbeat
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');
revoke all on table public.userbase_cron_heartbeat from anon, authenticated;
