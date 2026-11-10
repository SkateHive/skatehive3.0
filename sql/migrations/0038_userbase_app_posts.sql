-- 0038_userbase_app_posts.sql
-- ⚠ APPLY MANUALLY in the Supabase SQL editor (no migration runner).
--   Needs 0036 (app sessions + memberships). Rollback:
--   0038_userbase_app_posts.rollback.sql. Local test:
--   bash scripts/test-0038-app-posts.sh (Docker; never touches Supabase).
--
-- Community posts for partner apps, moderated before they go to Hive. First
-- app: Coletivo XV (app = 'coletivoxv'). People post text, photos or video,
-- optionally about an installation or an event. A moderator approves; the API
-- then publishes as the author (their own key, or the shared default account
-- with soft-post attribution) and may enqueue an Instagram crosspost in the
-- existing userbase_crosspost_queue.
--
-- Trust model (fail closed everywhere):
--   * Authors and moderators are identified ONLY by their app session token,
--     resolved inside the database (0036). The API never passes their user id.
--   * Moderator = handle on userbase_app_moderator_allowlist AND a live row in
--     userbase_app_moderators. That row is written only by
--     userbase_app_moderator_bind(), which atomically consumes a single-use
--     challenge the same session created; the API verifies the Hive
--     posting-key signature over the challenge message before calling it. The
--     binding also records the verified email (auth_method_id) of that
--     session, and every moderator check requires the CURRENT session to come
--     from the same email: adding another email to the account later does not
--     inherit moderator rights. userbase_identities.verified_at is never used.
--   * Post content is immutable from creation (trigger). Status changes follow
--     a fixed state machine (trigger), use compare-and-swap (expected status /
--     claim token), and are written to an append-only event log.
--   * The Hive destination is fixed before any broadcast: the permlink is
--     derived from the post id at insert, the author is reserved once per post
--     and can never change (a different signer fails as signer_changed).
--   * Follow-ups after publishing (soft-post attribution, Instagram enqueue)
--     go through a transactional outbox: recoverable, never re-publish.
--   * No email is stored or returned anywhere in this file.
--
-- Error contract (SQLSTATE -> HTTP): UB401 no/invalid session, UB403 not
-- allowed, UB404 not found, UB409 conflict (state changed, lost claim, key
-- reused with another body, handle bound elsewhere), UB410 challenge expired
-- or used, UB422 invalid input, UB429 rate limited.
--
-- Only service_role touches any of it. Safe to run more than once; one
-- transaction; additive.
--
-- Not covered: userbase_merge_users does not move posts or moderator rows
-- (same documented gap as 0034/0036).

begin;

-- ---------------------------------------------------------------------------
-- Moderators
-- ---------------------------------------------------------------------------

create table if not exists public.userbase_app_moderator_allowlist (
  app text not null
    constraint userbase_app_moderator_allowlist_app_format
      check (app ~ '^[a-z0-9][a-z0-9_-]{1,31}$'),
  hive_handle text not null
    constraint userbase_app_moderator_allowlist_handle_format
      check (hive_handle ~ '^[a-z][a-z0-9.-]{2,15}$'),
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (app, hive_handle)
);

-- Being listed grants nothing on its own: each handle still needs a binding.
insert into public.userbase_app_moderator_allowlist (app, hive_handle) values
  ('coletivoxv', 'pharraxv'),
  ('coletivoxv', 'wilbor'),
  ('coletivoxv', 'xvlad')
on conflict (app, hive_handle) do nothing;

create table if not exists public.userbase_app_moderator_challenges (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  user_id uuid not null references public.userbase_users(id) on delete cascade,
  -- The verified email of the session that asked; the binding inherits it.
  auth_method_id uuid not null references public.userbase_auth_methods(id) on delete cascade,
  hive_handle text not null,
  nonce text not null constraint userbase_app_moderator_challenges_nonce_uniq unique,
  message text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint userbase_app_moderator_challenges_ttl
    check (expires_at > created_at and expires_at <= created_at + interval '10 minutes'),
  constraint userbase_app_moderator_challenges_allowlisted
    foreign key (app, hive_handle)
    references public.userbase_app_moderator_allowlist(app, hive_handle)
);

create index if not exists userbase_app_moderator_challenges_user_idx
  on public.userbase_app_moderator_challenges(user_id, created_at desc);

create table if not exists public.userbase_app_moderators (
  id uuid primary key default gen_random_uuid(),
  app text not null,
  hive_handle text not null,
  user_id uuid not null references public.userbase_users(id) on delete cascade,
  -- Moderator rights only for sessions issued through this email.
  auth_method_id uuid not null references public.userbase_auth_methods(id) on delete cascade,
  -- The posting public key the signature recovered to.
  public_key text not null
    constraint userbase_app_moderators_public_key_format
      check (public_key ~ '^STM[1-9A-HJ-NP-Za-km-z]{45,55}$'),
  challenge_id uuid not null
    constraint userbase_app_moderators_challenge_uniq unique
    references public.userbase_app_moderator_challenges(id),
  bound_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint userbase_app_moderators_allowlisted
    foreign key (app, hive_handle)
    references public.userbase_app_moderator_allowlist(app, hive_handle)
);

create unique index if not exists userbase_app_moderators_live_handle_uniq
  on public.userbase_app_moderators(app, hive_handle) where revoked_at is null;
create unique index if not exists userbase_app_moderators_live_user_uniq
  on public.userbase_app_moderators(app, user_id) where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Posts
-- ---------------------------------------------------------------------------

