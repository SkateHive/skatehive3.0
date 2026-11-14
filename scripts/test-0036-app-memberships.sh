#!/usr/bin/env bash
# Local check for sql/migrations/0036_userbase_app_memberships.sql against a
# throwaway Postgres container. Never touches Supabase.
#   bash scripts/test-0036-app-memberships.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/sql/migrations"
NAME="sh-0036-test-$$"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test postgres:15-alpine >/dev/null
for _ in $(seq 1 30); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
sleep 1

psql_run() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

# Supabase-like roles and default privileges: every new table and function in
# public is granted to anon/authenticated/service_role unless revoked, and
# service_role bypasses RLS. Then the base schema, with 0006's revokes.
psql_run <<'SQL'
create role anon nologin; create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
SQL
psql_run < "$MIG/0001_userbase.sql" 2>/dev/null
psql_run <<'SQL'
alter table userbase_users enable row level security;
alter table userbase_users force row level security;
alter table userbase_auth_methods enable row level security;
alter table userbase_auth_methods force row level security;
alter table userbase_sessions enable row level security;
alter table userbase_sessions force row level security;
revoke all on table userbase_users, userbase_auth_methods, userbase_sessions
  from anon, authenticated;
SQL

echo "apply twice (idempotent)"
psql_run < "$MIG/0036_userbase_app_memberships.sql"
psql_run < "$MIG/0036_userbase_app_memberships.sql" 2>/dev/null

echo "behaviour"
psql_run <<'SQL'
\set u1 '''00000000-0000-0000-0000-000000000001'''
\set u2 '''00000000-0000-0000-0000-000000000002'''
insert into userbase_users (id, handle) values (:u1, 'alice'), (:u2, 'bob');
insert into userbase_auth_methods (user_id, type, identifier, verified_at) values
  (:u1, 'email_magic', 'alice@example.com', now()),
  (:u2, 'email_magic', 'bob@example.com', now());
insert into userbase_sessions (user_id, refresh_token_hash, expires_at)
  values (:u1, 'first-party', now() + interval '1 day');

create function pg_temp.h(t text) returns text language sql
  as $$ select encode(sha256(convert_to(t, 'utf8')), 'hex') $$;

-- First login: membership created, session issued, email bound.
select count(*) as issued from userbase_app_login(:u1, 'coletivoxv', ' Alice@Example.com ',
  pg_temp.h('tok1'), now() + interval '30 days', 'email_otp', 'ua');
select userbase_app_login(:u1, 'coletivoxv', 'alice@example.com',
  pg_temp.h('tok2'), now() + interval '30 days', 'email_otp') is not null as second;
do $$ begin
  assert (select login_count from userbase_app_memberships where app = 'coletivoxv') = 2;
  assert (select count(*) from userbase_app_memberships) = 1, 'one row per user+app';
  assert (select count(*) from userbase_app_sessions) = 2;
  assert (select bool_and(am.identifier = 'alice@example.com')
          from userbase_app_sessions s join userbase_auth_methods am on am.id = s.auth_method_id);
  -- App tokens never reach the table the web/mobile resolvers read.
  assert (select count(*) from userbase_sessions) = 1, 'userbase_sessions untouched';
  assert (select last_used_at from userbase_auth_methods
          where identifier = 'alice@example.com') is not null;
end $$;

-- Someone else's email, unknown email: raise, nothing written.
do $$ begin
  begin
    perform userbase_app_login('00000000-0000-0000-0000-000000000001', 'coletivoxv',
      'bob@example.com', pg_temp.h('x1'), now() + interval '1 day', 'email_otp');
    raise exception 'foreign email accepted';
  exception when sqlstate 'P0002' then null;
  end;
  begin
    perform userbase_app_login('00000000-0000-0000-0000-000000000001', 'coletivoxv',
      'nobody@example.com', pg_temp.h('x2'), now() + interval '1 day', 'email_otp');
    raise exception 'unknown email accepted';
  exception when sqlstate 'P0002' then null;
  end;
  assert (select login_count from userbase_app_memberships) = 2, 'failed login not counted';
end $$;

