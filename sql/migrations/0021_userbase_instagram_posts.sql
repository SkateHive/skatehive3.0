-- 0021_userbase_instagram_posts.sql
-- Attribution + rate-limit registry for Instagram cross-posts from the SkateHive web feed.
-- The publisher is always the shared @skatehive IG Business account, so this table
-- records WHO on SkateHive triggered the cross-post and the Hive permalink it mirrors.

create table if not exists public.userbase_instagram_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.userbase_users(id) on delete set null,
  hive_author text not null,
  hive_permlink text not null,
  ig_media_type text not null default 'IMAGE', -- IMAGE | REELS
  ig_container_id text,
  ig_media_id text,
  ig_permalink text,
  caption text,
  image_url text,
  video_url text,
  status text not null default 'queued', -- queued | published | failed
  error text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

-- A given (hive_author, hive_permlink) can only be cross-posted once.
create unique index if not exists userbase_instagram_posts_author_permlink_uniq
  on public.userbase_instagram_posts(hive_author, hive_permlink);

create index if not exists userbase_instagram_posts_user_id_idx
  on public.userbase_instagram_posts(user_id);

create index if not exists userbase_instagram_posts_created_at_idx
  on public.userbase_instagram_posts(created_at desc);

-- RLS: only the service role touches this table; the client never reads it directly.
alter table public.userbase_instagram_posts enable row level security;
alter table public.userbase_instagram_posts force row level security;

create policy "Service role can manage userbase_instagram_posts"
  on public.userbase_instagram_posts
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.userbase_instagram_posts from anon, authenticated;
