-- 0036_userbase_app_memberships.sql
-- ⚠ APPLY MANUALLY in the Supabase SQL editor — this repo has no migration
--   runner. Rollback: 0036_userbase_app_memberships.rollback.sql.
--   Local test: bash scripts/test-0036-app-memberships.sh (Docker).
--
-- Partner apps (first: the Coletivo XV site, app = 'coletivoxv') sign people in
-- through the shared userbase — email OTP on api.skatehive.app, called from the
-- partner's server with its app credential. No parallel signup, no duplicate
-- users: everything points at userbase_users.
--
--   * userbase_app_memberships — one row per (user, app): first/last login and
--     a counter. 'revoked' blocks further logins to that app only.
--   * userbase_app_sessions — sessions issued TO a partner app. Kept out of
--     userbase_sessions on purpose: the web and mobile resolvers read that
--     table directly, so an app token stored there could be replayed against
--     Skatehive as a full session. A token in this table is invisible to every
--     existing resolver, and only the API's app-session resolver (which must
--     also match the calling app's credential) reads it. It grants identity,
--     session check and logout for that app — never Hive, wallet or admin.
--   * userbase_app_login() — the only write path for a login: checks the email
--     belongs to the user, records the membership and issues the session in
--     one transaction.
--   * userbase_app_session_resolve() / userbase_app_session_revoke() — the
--     only read and logout paths, always filtered by the caller's app.
--
-- No newsletter or marketing consent here: signing in to an app subscribes
-- nobody to anything. No email copy either: each session points at the
-- verified userbase_auth_methods row it was issued through.
--
-- Only service_role touches any of it. Safe to run more than once; one
-- transaction; additive — no existing table or function changes.
--
-- Not covered: userbase_merge_users does not move memberships or app sessions
-- (same gap as 0034 invites). After a merge, app sessions on the merged-away
-- account stop resolving (the resolver requires status = 'active'); the user
-- signs in again and lands on the surviving account.

begin;

create table if not exists public.userbase_app_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.userbase_users(id) on delete cascade,
  app text not null
    constraint userbase_app_memberships_app_format
      check (app ~ '^[a-z0-9][a-z0-9_-]{1,31}$'),
  status text not null default 'active'
    constraint userbase_app_memberships_status
      check (status in ('active', 'revoked')),
  first_login_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  login_count integer not null default 1
    constraint userbase_app_memberships_login_count check (login_count >= 1),
  created_at timestamptz not null default now(),
  constraint userbase_app_memberships_user_app_uniq unique (user_id, app)
);

-- "Everyone who has signed in to app X", newest first.
create index if not exists userbase_app_memberships_app_last_login_idx
  on public.userbase_app_memberships(app, last_login_at desc);

create table if not exists public.userbase_app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.userbase_users(id) on delete cascade,
  app text not null
    constraint userbase_app_sessions_app_format
      check (app ~ '^[a-z0-9][a-z0-9_-]{1,31}$'),
  -- sha256 hex of the raw token; the raw token is returned once, never stored.
  token_hash text not null
    constraint userbase_app_sessions_token_hash_format
      check (token_hash ~ '^[0-9a-f]{64}$'),
  -- The verified email this session was issued through. Removing that email
  -- from the account ends its app sessions.
  auth_method_id uuid not null
    references public.userbase_auth_methods(id) on delete cascade,
  method text not null
    constraint userbase_app_sessions_method
      check (method in ('email_otp', 'email_signup', 'hive_claim')),
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  -- No open-ended app sessions: at most 90 days, no sliding past that.
  constraint userbase_app_sessions_ttl
    check (expires_at > created_at and expires_at <= created_at + interval '90 days'),
  constraint userbase_app_sessions_token_hash_uniq unique (token_hash)
);

create index if not exists userbase_app_sessions_user_app_idx
  on public.userbase_app_sessions(user_id, app, created_at desc);
create index if not exists userbase_app_sessions_app_created_idx
  on public.userbase_app_sessions(app, created_at desc);
-- Cleanup scan.
create index if not exists userbase_app_sessions_expires_idx
  on public.userbase_app_sessions(expires_at);

alter table public.userbase_app_memberships enable row level security;
alter table public.userbase_app_memberships force row level security;
revoke all on table public.userbase_app_memberships from anon, authenticated;

alter table public.userbase_app_sessions enable row level security;
alter table public.userbase_app_sessions force row level security;
revoke all on table public.userbase_app_sessions from anon, authenticated;

