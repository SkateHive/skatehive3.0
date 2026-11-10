#!/usr/bin/env bash
# Local check for sql/migrations/0041_userbase_app_post_snap_target.sql on a throwaway
# Postgres container with Supabase-like roles. Never touches Supabase.
#   bash scripts/test-0038-app-posts.sh            (postgres:17)
#   PG_IMAGE=postgres:15-alpine bash scripts/...   (other version)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/sql/migrations"
NAME="sh-0041-test-$$"
IMAGE="${PG_IMAGE:-postgres:17-alpine}"

TMPD="$(mktemp -d)"
cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; rm -rf "$TMPD"; }
trap cleanup EXIT

docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do
  docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break
  sleep 1
done
sleep 1

psql_run() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

echo "fixture: Supabase-like roles, 0001, 0029 (crosspost queue), 0036"
psql_run <<'SQL'
create role anon nologin; create role authenticated nologin;
create role service_role nologin bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
SQL
psql_run < "$MIG/0001_userbase.sql" 2>/dev/null
psql_run < "$MIG/0029_userbase_crosspost_queue.sql" 2>/dev/null
psql_run <<'SQL'
alter table userbase_users enable row level security; alter table userbase_users force row level security;
alter table userbase_auth_methods enable row level security; alter table userbase_auth_methods force row level security;
alter table userbase_sessions enable row level security; alter table userbase_sessions force row level security;
revoke all on table userbase_users, userbase_auth_methods, userbase_sessions from anon, authenticated;
SQL
psql_run < "$MIG/0036_userbase_app_memberships.sql"

psql_run < "$MIG/0038_userbase_app_posts.sql" 2>/dev/null

echo "legacy state before 0041 (published root post + approved post reserved without parent)"
psql_run <<'SQL'
insert into userbase_users (id, handle) values
  ('00000000-0000-0000-0000-00000000000a', 'alice'), ('00000000-0000-0000-0000-00000000000b', 'xvlad-lite');
insert into userbase_auth_methods (id, user_id, type, identifier, verified_at) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'email_magic', 'alice@example.invalid', now()),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'email_magic', 'xv1@example.invalid', now());
create table public.t_ids (k text primary key, id uuid);
grant all on public.t_ids to service_role;
set role service_role;
select count(*) from userbase_app_login('00000000-0000-0000-0000-00000000000a','coletivoxv','alice@example.invalid',encode(sha256('alice'::bytea),'hex'),now()+interval '30 days','email_otp');
select count(*) from userbase_app_login('00000000-0000-0000-0000-00000000000b','coletivoxv','xv1@example.invalid',encode(sha256('xv1'::bytea),'hex'),now()+interval '30 days','email_otp');
do $$
declare a text := encode(sha256('alice'::bytea),'hex'); x text := encode(sha256('xv1'::bytea),'hex');
  ch record; p public.userbase_app_posts; kk text;
begin
  select * into ch from userbase_app_moderator_challenge_create(x,'coletivoxv','xvlad');
  perform userbase_app_moderator_bind(x,'coletivoxv',ch.challenge_id,'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4');
  foreach kk in array array['legacy_pub','legacy_res','c','d','e','f','g','h','conc','plan'] loop
    p := userbase_app_post_create(a,'coletivoxv','key-0041-'||kk,encode(sha256(kk::bytea),'hex'),'text',null,'post '||kk,'[]',null,null,true);
    p := userbase_app_post_review(x,'coletivoxv',p.id,'approve');
    insert into t_ids values (kk, p.id);
  end loop;
  -- legacy_pub: published as a ROOT post with the 0038 flow (no parent)
  select * into p from userbase_app_post_publish_claim((select id from t_ids where k='legacy_pub'),'w0');
  p := userbase_app_post_publish_reserve(p.id, p.publish_claim_token, 'skateuser', 'shared_default');
  p := userbase_app_post_publish_complete(p.id, p.publish_claim_token, true);
  assert p.status = 'published';
  -- legacy_res: author reserved with 0038, broadcast failed, back to approved
  select * into p from userbase_app_post_publish_claim((select id from t_ids where k='legacy_res'),'w0');
  p := userbase_app_post_publish_reserve(p.id, p.publish_claim_token, 'skateuser', 'shared_default');
  p := userbase_app_post_publish_complete(p.id, p.publish_claim_token, false, 'chain_unavailable');
  assert p.status = 'approved' and p.publish_author = 'skateuser';