-- Reused token hash: whole call rolls back (membership counter too).
do $$ begin
  begin
    perform userbase_app_login('00000000-0000-0000-0000-000000000001', 'coletivoxv',
      'alice@example.com', pg_temp.h('tok1'), now() + interval '1 day', 'email_otp');
    raise exception 'duplicate token hash accepted';
  exception when unique_violation then null;
  end;
  assert (select login_count from userbase_app_memberships) = 2, 'atomic rollback';
end $$;

-- Bad inputs rejected by constraints.
do $$ begin
  begin
    perform userbase_app_login('00000000-0000-0000-0000-000000000001', 'Bad App!',
      'alice@example.com', pg_temp.h('x3'), now() + interval '1 day', 'email_otp');
    raise exception 'bad app id accepted';
  exception when check_violation then null;
  end;
  begin
    perform userbase_app_login('00000000-0000-0000-0000-000000000001', 'coletivoxv',
      'alice@example.com', 'not-a-hash', now() + interval '1 day', 'email_otp');
    raise exception 'raw token accepted as hash';
  exception when check_violation then null;
  end;
  begin
    perform userbase_app_login('00000000-0000-0000-0000-000000000001', 'coletivoxv',
      'alice@example.com', pg_temp.h('x4'), now() + interval '365 days', 'email_otp');
    raise exception 'ttl over 90 days accepted';
  exception when check_violation then null;
  end;
  begin
    perform userbase_app_login('00000000-0000-0000-0000-000000000001', 'coletivoxv',
      'alice@example.com', pg_temp.h('x5'), now() + interval '1 day', 'password');
    raise exception 'unknown method accepted';
  exception when check_violation then null;
  end;
end $$;

-- Resolve: right app only; slides once a day, capped at 90 days from issue.
do $$
declare r record;
begin
  select * into r from userbase_app_session_resolve(pg_temp.h('tok1'), 'coletivoxv');
  assert r.user_id = '00000000-0000-0000-0000-000000000001', 'resolves to alice';
  assert (select count(*) from userbase_app_session_resolve(pg_temp.h('tok1'), 'otherapp')) = 0,
    'token bound to its app';
  assert (select count(*) from userbase_app_session_resolve(pg_temp.h('nope'), 'coletivoxv')) = 0;
  -- Old session near its cap: extension stops at created_at + 90 days.
  update userbase_app_sessions
    set created_at = now() - interval '80 days', last_used_at = now() - interval '2 days',
        expires_at = now() + interval '1 day'
    where token_hash = pg_temp.h('tok1');
  select * into r from userbase_app_session_resolve(pg_temp.h('tok1'), 'coletivoxv');
  assert r.expires_at <= now() + interval '10 days' + interval '1 minute', 'capped at 90d';
  assert r.expires_at > now() + interval '9 days', 'extended to the cap';
  -- Expired: gone.
  update userbase_app_sessions set expires_at = now() - interval '1 second',
    created_at = now() - interval '2 days'
    where token_hash = pg_temp.h('tok1');
  assert (select count(*) from userbase_app_session_resolve(pg_temp.h('tok1'), 'coletivoxv')) = 0;
  update userbase_app_sessions set expires_at = now() + interval '1 day'
    where token_hash = pg_temp.h('tok1');
  -- Logout: wrong app does nothing, right app revokes, second time false.
  assert not userbase_app_session_revoke(pg_temp.h('tok1'), 'otherapp');
  assert userbase_app_session_revoke(pg_temp.h('tok1'), 'coletivoxv');
  assert not userbase_app_session_revoke(pg_temp.h('tok1'), 'coletivoxv');
  assert (select count(*) from userbase_app_session_resolve(pg_temp.h('tok1'), 'coletivoxv')) = 0;
  -- Revoked membership kills live sessions at resolve time.
  update userbase_app_memberships set status = 'revoked';
  assert (select count(*) from userbase_app_session_resolve(pg_temp.h('tok2'), 'coletivoxv')) = 0;
  update userbase_app_memberships set status = 'active';
  assert (select count(*) from userbase_app_session_resolve(pg_temp.h('tok2'), 'coletivoxv')) = 1;
  update userbase_app_sessions set revoked_at = null where token_hash = pg_temp.h('tok1');