-- Record one verified login and issue its app session, atomically.
-- Call only after the OTP (or signup) was verified server-side, with the email
-- the server verified — never one the client merely sent.
-- Returns the session row; returns NO row when the membership is revoked (the
-- caller refuses the login). Raises when the email is not this user's.
create or replace function public.userbase_app_login(
  p_user_id uuid,
  p_app text,
  p_email text,
  p_token_hash text,
  p_expires_at timestamptz,
  p_method text,
  p_user_agent text default null
)
returns setof public.userbase_app_sessions
language plpgsql
volatile
set search_path = public
as $$
declare
  v_auth_method_id uuid;
  v_membership_id uuid;
begin
  select am.id into v_auth_method_id
  from public.userbase_auth_methods am
  join public.userbase_users u on u.id = am.user_id
  where am.user_id = p_user_id
    and am.type = 'email_magic'
    and lower(am.identifier) = lower(trim(p_email))
    and u.status = 'active'
  limit 1;

  if v_auth_method_id is null then
    raise exception 'email is not a verified login of an active user'
      using errcode = 'P0002';
  end if;

  insert into public.userbase_app_memberships as m (user_id, app)
  values (p_user_id, p_app)
  on conflict (user_id, app) do update
    set last_login_at = now(),
        login_count = m.login_count + 1
    where m.status = 'active'
  returning m.id into v_membership_id;

  if v_membership_id is null then
    return; -- revoked for this app
  end if;

  update public.userbase_auth_methods
    set last_used_at = now()
    where id = v_auth_method_id;

  return query
  insert into public.userbase_app_sessions
    (user_id, app, token_hash, auth_method_id, method, user_agent, expires_at)
  values
    (p_user_id, p_app, p_token_hash, v_auth_method_id, p_method,
     left(p_user_agent, 512), p_expires_at)
  returning *;
end;
$$;

-- Resolve an app token → user. The only read path for app sessions; p_app is
-- the app the CALLER authenticated as (its credential), never a value from the
-- request body. Returns no row unless the session, the user and the membership
-- are all live. Sliding expiry: extends to 30 days from now, at most once a
-- day, and never past 90 days from issue (the table check caps it too).
create or replace function public.userbase_app_session_resolve(
  p_token_hash text,
  p_app text
)
returns table (session_id uuid, user_id uuid, expires_at timestamptz)
language plpgsql
volatile
set search_path = public
as $$
declare
  v_session public.userbase_app_sessions%rowtype;
begin
  select s.* into v_session
  from public.userbase_app_sessions s
  join public.userbase_users u on u.id = s.user_id
  join public.userbase_app_memberships m on m.user_id = s.user_id and m.app = s.app
  where s.token_hash = p_token_hash
    and s.app = p_app
    and s.revoked_at is null
    and s.expires_at > now()
    and u.status = 'active'
    and m.status = 'active';

  if v_session.id is null then
    return;
  end if;

  if v_session.last_used_at is null or v_session.last_used_at < now() - interval '1 day' then
    update public.userbase_app_sessions s
      set last_used_at = now(),
          expires_at = greatest(s.expires_at,
            least(now() + interval '30 days', s.created_at + interval '90 days'))
      where s.id = v_session.id
      returning s.expires_at into v_session.expires_at;
  end if;

  return query select v_session.id, v_session.user_id, v_session.expires_at;
end;
$$;

-- Logout. True when a live session for that app was revoked.
create or replace function public.userbase_app_session_revoke(
  p_token_hash text,
  p_app text
)
returns boolean
language sql
volatile
set search_path = public
as $$
  with r as (
    update public.userbase_app_sessions
      set revoked_at = now()
      where token_hash = p_token_hash and app = p_app and revoked_at is null
      returning 1
  )
  select exists (select 1 from r);
$$;

-- Drop expired sessions, and revoked ones after a grace week (kept briefly for
-- support). Returns how many rows went. Safe to call from a cron or by hand.
create or replace function public.userbase_app_sessions_cleanup()
returns integer
language sql
volatile
set search_path = public
as $$
  with gone as (
    delete from public.userbase_app_sessions
    where expires_at < now()
       or revoked_at < now() - interval '7 days'
    returning 1
  )
  select count(*)::integer from gone;
$$;

revoke all on function public.userbase_app_login(uuid, text, text, text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.userbase_app_login(uuid, text, text, text, timestamptz, text, text)
  to service_role;
revoke all on function public.userbase_app_session_resolve(text, text)
  from public, anon, authenticated;
grant execute on function public.userbase_app_session_resolve(text, text)
  to service_role;
revoke all on function public.userbase_app_session_revoke(text, text)
  from public, anon, authenticated;
grant execute on function public.userbase_app_session_revoke(text, text)
  to service_role;
revoke all on function public.userbase_app_sessions_cleanup()
  from public, anon, authenticated;
grant execute on function public.userbase_app_sessions_cleanup()
  to service_role;

commit;