end $$;
SQL

echo "an open connection keeps working across the ALTER (PostgREST pools)"
docker exec -i "$NAME" psql -U postgres -qAt -v ON_ERROR_STOP=1 > "$TMPD/plan" 2>&1 <<'SQL' &
set role service_role;
select count(*) from userbase_app_feed('coletivoxv');
select count(*) from userbase_app_post_list_mine(encode(sha256('alice'::bytea),'hex'),'coletivoxv');
select pg_sleep(4);
select 'after', count(*) from userbase_app_feed('coletivoxv');
select 'after', count(*) from userbase_app_post_list_mine(encode(sha256('alice'::bytea),'hex'),'coletivoxv');
select 'claim', status from userbase_app_post_publish_claim((select id from t_ids where k='plan'),'wp');
SQL
sleep 1.5

echo "apply 0041 twice (idempotent)"
psql_run < "$MIG/0041_userbase_app_post_snap_target.sql" 2>/dev/null
psql_run < "$MIG/0041_userbase_app_post_snap_target.sql" 2>/dev/null
wait
grep -q '^after|1$' "$TMPD/plan" && grep -q '^claim|publishing$' "$TMPD/plan" || { echo "FAIL open connection after ALTER"; cat "$TMPD/plan"; exit 1; }
echo "  open connection ok"

echo "behaviour (as service_role)"
psql_run <<'SQL'
create function pg_temp.expect(p_sql text, p_code text) returns void language plpgsql as $$
declare v text;
begin
  begin execute p_sql; exception when others then
    get stacked diagnostics v = returned_sqlstate;
    if v <> p_code then raise exception 'expected % got %: %', p_code, v, p_sql; end if;
    return;
  end;
  raise exception 'expected % but it succeeded: %', p_code, p_sql;
end $$;
grant execute on all functions in schema pg_temp to service_role;
set role service_role;
do $$
declare
  x text := encode(sha256('xv1'::bytea),'hex');
  p public.userbase_app_posts; tok uuid;
  C1 text := 'snap-container-1771683120'; C2 text := 'snap-container-1771769520';