end $$;

-- Revoked membership: no session, counter unchanged.
update userbase_app_memberships set status = 'revoked';
do $$ begin
  assert (select count(*) from userbase_app_login('00000000-0000-0000-0000-000000000001',
    'coletivoxv', 'alice@example.com', pg_temp.h('tok3'), now() + interval '1 day',
    'email_otp')) = 0, 'revoked membership must issue nothing';
  assert (select login_count from userbase_app_memberships) = 2;
  assert (select count(*) from userbase_app_sessions) = 2;
end $$;

-- Merged / inactive user cannot log in to an app.
update userbase_users set status = 'merged' where handle = 'bob';
do $$ begin
  begin
    perform userbase_app_login('00000000-0000-0000-0000-000000000002', 'coletivoxv',
      'bob@example.com', pg_temp.h('b1'), now() + interval '1 day', 'email_otp');
    raise exception 'inactive user accepted';
  exception when sqlstate 'P0002' then null;
  end;
end $$;

-- Cleanup drops expired and long-revoked sessions only.
update userbase_app_sessions set revoked_at = now() - interval '8 days'
  where token_hash = pg_temp.h('tok2');
insert into userbase_app_sessions (user_id, app, token_hash, auth_method_id, method,
  created_at, expires_at)
  select user_id, app, pg_temp.h('old'), auth_method_id, method,
         now() - interval '40 days', now() - interval '10 days'
  from userbase_app_sessions limit 1;
do $$ begin
  assert userbase_app_sessions_cleanup() = 2, 'cleanup count';
  assert (select count(*) from userbase_app_sessions) = 1;
end $$;

-- Removing the email ends its app sessions; deleting the user cascades.
delete from userbase_auth_methods where identifier = 'alice@example.com';
do $$ begin
  assert (select count(*) from userbase_app_sessions) = 0;
end $$;
delete from userbase_users;
do $$ begin
  assert (select count(*) from userbase_app_memberships) = 0;
end $$;

-- Only service_role may call the functions or touch the tables.
do $$ begin
  assert has_function_privilege('service_role',
    'userbase_app_login(uuid, text, text, text, timestamptz, text, text)', 'execute');
  assert not has_function_privilege('anon',
    'userbase_app_login(uuid, text, text, text, timestamptz, text, text)', 'execute');
  assert not has_function_privilege('authenticated',
    'userbase_app_login(uuid, text, text, text, timestamptz, text, text)', 'execute');
  assert not has_function_privilege('anon', 'userbase_app_sessions_cleanup()', 'execute');
  assert not has_table_privilege('anon', 'userbase_app_sessions', 'select');
  assert not has_table_privilege('authenticated', 'userbase_app_sessions', 'select');
  assert not has_table_privilege('anon', 'userbase_app_memberships', 'select');
  assert (select relforcerowsecurity from pg_class where relname = 'userbase_app_sessions');
  assert (select relforcerowsecurity from pg_class where relname = 'userbase_app_memberships');
end $$;
SQL

echo "real roles: service_role can run every path, anon/authenticated cannot"
psql_run <<'SQL'
insert into userbase_users (id, handle) values ('00000000-0000-0000-0000-000000000005', 'eve');
insert into userbase_auth_methods (user_id, type, identifier, verified_at)
  values ('00000000-0000-0000-0000-000000000005', 'email_magic', 'eve@example.com', now());

set role service_role;
do $$
declare r record; tok text := encode(sha256('svc1'::bytea), 'hex');
begin
  assert current_user = 'service_role';
  assert (select count(*) from userbase_app_login('00000000-0000-0000-0000-000000000005',
    'coletivoxv', 'eve@example.com', tok, now() + interval '30 days', 'email_otp', 'ua')) = 1,
    'service_role login';
  -- force a slide so the update path runs as service_role too
  update userbase_app_sessions set last_used_at = now() - interval '2 days' where token_hash = tok;
  select * into r from userbase_app_session_resolve(tok, 'coletivoxv');
  assert r.user_id = '00000000-0000-0000-0000-000000000005', 'service_role resolve';
  assert userbase_app_session_revoke(tok, 'coletivoxv'), 'service_role revoke';
  update userbase_app_sessions set revoked_at = now() - interval '8 days' where token_hash = tok;
  assert userbase_app_sessions_cleanup() >= 1, 'service_role cleanup';
  assert (select count(*) from userbase_app_memberships m
          join userbase_auth_methods am on am.id = m.last_auth_method_id
          where am.identifier = 'eve@example.com') = 1, 'service_role admin read';