-- Media shape per kind. Hosts are limited to what the API produces: images on
-- images.hive.blog or ipfs.skatehive.app, video on ipfs.skatehive.app/ipfs/<CID>.
create or replace function public.userbase_app__media_valid(p_kind text, p_media jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select jsonb_typeof(p_media) = 'array'
    and jsonb_array_length(p_media) <= 10
    and not exists (
      select 1 from jsonb_array_elements(p_media) e
      where jsonb_typeof(e) <> 'object'
         or coalesce(e->>'type', '') not in ('image', 'video')
         or (e->>'type' = 'image' and coalesce(e->>'url', '')
               !~ '^https://(images\.hive\.blog|ipfs\.skatehive\.app)/[^\s"<>]+$')
         or (e->>'type' = 'video' and coalesce(e->>'url', '')
               !~ '^https://ipfs\.skatehive\.app/ipfs/[A-Za-z0-9]{20,100}$')
         or (e ? 'poster' and coalesce(e->>'poster', '')
               !~ '^https://(ipfs\.skatehive\.app|images\.hive\.blog)/[^\s"<>]+$')
         or length(coalesce(e->>'url', '')) > 2048
         or length(coalesce(e->>'poster', '')) > 2048
         or (e ? 'alt' and length(coalesce(e->>'alt', '')) > 500)
         or exists (select 1 from jsonb_object_keys(e) k
                    where k not in ('type', 'url', 'poster', 'alt', 'width', 'height',
                                    'duration_seconds', 'mime'))
    )
    and case p_kind
      when 'text'  then jsonb_array_length(p_media) = 0
      when 'photo' then jsonb_array_length(p_media) >= 1
                        and not exists (select 1 from jsonb_array_elements(p_media) e
                                        where e->>'type' <> 'image')
      when 'video' then exists (select 1 from jsonb_array_elements(p_media) e
                                where e->>'type' = 'video')
      else false
    end;
$$;

create or replace function public.userbase_app__body_hash(
  p_kind text, p_title text, p_body text, p_media jsonb, p_context_kind text, p_context_slug text
)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'kind', p_kind, 'title', p_title, 'body', p_body, 'media', p_media,
    'context_kind', p_context_kind, 'context_slug', p_context_slug)::text, 'UTF8')), 'hex');
$$;

create table if not exists public.userbase_app_posts (
  id uuid primary key default gen_random_uuid(),
  app text not null
    constraint userbase_app_posts_app_format check (app ~ '^[a-z0-9][a-z0-9_-]{1,31}$'),
  user_id uuid not null references public.userbase_users(id) on delete restrict,
  idempotency_key text not null
    constraint userbase_app_posts_idem_format check (length(idempotency_key) between 8 and 100),
  -- sha256 of the normalized request (API side); same key + other hash = 409.
  request_hash text not null
    constraint userbase_app_posts_request_hash_format check (request_hash ~ '^[0-9a-f]{64}$'),
  kind text not null constraint userbase_app_posts_kind check (kind in ('text', 'photo', 'video')),
  title text constraint userbase_app_posts_title_len check (title is null or length(title) between 1 and 120),
  body text not null default '' constraint userbase_app_posts_body_len check (length(body) <= 5000),
  media jsonb not null default '[]'::jsonb,
  context_kind text constraint userbase_app_posts_context_kind
    check (context_kind is null or context_kind in ('instalacao', 'evento')),
  context_slug text constraint userbase_app_posts_context_slug
    check (context_slug is null or context_slug ~ '^[a-z0-9-]{1,64}$'),
  consent_publish_at timestamptz not null,
  -- sha256 of the content as stored; maintained by trigger.
  body_hash text not null default '',
  status text not null default 'pending'
    constraint userbase_app_posts_status
      check (status in ('pending', 'approved', 'publishing', 'published', 'rejected', 'failed')),
  auto_approved boolean not null default false,
  reviewed_by uuid references public.userbase_users(id) on delete set null,
  reviewed_by_hive_handle text,
  reviewed_at timestamptz,
  reject_reason text constraint userbase_app_posts_reject_reason_len
    check (reject_reason is null or length(reject_reason) <= 500),
  -- Hive destination. Permlink fixed at insert; author reserved once.
  publish_permlink text not null default ''
    constraint userbase_app_posts_permlink_uniq unique,
  publish_author text constraint userbase_app_posts_publish_author_format
    check (publish_author is null or publish_author ~ '^[a-z][a-z0-9.-]{2,15}$'),
  publish_signer_kind text constraint userbase_app_posts_signer_kind
    check (publish_signer_kind is null or publish_signer_kind in ('own_key', 'shared_default')),
  publish_attempts integer not null default 0,
  publish_max_attempts integer not null default 5
    constraint userbase_app_posts_max_attempts check (publish_max_attempts between 1 and 20),
  publish_claim_token uuid,
  publish_lease_until timestamptz,
  publish_started_at timestamptz,
  last_error_code text constraint userbase_app_posts_error_code_format
    check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,64}$'),
  published_at timestamptz,
  crosspost_queue_id uuid references public.userbase_crosspost_queue(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint userbase_app_posts_idem_uniq unique (app, user_id, idempotency_key),
  constraint userbase_app_posts_media_valid check (public.userbase_app__media_valid(kind, media)),
  constraint userbase_app_posts_context_pair check ((context_kind is null) = (context_slug is null)),
  -- Text OR media: an empty body is fine with media; both empty is not. Title optional.
  constraint userbase_app_posts_not_empty check (length(btrim(body)) > 0 or jsonb_array_length(media) > 0),
  constraint userbase_app_posts_reviewed
    check (status in ('pending') or reviewed_at is not null),
  constraint userbase_app_posts_claim_consistent
    check ((status = 'publishing') = (publish_claim_token is not null and publish_lease_until is not null)),
  constraint userbase_app_posts_published_complete
    check (status <> 'published' or (publish_author is not null and published_at is not null)),
  constraint userbase_app_posts_signer_pair
    check ((publish_author is null) = (publish_signer_kind is null))
);

-- Public feed per context and whole app; moderation queue; "mine"; stuck jobs.
create index if not exists userbase_app_posts_feed_ctx_idx
  on public.userbase_app_posts(app, context_kind, context_slug, published_at desc, id desc)
  where status = 'published';
create index if not exists userbase_app_posts_feed_idx
  on public.userbase_app_posts(app, published_at desc, id desc) where status = 'published';
create index if not exists userbase_app_posts_status_idx
  on public.userbase_app_posts(app, status, created_at desc, id desc);
create index if not exists userbase_app_posts_user_idx
  on public.userbase_app_posts(app, user_id, created_at desc, id desc);