begin
  -- legacy published root post: untouched, still published, parent null
  select * into p from userbase_app_posts where id = (select t.id from t_ids t where k='legacy_pub');
  assert p.status = 'published' and p.publish_parent_author is null and p.publish_author = 'skateuser';
  assert (select count(*) from userbase_app_feed('coletivoxv')) = 1, 'legacy still in feed';

  -- 0038 reserve is closed
  select * into p from userbase_app_post_publish_claim((select t.id from t_ids t where k='h'),'w1');
  perform pg_temp.expect(format($q$select userbase_app_post_publish_reserve(%L,%L,'skateuser','shared_default')$q$, p.id, p.publish_claim_token), 'UB409');
  -- success without a reserved destination is refused
  perform pg_temp.expect(format($q$select userbase_app_post_publish_complete(%L,%L,true)$q$, p.id, p.publish_claim_token), 'UB409');
  -- invalid destinations: refused, nothing written
  perform pg_temp.expect(format($q$select userbase_app_post_publish_reserve_target(%L,%L,'skateuser','shared_default','','hive-173115')$q$, p.id, p.publish_claim_token), 'UB422');
  perform pg_temp.expect(format($q$select userbase_app_post_publish_reserve_target(%L,%L,'skateuser','shared_default','peak.snaps','snaps')$q$, p.id, p.publish_claim_token), 'UB422');
  perform pg_temp.expect(format($q$select userbase_app_post_publish_reserve_target(%L,%L,'skateuser','shared_default','someone','snap-container-1')$q$, p.id, p.publish_claim_token), 'UB422');
  perform pg_temp.expect(format($q$select userbase_app_post_publish_reserve_target(%L,%L,'BAD AUTHOR','shared_default','peak.snaps',%L)$q$, p.id, p.publish_claim_token, C1), 'UB422');
  assert (select publish_author is null and publish_parent_author is null and status = 'publishing' from userbase_app_posts where id = p.id);

  -- legacy reserved (author set, parent null): NOT assumed to be a snap
  select * into p from userbase_app_post_publish_claim((select t.id from t_ids t where k='legacy_res'),'w1');
  p := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'skateuser', 'shared_default', 'peak.snaps', C1);
  assert p.status = 'failed' and p.last_error_code = 'legacy_target_unknown' and p.publish_parent_author is null;
  assert (select status from userbase_app_posts where id = p.id) = 'failed', 'persisted, not rolled back';
  assert (select count(*) from userbase_app_post_events where post_id = p.id and detail = 'legacy_target_unknown') = 1;
  perform pg_temp.expect(format($q$select userbase_app_post_publish_requeue(%L,'coletivoxv',%L)$q$, x, p.id), 'UB409');

  -- c: first reserve, identical re-reserve, publish, then immutable
  select * into p from userbase_app_post_publish_claim((select t.id from t_ids t where k='c'),'w1');
  p := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'SkateUser ', 'shared_default', 'peak.snaps', C1);
  assert p.status = 'publishing' and p.publish_author = 'skateuser' and p.publish_parent_author = 'peak.snaps' and p.publish_parent_permlink = C1;
  p := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'skateuser', 'shared_default', 'peak.snaps', C1);
  assert p.status = 'publishing', 'identical re-reserve is a no-op';
  p := userbase_app_post_publish_complete(p.id, p.publish_claim_token, true);
  assert p.status = 'published';
  perform pg_temp.expect(format($q$update userbase_app_posts set publish_parent_permlink = %L where id = %L$q$, C2, p.id), 'UB409');

  -- d: container rotated between attempts -> target_changed, persisted, terminal
  select * into p from userbase_app_post_publish_claim((select t.id from t_ids t where k='d'),'w1');
  p := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'skateuser', 'shared_default', 'peak.snaps', C1);
  p := userbase_app_post_publish_complete(p.id, p.publish_claim_token, false, 'chain_unavailable');
  assert p.status = 'approved' and p.publish_parent_permlink = C1, 'parent kept for the retry';
  select * into p from userbase_app_post_publish_claim(p.id,'w1');
  p := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'skateuser', 'shared_default', 'peak.snaps', C2);
  assert p.status = 'failed' and p.last_error_code = 'target_changed' and p.publish_parent_permlink = C1;
  assert (select status from userbase_app_posts where id = p.id) = 'failed';
  assert (select count(*) from userbase_app_post_publish_claim(p.id,'w1')) = 0, 'failed is not claimable';
  perform pg_temp.expect(format($q$select userbase_app_post_publish_requeue(%L,'coletivoxv',%L)$q$, x, p.id), 'UB409');

  -- e: different author or signer later -> target_changed too
  select * into p from userbase_app_post_publish_claim((select t.id from t_ids t where k='e'),'w1');
  p := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'skateuser', 'shared_default', 'peak.snaps', C1);
  p := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'alice-own', 'own_key', 'peak.snaps', C1);
  assert p.status = 'failed' and p.last_error_code = 'target_changed' and p.publish_author = 'skateuser';

  -- f: expired lease and lost claim can't reserve
  select * into p from userbase_app_post_publish_claim((select t.id from t_ids t where k='f'),'w1');
  tok := p.publish_claim_token;
  update userbase_app_posts set publish_lease_until = now() - interval '1 second' where id = p.id;
  perform pg_temp.expect(format($q$select userbase_app_post_publish_reserve_target(%L,%L,'skateuser','shared_default','peak.snaps',%L)$q$, p.id, tok, C1), 'UB409');
  select * into p from userbase_app_post_publish_claim(p.id,'w2');
  assert p.publish_claim_token <> tok;
  perform pg_temp.expect(format($q$select userbase_app_post_publish_reserve_target(%L,%L,'skateuser','shared_default','peak.snaps',%L)$q$, p.id, tok, C1), 'UB409');
  p := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'skateuser', 'shared_default', 'peak.snaps', C1);
  assert p.status = 'publishing' and p.publish_parent_permlink = C1;

  -- g: ordinary failure still requeues (and keeps its reserved destination)
  select * into p from userbase_app_post_publish_claim((select t.id from t_ids t where k='g'),'w1');
  p := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'skateuser', 'shared_default', 'peak.snaps', C1);
  p := userbase_app_post_publish_complete(p.id, p.publish_claim_token, false, 'broadcast_error', false);
  p := userbase_app_post_publish_requeue(x,'coletivoxv',p.id);
  assert p.status = 'approved' and p.publish_parent_permlink = C1;
  -- requeue still refuses withdrawn_by_author and signer_changed
  assert (select prosrc like '%withdrawn_by_author%' and prosrc like '%signer_changed%' and prosrc like '%target_changed%'
          and prosrc like '%legacy_target_unknown%' from pg_proc where proname = 'userbase_app_post_publish_requeue');