end $$;
reset role;
SQL

for role in anon authenticated; do
  for stmt in \
    "select * from userbase_app_login('00000000-0000-0000-0000-000000000005','coletivoxv','eve@example.com','$(printf 'a%.0s' $(seq 64))',now()+interval '1 day','email_otp')" \
    "select * from userbase_app_session_resolve('x','coletivoxv')" \
    "select userbase_app_session_revoke('x','coletivoxv')" \
    "select userbase_app_sessions_cleanup()" \
    "select * from userbase_app_sessions" \
    "select * from userbase_app_memberships" \
    "insert into userbase_app_memberships (user_id, app) values ('00000000-0000-0000-0000-000000000005','coletivoxv')"; do
    if out=$(printf 'set role %s;\n%s;\n' "$role" "$stmt" | psql_run 2>&1); then
      echo "FAIL $role was allowed: $stmt"; exit 1
    fi
    echo "$out" | grep -q "permission denied" || { echo "FAIL $role unexpected error: $out"; exit 1; }
  done
done
psql_run <<'SQL'
delete from userbase_users where handle = 'eve';
SQL

echo "admin email list follows the verified login, not other emails on the account"
psql_run <<'SQL'
insert into userbase_users (id, handle) values ('00000000-0000-0000-0000-000000000004', 'dana');
-- Dana has two emails; she only ever signs in to coletivo with the second.
insert into userbase_auth_methods (user_id, type, identifier, verified_at) values
  ('00000000-0000-0000-0000-000000000004', 'email_magic', 'dana-old@example.com', now()),
  ('00000000-0000-0000-0000-000000000004', 'email_magic', 'dana@coletivo.example', now());
select count(*) from userbase_app_login('00000000-0000-0000-0000-000000000004', 'coletivoxv',
  'dana@coletivo.example', encode(sha256('d1'::bytea), 'hex'), now() + interval '30 days',
  'email_signup');
-- Session cleanup must not lose the email for the membership list.
delete from userbase_app_sessions;
SQL
ADMIN_OUT="$(mktemp)"
psql_run -At < "$ROOT/sql/admin/app_membership_emails.sql" > "$ADMIN_OUT" 2>&1 || {
  cat "$ADMIN_OUT"; exit 1; }
grep -q 'dana@coletivo.example' "$ADMIN_OUT" || { echo "FAIL verified email missing"; exit 1; }
if grep -q 'dana-old@example.com' "$ADMIN_OUT"; then
  echo "FAIL admin list leaked an email not used on the app"; exit 1
fi
rm -f "$ADMIN_OUT"
psql_run <<'SQL'
delete from userbase_users where handle = 'dana';
SQL

echo "rollback twice (idempotent), userbase_sessions intact, then re-apply"
psql_run <<'SQL'
insert into userbase_users (id, handle) values ('00000000-0000-0000-0000-000000000003', 'carol');
insert into userbase_sessions (user_id, refresh_token_hash, expires_at)
  values ('00000000-0000-0000-0000-000000000003', 'keep-me', now() + interval '1 day');
SQL
psql_run < "$MIG/0036_userbase_app_memberships.rollback.sql"
psql_run < "$MIG/0036_userbase_app_memberships.rollback.sql" 2>/dev/null
psql_run <<'SQL'
do $$ begin
  assert to_regclass('public.userbase_app_sessions') is null;
  assert to_regclass('public.userbase_app_memberships') is null;
  assert (select count(*) from userbase_sessions where refresh_token_hash = 'keep-me'
          and revoked_at is null) = 1, 'first-party sessions untouched';
end $$;
SQL
psql_run < "$MIG/0036_userbase_app_memberships.sql"

echo "PASS 0036"
