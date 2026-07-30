-- 0029_userbase_crosspost_queue.sql
-- Review queue for outbound cross-posts (Instagram + Farcaster).
--
-- Before this migration a user toggling "cross-post" published straight to the
-- shared @skatehive Instagram / their Farcaster account. Now every user-
-- initiated cross-post lands here as `pending_review` and the curation team
-- decides IF and WHEN it goes out. Publishing only happens on approval.
--
-- The queue is the source of truth for review state and the publish result.
-- `userbase_instagram_posts` is still written on a successful IG publish so the
-- existing dedupe / rate-limit / preview code keeps working unchanged.

create table if not exists public.userbase_crosspost_queue (
  id uuid primary key default gen_random_uuid(),

  -- WHO asked for the cross-post (the snap author, or the moderator on a force).
  user_id uuid references public.userbase_users(id) on delete set null,
  requested_by_handle text,                -- Hive handle at request time (denormalized for the portal)

  target text not null,                    -- instagram | farcaster
  -- Source snap. NULL for Farcaster casts with no Hive counterpart (rare:
  -- Farcaster-only replies). NULLs are distinct in Postgres unique indexes,
  -- so those rows never collide with each other.
  hive_author text,
  hive_permlink text,

  status text not null default 'pending_review',
  -- pending_review → approved → publishing → published
  --               ↘ rejected
  --                            ↘ failed (retryable: back to approved)

  -- Everything needed to publish later, already normalized by the API route
  -- that enqueued it (caption, embeds, media URLs, channel, collaborators…).
  -- Deliberately NOT the raw request body — no secrets, no signer uuid: the
  -- Farcaster signer is re-resolved from userbase_identities at publish time
  -- so a revoked signer is respected.
  payload jsonb not null default '{}'::jsonb,

  -- Review
  reviewed_by_handle text,
  reviewed_by_user_id uuid references public.userbase_users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,                        -- rejection reason / curator notes

  -- Publish outcome
  attempts integer not null default 0,
  published_at timestamptz,
  publish_error text,
  result jsonb,                            -- { ig_media_id, ig_permalink } | { cast_hash }

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint userbase_crosspost_queue_target_chk
    check (target in ('instagram', 'farcaster')),
  constraint userbase_crosspost_queue_status_chk
    check (status in ('pending_review', 'approved', 'publishing', 'published', 'rejected', 'failed'))
);

-- One ACTIVE request per (target, snap). A rejected or failed row does NOT
-- block a later resubmission — that's the whole point of the partial index.
create unique index if not exists userbase_crosspost_queue_active_uniq
  on public.userbase_crosspost_queue(target, hive_author, hive_permlink)
  where status in ('pending_review', 'approved', 'publishing', 'published');

-- The portal's main view: oldest pending first.
create index if not exists userbase_crosspost_queue_status_created_idx
  on public.userbase_crosspost_queue(status, created_at);

create index if not exists userbase_crosspost_queue_target_status_idx
  on public.userbase_crosspost_queue(target, status);

create index if not exists userbase_crosspost_queue_user_id_idx
  on public.userbase_crosspost_queue(user_id);

-- RLS: service role only. The portal reads through the SkateHive API (which
-- holds the Meta / Neynar credentials), never through the anon Supabase key.
alter table public.userbase_crosspost_queue enable row level security;
alter table public.userbase_crosspost_queue force row level security;

drop policy if exists "Service role can manage userbase_crosspost_queue"
  on public.userbase_crosspost_queue;

create policy "Service role can manage userbase_crosspost_queue"
  on public.userbase_crosspost_queue
  for all
  using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

revoke all on table public.userbase_crosspost_queue from anon, authenticated;

-- Both writers reach this over PostgREST with a service-role key: this app
-- (enqueue) and the SkateHive portal (review decisions). Supabase's default
-- privileges normally cover new tables in `public`, but granting explicitly
-- turns a misconfigured project into a plain permission error instead of a
-- confusing PGRST205 that reads like "the table doesn't exist".
-- No DELETE: rows are the audit trail.
grant select, insert, update on table public.userbase_crosspost_queue to service_role;