create index if not exists userbase_app_posts_publishing_idx
  on public.userbase_app_posts(publish_lease_until) where status = 'publishing';

create or replace function public.userbase_app__post_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.body_hash := public.userbase_app__body_hash(
      new.kind, new.title, new.body, new.media, new.context_kind, new.context_slug);
    new.publish_permlink := new.app || '-' || replace(new.id::text, '-', '');
    if not (new.status = 'pending'
            or (new.status = 'approved' and new.auto_approved and new.reviewed_at is not null))
       or new.publish_author is not null or new.publish_attempts <> 0
       or new.published_at is not null or new.crosspost_queue_id is not null then
      raise exception 'new posts start pending (or auto-approved)' using errcode = 'UB422';
    end if;
    return new;
  end if;

  -- Everything that defines the post, its consent and its Hive destination.
  if (new.id, new.app, new.user_id, new.idempotency_key, new.request_hash, new.kind,
      new.title, new.body, new.media, new.context_kind, new.context_slug,
      new.consent_publish_at, new.body_hash, new.publish_permlink, new.auto_approved,
      new.created_at)
     is distinct from
     (old.id, old.app, old.user_id, old.idempotency_key, old.request_hash, old.kind,
      old.title, old.body, old.media, old.context_kind, old.context_slug,
      old.consent_publish_at, old.body_hash, old.publish_permlink, old.auto_approved,
      old.created_at) then
    raise exception 'post content is immutable' using errcode = 'UB409';
  end if;

  if old.publish_author is not null and
     (new.publish_author, new.publish_signer_kind) is distinct from
     (old.publish_author, old.publish_signer_kind) then
    raise exception 'hive author is fixed once reserved' using errcode = 'UB409';
  end if;
  if old.crosspost_queue_id is not null
     and new.crosspost_queue_id is distinct from old.crosspost_queue_id
     and new.crosspost_queue_id is not null then
    raise exception 'crosspost already linked' using errcode = 'UB409';
  end if;
  if old.reviewed_at is not null and
     (new.reviewed_by, new.reviewed_by_hive_handle, new.reviewed_at) is distinct from
     (old.reviewed_by, old.reviewed_by_hive_handle, old.reviewed_at)
     and not (old.reviewed_by is not null and new.reviewed_by is null
              and new.reviewed_at = old.reviewed_at) then  -- reviewer account deleted
    raise exception 'review is immutable' using errcode = 'UB409';
  end if;

  if new.status <> old.status and not (
       (old.status = 'pending'    and new.status in ('approved', 'rejected'))
    or (old.status = 'approved'   and new.status in ('publishing', 'failed'))
    or (old.status = 'publishing' and new.status in ('published', 'approved', 'failed'))
    or (old.status = 'failed'     and new.status = 'approved')
  ) then
    raise exception 'transition % -> % not allowed', old.status, new.status using errcode = 'UB409';
  end if;
  return new;
end;
$$;

drop trigger if exists userbase_app_posts_guard on public.userbase_app_posts;
create trigger userbase_app_posts_guard
  before insert or update on public.userbase_app_posts
  for each row execute function public.userbase_app__post_guard();

-- ---------------------------------------------------------------------------
-- Append-only event log
-- ---------------------------------------------------------------------------

create table if not exists public.userbase_app_post_events (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.userbase_app_posts(id) on delete restrict,
  app text not null,
  actor_user_id uuid,              -- no FK: the log is never rewritten
  actor_hive_handle text,
  actor_kind text not null
    constraint userbase_app_post_events_actor_kind
      check (actor_kind in ('author', 'moderator', 'worker', 'system')),
  action text not null
    constraint userbase_app_post_events_action
      check (action in ('created', 'auto_approved', 'approved', 'rejected',
                        'publish_claimed', 'publish_reserved', 'publish_succeeded',
                        'publish_retry', 'publish_failed', 'publish_requeued',
                        'crosspost_linked')),
  from_status text,
  to_status text,
  detail text,
  created_at timestamptz not null default now()
);

create index if not exists userbase_app_post_events_post_idx
  on public.userbase_app_post_events(post_id, created_at);

create or replace function public.userbase_app__append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'UB409';
end;
$$;

drop trigger if exists userbase_app_post_events_append_only on public.userbase_app_post_events;
create trigger userbase_app_post_events_append_only
  before update or delete on public.userbase_app_post_events
  for each row execute function public.userbase_app__append_only();

-- ---------------------------------------------------------------------------
-- Outbox: follow-ups after a successful Hive publish (soft-post attribution,
-- Instagram enqueue). Created in the same transaction as 'published', so a
-- crash after the broadcast never loses them; each runs and retries on its own
-- and never touches the post's Hive state.
-- ---------------------------------------------------------------------------