end $$;
reset role;
-- second layer: the owner can't move a reserved destination either
do $$ begin
  perform pg_temp.expect(format($q$update userbase_app_posts set publish_parent_permlink = 'snap-container-9' where id = %L$q$,
    (select id from t_ids where k='c')), 'UB409');
  perform pg_temp.expect(format($q$update userbase_app_posts set publish_parent_author = null, publish_parent_permlink = null where id = %L$q$,
    (select id from t_ids where k='c')), 'UB409');
end $$;
SQL

echo "concurrency: two calls reserve the same destination at once -> both see one reservation"
psql_run <<'SQL'
set role service_role;
select status from userbase_app_post_publish_claim((select id from t_ids where k='conc'),'wc');
SQL
TOKC=$(docker exec "$NAME" psql -U postgres -qAt -c "select publish_claim_token from userbase_app_posts where id = (select id from t_ids where k='conc')")
docker exec -i "$NAME" psql -U postgres -qAt -v ON_ERROR_STOP=1 > "$TMPD/ca" 2>&1 <<SQL &
set role service_role;
begin;
select status||':'||publish_parent_permlink from userbase_app_post_publish_reserve_target((select id from t_ids where k='conc'),'$TOKC','skateuser','shared_default','peak.snaps','snap-container-1');
select pg_sleep(2);
commit;
SQL
sleep 0.7
docker exec -i "$NAME" psql -U postgres -qAt -v ON_ERROR_STOP=1 > "$TMPD/cb" 2>&1 <<SQL
set role service_role;
select status||':'||publish_parent_permlink from userbase_app_post_publish_reserve_target((select id from t_ids where k='conc'),'$TOKC','skateuser','shared_default','peak.snaps','snap-container-1');
SQL
wait
grep -q '^publishing:snap-container-1$' "$TMPD/ca" && grep -q '^publishing:snap-container-1$' "$TMPD/cb" || { echo "FAIL concurrency"; cat "$TMPD/ca" "$TMPD/cb"; exit 1; }
[ "$(docker exec "$NAME" psql -U postgres -qAt -c "select count(*) from userbase_app_post_events where post_id = (select id from t_ids where k='conc') and action = 'publish_reserved'")" = 1 ] || { echo "FAIL concurrency: reserved twice"; exit 1; }
echo "  concurrency ok: B waited for A, saw the same destination, one reservation event"

echo "privileges"
psql_run <<'SQL'
do $$ begin
  assert has_function_privilege('service_role','public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)','execute');
  assert not has_function_privilege('anon','public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)','execute');
  assert not has_function_privilege('authenticated','public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)','execute');
  assert not (select prosecdef from pg_proc where proname = 'userbase_app_post_publish_reserve_target');
  assert has_function_privilege('service_role','public.userbase_app_post_publish_requeue(text,text,uuid)','execute');
  assert not has_function_privilege('anon','public.userbase_app_post_publish_requeue(text,text,uuid)','execute');
  assert not has_table_privilege('service_role','public.userbase_app_posts','delete');
end $$;
SQL

echo "rollback twice (legacy data intact), then re-apply"
psql_run < "$MIG/0041_userbase_app_post_snap_target.rollback.sql" 2>/dev/null
psql_run < "$MIG/0041_userbase_app_post_snap_target.rollback.sql" 2>/dev/null
psql_run <<'SQL'
do $$ begin
  assert to_regprocedure('public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)') is null;
  assert not exists (select 1 from information_schema.columns where table_name = 'userbase_app_posts' and column_name like 'publish_parent%');
  assert (select status from userbase_app_posts where id = (select id from t_ids where k='legacy_pub')) = 'published';
  assert has_function_privilege('service_role','public.userbase_app_post_publish_reserve(uuid,uuid,text,text)','execute');
  assert not has_function_privilege('anon','public.userbase_app_post_publish_reserve(uuid,uuid,text,text)','execute');
end $$;
SQL
psql_run < "$MIG/0041_userbase_app_post_snap_target.sql" 2>/dev/null
psql_run <<'SQL'
drop table public.t_ids;
SQL

echo "PASS 0041 ($IMAGE)"