create table if not exists public.userbase_app_post_outbox (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.userbase_app_posts(id) on delete restrict,
  kind text not null
    constraint userbase_app_post_outbox_kind check (kind in ('soft_post', 'instagram_enqueue')),
  status text not null default 'queued'
    constraint userbase_app_post_outbox_status check (status in ('queued', 'claimed', 'done', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 8
    constraint userbase_app_post_outbox_max_attempts check (max_attempts between 1 and 50),
  next_attempt_at timestamptz not null default now(),
  claim_token uuid,
  lease_until timestamptz,
  last_error_code text constraint userbase_app_post_outbox_error_code_format
    check (last_error_code is null or last_error_code ~ '^[a-z0-9_]{1,64}$'),
  result jsonb,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint userbase_app_post_outbox_once unique (post_id, kind),
  constraint userbase_app_post_outbox_claim_consistent
    check ((status = 'claimed') = (claim_token is not null and lease_until is not null))
);

create index if not exists userbase_app_post_outbox_due_idx
  on public.userbase_app_post_outbox(kind, status, next_attempt_at);

-- ---------------------------------------------------------------------------
-- Privileges: service_role only
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['userbase_app_moderator_allowlist', 'userbase_app_moderator_challenges',
    'userbase_app_moderators', 'userbase_app_posts', 'userbase_app_post_events',
    'userbase_app_post_outbox']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- Supabase default privileges grant ALL (incl. DELETE/TRUNCATE) to
    -- service_role on new tables; start from nothing and grant only what the
    -- RPCs need.
    execute format('revoke all on table public.%I from public, anon, authenticated, service_role', t);
  end loop;
end $$;

grant select, insert, update on table public.userbase_app_moderator_allowlist to service_role;
grant select, insert, update on table public.userbase_app_moderator_challenges to service_role;
grant select, insert, update on table public.userbase_app_moderators to service_role;
grant select, insert, update on table public.userbase_app_posts to service_role;
grant select, insert on table public.userbase_app_post_events to service_role;   -- append-only
grant select, insert, update on table public.userbase_app_post_outbox to service_role;

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------

-- Live app session -> (user, verified email it was issued through), or UB401.
create or replace function public.userbase_app__session(p_token_hash text, p_app text,
  out user_id uuid, out auth_method_id uuid)
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
begin
  select r.user_id into user_id
  from public.userbase_app_session_resolve(p_token_hash, p_app) r;
  if user_id is null then
    raise exception 'no valid session for this app' using errcode = 'UB401';
  end if;
  select s.auth_method_id into auth_method_id
  from public.userbase_app_sessions s
  where s.token_hash = p_token_hash and s.app = p_app;
end;
$$;

-- The moderator handle for this user+email, or null. Requires: live binding
-- for the same user AND the same email, handle still allowlisted, user active.
create or replace function public.userbase_app__moderator_handle(
  p_user_id uuid, p_auth_method_id uuid, p_app text)
returns text
language sql
stable
set search_path = public
as $$
  select m.hive_handle
  from public.userbase_app_moderators m
  join public.userbase_app_moderator_allowlist a
    on a.app = m.app and a.hive_handle = m.hive_handle and a.revoked_at is null
  join public.userbase_users u on u.id = m.user_id and u.status = 'active'
  where m.app = p_app and m.user_id = p_user_id
    and m.auth_method_id = p_auth_method_id and m.revoked_at is null
  limit 1;
$$;

create or replace function public.userbase_app__log(
  p_post public.userbase_app_posts, p_actor uuid, p_actor_handle text,
  p_actor_kind text, p_action text, p_from text, p_detail text)
returns void
language sql
volatile
set search_path = public
as $$
  insert into public.userbase_app_post_events
    (post_id, app, actor_user_id, actor_hive_handle, actor_kind, action,
     from_status, to_status, detail)
  values
    (p_post.id, p_post.app, p_actor, p_actor_handle, p_actor_kind, p_action,
     p_from, p_post.status, left(p_detail, 500));
$$;

-- ---------------------------------------------------------------------------
-- Session / moderator RPCs
-- ---------------------------------------------------------------------------

-- Who is this session? Public profile + moderator handle (or null). No email.
create or replace function public.userbase_app_me(p_token_hash text, p_app text)
returns table (user_id uuid, handle text, display_name text, avatar_url text,
               moderator_handle text)
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare s record;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  return query
  select u.id, u.handle, u.display_name, u.avatar_url,
         public.userbase_app__moderator_handle(s.user_id, s.auth_method_id, p_app)
  from public.userbase_users u where u.id = s.user_id;
end;
$$;

-- Step 1: issue a single-use challenge (5 min) for an allowlisted handle.
create or replace function public.userbase_app_moderator_challenge_create(
  p_token_hash text, p_app text, p_hive_handle text)
returns table (challenge_id uuid, message text, expires_at timestamptz)
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  s record;
  v_handle text := lower(btrim(p_hive_handle));
  v_nonce text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  v_expires timestamptz := now() + interval '5 minutes';
  v_row public.userbase_app_moderator_challenges;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  if not exists (select 1 from public.userbase_app_moderator_allowlist a
                 where a.app = p_app and a.hive_handle = v_handle and a.revoked_at is null) then
    raise exception 'handle is not a moderator of this app' using errcode = 'UB403';
  end if;
  if (select count(*) from public.userbase_app_moderator_challenges c
      where c.user_id = s.user_id and c.created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'too many challenges' using errcode = 'UB429';
  end if;

  insert into public.userbase_app_moderator_challenges
    (app, user_id, auth_method_id, hive_handle, nonce, message, expires_at)
  values
    (p_app, s.user_id, s.auth_method_id, v_handle, v_nonce,
     'moderator-binding' || chr(10) || 'app: ' || p_app || chr(10) || 'account: ' || v_handle
       || chr(10) || 'user: ' || s.user_id || chr(10) || 'nonce: ' || v_nonce
       || chr(10) || 'expires: ' || to_char(v_expires at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
     v_expires)
  returning * into v_row;
  return query select v_row.id, v_row.message, v_row.expires_at;
end;
$$;

-- Read an open challenge of this session (the API needs message + handle to
-- verify the signature). UB410 when expired/used, UB404 when not this session's.
create or replace function public.userbase_app_moderator_challenge_get(
  p_token_hash text, p_app text, p_challenge_id uuid)
returns table (challenge_id uuid, hive_handle text, message text, expires_at timestamptz)
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  s record;
  c public.userbase_app_moderator_challenges;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  select * into c from public.userbase_app_moderator_challenges x
  where x.id = p_challenge_id and x.app = p_app
    and x.user_id = s.user_id and x.auth_method_id = s.auth_method_id;
  if c.id is null then
    raise exception 'challenge not found' using errcode = 'UB404';
  end if;
  if c.used_at is not null or c.expires_at <= now() then
    raise exception 'challenge expired or used' using errcode = 'UB410';
  end if;
  return query select c.id, c.hive_handle, c.message, c.expires_at;
end;
$$;

-- Step 2 (API calls this ONLY after verifying the signature over the
-- challenge message with a key in the account's posting authority):
-- consume the challenge atomically and bind handle -> user + email.
create or replace function public.userbase_app_moderator_bind(
  p_token_hash text, p_app text, p_challenge_id uuid, p_public_key text)
returns public.userbase_app_moderators
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  s record;
  c public.userbase_app_moderator_challenges;
  v_row public.userbase_app_moderators;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);

  update public.userbase_app_moderator_challenges x
    set used_at = now()
    where x.id = p_challenge_id and x.app = p_app and x.user_id = s.user_id
      and x.auth_method_id = s.auth_method_id
      and x.used_at is null and x.expires_at > now()
    returning * into c;
  if c.id is null then
    raise exception 'challenge expired or used' using errcode = 'UB410';
  end if;
  if not exists (select 1 from public.userbase_app_moderator_allowlist a
                 where a.app = p_app and a.hive_handle = c.hive_handle and a.revoked_at is null) then
    raise exception 'handle is not a moderator of this app' using errcode = 'UB403';
  end if;

  perform 1 from public.userbase_app_moderators m
  where m.app = p_app and m.revoked_at is null
    and (m.hive_handle = c.hive_handle or m.user_id = s.user_id)
  for update;
  if exists (select 1 from public.userbase_app_moderators m
             where m.app = p_app and m.revoked_at is null
               and ((m.hive_handle = c.hive_handle and m.user_id <> s.user_id)
                 or (m.user_id = s.user_id and m.hive_handle <> c.hive_handle))) then
    -- Handle bound to another account, or this account bound to another handle:
    -- moving it needs an explicit unbind by an operator.
    raise exception 'binding conflict' using errcode = 'UB409';
  end if;
  -- Same user + handle: a fresh proof (new key and/or email) replaces the old row.
  update public.userbase_app_moderators m set revoked_at = now()
    where m.app = p_app and m.revoked_at is null
      and m.hive_handle = c.hive_handle and m.user_id = s.user_id;

  begin
    insert into public.userbase_app_moderators
      (app, hive_handle, user_id, auth_method_id, public_key, challenge_id)
    values (p_app, c.hive_handle, s.user_id, s.auth_method_id, p_public_key, c.id)
    returning * into v_row;
  exception when check_violation then
    raise exception 'invalid public key' using errcode = 'UB422';
  end;
  return v_row;
end;
$$;

-- Operator escape hatch (SQL editor / ops tooling).
create or replace function public.userbase_app_moderator_unbind(p_app text, p_hive_handle text)
returns boolean
language sql
volatile
set search_path = public
as $$
  with r as (
    update public.userbase_app_moderators
      set revoked_at = now()
      where app = p_app and hive_handle = lower(btrim(p_hive_handle)) and revoked_at is null
      returning 1)
  select exists (select 1 from r);
$$;

-- ---------------------------------------------------------------------------
-- Post RPCs
-- ---------------------------------------------------------------------------

create or replace function public.userbase_app_post_create(
  p_token_hash text,
  p_app text,
  p_idempotency_key text,
  p_request_hash text,
  p_kind text,
  p_title text,
  p_body text,
  p_media jsonb,
  p_context_kind text,
  p_context_slug text,
  p_consent_publish boolean
)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  s record;
  v_mod text;
  v_row public.userbase_app_posts;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);

  select * into v_row from public.userbase_app_posts p
  where p.app = p_app and p.user_id = s.user_id and p.idempotency_key = p_idempotency_key;
  if v_row.id is not null then
    if v_row.request_hash <> p_request_hash then
      raise exception 'idempotency key reused with another body' using errcode = 'UB409';
    end if;
    return v_row;  -- retry of the same request
  end if;

  if p_consent_publish is not true then
    raise exception 'consent to publish is required' using errcode = 'UB422';
  end if;
  if (select count(*) from public.userbase_app_posts p
      where p.app = p_app and p.user_id = s.user_id
        and p.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'too many posts today' using errcode = 'UB429';
  end if;

  v_mod := public.userbase_app__moderator_handle(s.user_id, s.auth_method_id, p_app);

  begin
    insert into public.userbase_app_posts
      (app, user_id, idempotency_key, request_hash, kind, title, body, media,
       context_kind, context_slug, consent_publish_at,
       status, auto_approved, reviewed_by, reviewed_by_hive_handle, reviewed_at)
    values
      (p_app, s.user_id, p_idempotency_key, p_request_hash, p_kind,
       nullif(btrim(p_title), ''), coalesce(p_body, ''), coalesce(p_media, '[]'::jsonb),
       p_context_kind, p_context_slug, now(),
       case when v_mod is null then 'pending' else 'approved' end,
       v_mod is not null,
       case when v_mod is null then null else s.user_id end,
       v_mod,
       case when v_mod is null then null else now() end)
    returning * into v_row;
  exception
    when unique_violation then
      select * into v_row from public.userbase_app_posts p
      where p.app = p_app and p.user_id = s.user_id and p.idempotency_key = p_idempotency_key;
      if v_row.id is null or v_row.request_hash <> p_request_hash then
        raise exception 'idempotency key reused with another body' using errcode = 'UB409';
      end if;
      return v_row;
    when check_violation then
      raise exception 'invalid post content' using errcode = 'UB422';
  end;

  perform public.userbase_app__log(v_row, s.user_id, null, 'author', 'created', null, null);
  if v_mod is not null then
    perform public.userbase_app__log(v_row, s.user_id, v_mod, 'moderator', 'auto_approved',
                                     'pending', null);
  end if;
  return v_row;
end;
$$;

-- Moderator decision. CAS: only a post still 'pending'.
create or replace function public.userbase_app_post_review(
  p_token_hash text, p_app text, p_post_id uuid, p_decision text, p_reject_reason text default null)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  s record;
  v_mod text;
  v_row public.userbase_app_posts;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  v_mod := public.userbase_app__moderator_handle(s.user_id, s.auth_method_id, p_app);
  if v_mod is null then
    raise exception 'not a moderator of this app' using errcode = 'UB403';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'decision must be approve or reject' using errcode = 'UB422';
  end if;

  update public.userbase_app_posts p
    set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
        reviewed_by = s.user_id, reviewed_by_hive_handle = v_mod, reviewed_at = now(),
        reject_reason = case when p_decision = 'reject' then left(nullif(btrim(p_reject_reason), ''), 500) end
    where p.id = p_post_id and p.app = p_app and p.status = 'pending'
    returning * into v_row;
  if v_row.id is null then
    if exists (select 1 from public.userbase_app_posts p where p.id = p_post_id and p.app = p_app) then
      raise exception 'post is no longer pending' using errcode = 'UB409';
    end if;
    raise exception 'post not found' using errcode = 'UB404';
  end if;
  perform public.userbase_app__log(v_row, s.user_id, v_mod, 'moderator',
    case when p_decision = 'approve' then 'approved' else 'rejected' end, 'pending',
    v_row.reject_reason);
  return v_row;
end;
$$;

-- Owner or moderator view of one post. Never email.
create or replace function public.userbase_app_post_get(
  p_token_hash text, p_app text, p_post_id uuid)
returns table (
  id uuid, status text, kind text, title text, body text, media jsonb,
  context_kind text, context_slug text,
  author_user_id uuid, author_handle text, author_display_name text, author_avatar_url text,
  created_at timestamptz, reviewed_at timestamptz, reject_reason text, published_at timestamptz,
  publish_author text, publish_permlink text, last_error_code text, auto_approved boolean,
  is_owner boolean, viewer_is_moderator boolean)
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  s record;
  v_is_mod boolean;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  v_is_mod := public.userbase_app__moderator_handle(s.user_id, s.auth_method_id, p_app) is not null;
  return query
  select p.id, p.status, p.kind, p.title, p.body, p.media, p.context_kind, p.context_slug,
         p.user_id, u.handle, u.display_name, u.avatar_url,
         p.created_at, p.reviewed_at, p.reject_reason, p.published_at,
         case when p.status = 'published' then p.publish_author end,
         case when p.status = 'published' then p.publish_permlink end,
         p.last_error_code, p.auto_approved, p.user_id = s.user_id, v_is_mod
  from public.userbase_app_posts p
  join public.userbase_users u on u.id = p.user_id
  where p.id = p_post_id and p.app = p_app and (p.user_id = s.user_id or v_is_mod);
  if not found then
    raise exception 'post not found' using errcode = 'UB404';
  end if;
end;
$$;

-- The session user's own posts, newest first. Keyset cursor (created_at, id)
-- of the last row seen; ties on the timestamp are broken by id.
create or replace function public.userbase_app_post_list_mine(
  p_token_hash text, p_app text, p_before_at timestamptz default null,
  p_before_id uuid default null, p_limit integer default 20)
returns setof public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare s record;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  return query
  select * from public.userbase_app_posts p
  where p.app = p_app and p.user_id = s.user_id
    and (p_before_at is null
         or (p.created_at, p.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

-- Moderation list by status (moderators only). Author public profile only.
create or replace function public.userbase_app_post_queue(
  p_token_hash text, p_app text, p_status text default 'pending',
  p_before_at timestamptz default null, p_before_id uuid default null, p_limit integer default 50)
returns table (
  id uuid, status text, kind text, title text, body text, media jsonb,
  context_kind text, context_slug text,
  author_user_id uuid, author_handle text, author_display_name text, author_avatar_url text,
  created_at timestamptz, reviewed_at timestamptz, reviewed_by_hive_handle text,
  reject_reason text, last_error_code text, publish_attempts integer)
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare s record;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  if public.userbase_app__moderator_handle(s.user_id, s.auth_method_id, p_app) is null then
    raise exception 'not a moderator of this app' using errcode = 'UB403';
  end if;
  return query
  select p.id, p.status, p.kind, p.title, p.body, p.media, p.context_kind, p.context_slug,
         p.user_id, u.handle, u.display_name, u.avatar_url, p.created_at, p.reviewed_at,
         p.reviewed_by_hive_handle, p.reject_reason, p.last_error_code, p.publish_attempts
  from public.userbase_app_posts p
  join public.userbase_users u on u.id = p.user_id
  where p.app = p_app and p.status = p_status
    and (p_before_at is null
         or (p.created_at, p.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

-- Public feed: published only, no review/error fields, no email. Keyset
-- cursor (published_at, id) of the last row seen.
create or replace function public.userbase_app_feed(
  p_app text, p_context_kind text default null, p_context_slug text default null,
  p_before_at timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns table (
  id uuid, kind text, title text, body text, media jsonb, context_kind text, context_slug text,
  author_handle text, author_display_name text, author_avatar_url text,
  publish_author text, publish_permlink text, published_at timestamptz)
language sql
stable
set search_path = public
as $$
  select p.id, p.kind, p.title, p.body, p.media, p.context_kind, p.context_slug,
         u.handle, u.display_name, u.avatar_url, p.publish_author, p.publish_permlink, p.published_at
  from public.userbase_app_posts p
  join public.userbase_users u on u.id = p.user_id
  where p.app = p_app and p.status = 'published'
    and (p_context_kind is null or p.context_kind = p_context_kind)
    and (p_context_slug is null or p.context_slug = p_context_slug)
    and (p_before_at is null
         or (p.published_at, p.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by p.published_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- ---------------------------------------------------------------------------
-- Publishing RPCs (API worker, service_role; no session)
-- ---------------------------------------------------------------------------

-- Claim one post (p_post_id) or the due ones (null): status 'approved', or
-- 'publishing' whose lease expired. Each claim takes a fresh token and counts
-- an attempt. On a reclaim the worker must first check the chain for
-- publish_author/publish_permlink (if reserved) before broadcasting.
-- Expired leases on the last attempt fail as lease_expired.
create or replace function public.userbase_app_post_publish_claim(
  p_post_id uuid, p_worker text, p_lease_seconds integer default 120, p_limit integer default 1)
returns setof public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  v_lease integer := least(greatest(coalesce(p_lease_seconds, 120), 30), 900);
  v_limit integer := least(greatest(coalesce(p_limit, 1), 1), 20);
  r record;
  v_row public.userbase_app_posts;
begin
  for r in
    select p.id, p.status from public.userbase_app_posts p
    where (p_post_id is null or p.id = p_post_id)
      and p.status = 'publishing' and p.publish_lease_until < now()
      and p.publish_attempts >= p.publish_max_attempts
    for update of p skip locked
  loop
    update public.userbase_app_posts p
      set status = 'failed', publish_claim_token = null, publish_lease_until = null,
          last_error_code = 'lease_expired'
      where p.id = r.id returning * into v_row;
    perform public.userbase_app__log(v_row, null, null, 'system', 'publish_failed',
                                     'publishing', 'lease_expired');
  end loop;

  for r in
    select p.id, p.status from public.userbase_app_posts p
    where (p_post_id is null or p.id = p_post_id)
      and p.publish_attempts < p.publish_max_attempts
      and (p.status = 'approved'
           or (p.status = 'publishing' and p.publish_lease_until < now()))
    order by p.reviewed_at
    limit v_limit
    for update of p skip locked
  loop
    update public.userbase_app_posts p
      set status = 'publishing', publish_claim_token = gen_random_uuid(),
          publish_lease_until = now() + make_interval(secs => v_lease),
          publish_attempts = p.publish_attempts + 1,
          publish_started_at = coalesce(p.publish_started_at, now())
      where p.id = r.id returning * into v_row;
    perform public.userbase_app__log(v_row, null, null, 'worker', 'publish_claimed',
                                     r.status, left(p_worker, 100));
    return next v_row;
  end loop;
end;
$$;

-- Fix the Hive author before the first broadcast. Same author again: no-op.
-- A different signer later: the post fails as signer_changed and needs a
-- human (it is never republished under another account). Returns the row;
-- the caller broadcasts only when status is still 'publishing'.
create or replace function public.userbase_app_post_publish_reserve(
  p_post_id uuid, p_claim_token uuid, p_author text, p_signer_kind text)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare v_row public.userbase_app_posts;
begin
  select * into v_row from public.userbase_app_posts p
  where p.id = p_post_id and p.publish_claim_token = p_claim_token and p.status = 'publishing'
  for update;
  if v_row.id is null then
    raise exception 'claim lost' using errcode = 'UB409';
  end if;
  if v_row.publish_author is null then
    begin
      update public.userbase_app_posts p
        set publish_author = lower(p_author), publish_signer_kind = p_signer_kind
        where p.id = v_row.id returning * into v_row;
    exception when check_violation then
      raise exception 'invalid author or signer kind' using errcode = 'UB422';
    end;
    perform public.userbase_app__log(v_row, null, null, 'worker', 'publish_reserved',
                                     'publishing', v_row.publish_author);
    return v_row;
  end if;
  if v_row.publish_author = lower(p_author) and v_row.publish_signer_kind = p_signer_kind then
    return v_row;
  end if;
  update public.userbase_app_posts p
    set status = 'failed', publish_claim_token = null, publish_lease_until = null,
        last_error_code = 'signer_changed'
    where p.id = v_row.id returning * into v_row;
  perform public.userbase_app__log(v_row, null, null, 'system', 'publish_failed',
                                   'publishing', 'signer_changed');
  return v_row;
end;
$$;

-- Report the outcome. CAS on the claim token. Success needs a reserved author
-- and writes the requested follow-ups (p_followups: 'soft_post',
-- 'instagram_enqueue') to the outbox in the same transaction.
-- Failure: back to 'approved' for another attempt, or 'failed' when out of
-- attempts or p_retryable = false.
create or replace function public.userbase_app_post_publish_complete(
  p_post_id uuid, p_claim_token uuid, p_ok boolean,
  p_error_code text default null, p_retryable boolean default true,
  p_followups text[] default '{}')
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare v_row public.userbase_app_posts;
begin
  select * into v_row from public.userbase_app_posts p
  where p.id = p_post_id and p.publish_claim_token = p_claim_token and p.status = 'publishing'
  for update;
  if v_row.id is null then
    raise exception 'claim lost or already reported' using errcode = 'UB409';
  end if;

  if p_ok then
    if v_row.publish_author is null then
      raise exception 'reserve the author before reporting success' using errcode = 'UB409';
    end if;
    if exists (select 1 from unnest(coalesce(p_followups, '{}')) k
               where k not in ('soft_post', 'instagram_enqueue')) then
      raise exception 'unknown follow-up' using errcode = 'UB422';
    end if;
    insert into public.userbase_app_post_outbox (post_id, kind)
    select v_row.id, k from (select distinct unnest(coalesce(p_followups, '{}')) k) x
    on conflict (post_id, kind) do nothing;
    update public.userbase_app_posts p
      set status = 'published', publish_claim_token = null, publish_lease_until = null,
          published_at = now(), last_error_code = null
      where p.id = v_row.id returning * into v_row;
    perform public.userbase_app__log(v_row, null, null, 'worker', 'publish_succeeded',
                                     'publishing', null);
    return v_row;
  end if;

  if p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'error code required' using errcode = 'UB422';
  end if;
  update public.userbase_app_posts p
    set status = case when p_retryable and p.publish_attempts < p.publish_max_attempts
                      then 'approved' else 'failed' end,
        publish_claim_token = null, publish_lease_until = null, last_error_code = p_error_code
    where p.id = v_row.id returning * into v_row;
  perform public.userbase_app__log(v_row, null, null, 'worker',
    case when v_row.status = 'approved' then 'publish_retry' else 'publish_failed' end,
    'publishing', p_error_code);
  return v_row;
end;
$$;

-- Moderator retry of a failed post. signer_changed needs reconciliation first.
create or replace function public.userbase_app_post_publish_requeue(
  p_token_hash text, p_app text, p_post_id uuid)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  s record;
  v_mod text;
  v_row public.userbase_app_posts;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  v_mod := public.userbase_app__moderator_handle(s.user_id, s.auth_method_id, p_app);
  if v_mod is null then
    raise exception 'not a moderator of this app' using errcode = 'UB403';
  end if;
  update public.userbase_app_posts p
    set status = 'approved', publish_attempts = 0
    where p.id = p_post_id and p.app = p_app and p.status = 'failed'
      and p.last_error_code is distinct from 'signer_changed'
    returning * into v_row;
  if v_row.id is null then
    raise exception 'post is not a retryable failure' using errcode = 'UB409';
  end if;
  perform public.userbase_app__log(v_row, s.user_id, v_mod, 'moderator', 'publish_requeued',
                                   'failed', null);
  return v_row;
end;
$$;

-- Link the Instagram crosspost request once (idempotent for the same id).
create or replace function public.userbase_app_post_link_crosspost(
  p_post_id uuid, p_crosspost_queue_id uuid)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare v_row public.userbase_app_posts;
begin
  begin
    update public.userbase_app_posts p
      set crosspost_queue_id = p_crosspost_queue_id
      where p.id = p_post_id and p.status = 'published'
        and (p.crosspost_queue_id is null or p.crosspost_queue_id = p_crosspost_queue_id)
      returning * into v_row;
  exception when foreign_key_violation then
    raise exception 'crosspost request not found' using errcode = 'UB404';
  end;
  if v_row.id is null then
    raise exception 'post not published or already linked' using errcode = 'UB409';
  end if;
  perform public.userbase_app__log(v_row, null, null, 'worker', 'crosspost_linked',
                                   'published', p_crosspost_queue_id::text);
  return v_row;
end;
$$;

-- Claim due outbox items of one kind (lease + token, SKIP LOCKED). Items whose
-- lease expired on the last attempt fail as lease_expired.
create or replace function public.userbase_app_post_outbox_claim(
  p_kind text, p_worker text, p_lease_seconds integer default 120, p_limit integer default 10)
returns table (
  outbox_id uuid, claim_token uuid, attempts integer, kind text,
  post_id uuid, app text, post_user_id uuid, publish_author text, publish_permlink text,
  publish_signer_kind text, post_kind text, title text, body text, media jsonb,
  context_kind text, context_slug text)
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  v_lease integer := least(greatest(coalesce(p_lease_seconds, 120), 30), 900);
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 50);
  r record;
begin
  update public.userbase_app_post_outbox o
    set status = 'failed', claim_token = null, lease_until = null,
        last_error_code = 'lease_expired', updated_at = now()
    where o.kind = p_kind and o.status = 'claimed' and o.lease_until < now()
      and o.attempts >= o.max_attempts;

  for r in
    select o.id from public.userbase_app_post_outbox o
    where o.kind = p_kind and o.attempts < o.max_attempts
      and ((o.status = 'queued' and o.next_attempt_at <= now())
           or (o.status = 'claimed' and o.lease_until < now()))
    order by o.next_attempt_at, o.created_at
    limit v_limit
    for update of o skip locked
  loop
    update public.userbase_app_post_outbox o
      set status = 'claimed', claim_token = gen_random_uuid(),
          lease_until = now() + make_interval(secs => v_lease),
          attempts = o.attempts + 1, updated_at = now()
      where o.id = r.id;
    return query
    select o.id, o.claim_token, o.attempts, o.kind, p.id, p.app, p.user_id,
           p.publish_author, p.publish_permlink, p.publish_signer_kind, p.kind,
           p.title, p.body, p.media, p.context_kind, p.context_slug
    from public.userbase_app_post_outbox o
    join public.userbase_app_posts p on p.id = o.post_id
    where o.id = r.id;
  end loop;
end;
$$;

-- Report an outbox item. CAS on the claim token. Failure retries with backoff
-- until max_attempts, then 'failed'.
create or replace function public.userbase_app_post_outbox_complete(
  p_outbox_id uuid, p_claim_token uuid, p_ok boolean,
  p_error_code text default null, p_result jsonb default null)
returns public.userbase_app_post_outbox
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare v_row public.userbase_app_post_outbox;
begin
  select * into v_row from public.userbase_app_post_outbox o
  where o.id = p_outbox_id and o.claim_token = p_claim_token and o.status = 'claimed'
  for update;
  if v_row.id is null then
    raise exception 'claim lost or already reported' using errcode = 'UB409';
  end if;
  if not p_ok and (p_error_code is null or p_error_code !~ '^[a-z0-9_]{1,64}$') then
    raise exception 'error code required' using errcode = 'UB422';
  end if;
  update public.userbase_app_post_outbox o
    set status = case when p_ok then 'done'
                      when o.attempts >= o.max_attempts then 'failed' else 'queued' end,
        claim_token = null, lease_until = null,
        last_error_code = case when p_ok then null else p_error_code end,
        result = coalesce(p_result, o.result),
        done_at = case when p_ok then now() end,
        next_attempt_at = case when p_ok then o.next_attempt_at
          else now() + make_interval(secs => least(3600, 30 * power(2, o.attempts)::integer)) end,
        updated_at = now()
    where o.id = v_row.id
    returning * into v_row;
  return v_row;
end;
$$;

-- Operator retry of a failed outbox item.
create or replace function public.userbase_app_post_outbox_requeue(p_outbox_id uuid)
returns public.userbase_app_post_outbox
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare v_row public.userbase_app_post_outbox;
begin
  update public.userbase_app_post_outbox o
    set status = 'queued', attempts = 0, next_attempt_at = now(), updated_at = now()
    where o.id = p_outbox_id and o.status = 'failed'
    returning * into v_row;
  if v_row.id is null then
    raise exception 'outbox item is not failed' using errcode = 'UB409';
  end if;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: service_role only
-- ---------------------------------------------------------------------------

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'userbase_app__media_valid', 'userbase_app__body_hash', 'userbase_app__post_guard',
        'userbase_app__append_only', 'userbase_app__session', 'userbase_app__moderator_handle',
        'userbase_app__log', 'userbase_app_me', 'userbase_app_moderator_challenge_create',
        'userbase_app_moderator_challenge_get', 'userbase_app_moderator_bind',
        'userbase_app_moderator_unbind', 'userbase_app_post_create', 'userbase_app_post_review',
        'userbase_app_post_get', 'userbase_app_post_list_mine', 'userbase_app_post_queue',
        'userbase_app_feed', 'userbase_app_post_publish_claim',
        'userbase_app_post_publish_reserve', 'userbase_app_post_publish_complete',
        'userbase_app_post_publish_requeue', 'userbase_app_post_link_crosspost',
        'userbase_app_post_outbox_claim', 'userbase_app_post_outbox_complete',
        'userbase_app_post_outbox_requeue')
  loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

commit;
