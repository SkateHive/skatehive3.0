#!/usr/bin/env bash
# Local check for sql/migrations/0043_userbase_app_post_publication_type.sql on a throwaway
# Postgres container with Supabase-like roles. Never touches Supabase.
#   bash scripts/test-0038-app-posts.sh            (postgres:17)
#   PG_IMAGE=postgres:15-alpine bash scripts/...   (other version)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/sql/migrations"
NAME="sh-0043-test-$$"
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

EXPECT_FN="create function pg_temp.expect(p_sql text, p_code text) returns void language plpgsql as \$\$
declare v text;
begin
  begin execute p_sql; exception when others then
    get stacked diagnostics v = returned_sqlstate;
    if v <> p_code then raise exception 'expected % got %: %', p_code, v, p_sql; end if;
    return;
  end;
  raise exception 'expected % but it succeeded: %', p_code, p_sql;
end \$\$;
grant execute on all functions in schema pg_temp to service_role;"

echo "history: legacy root published with 0038, then 0041, a snap published with a container, a withdrawn post"
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
  foreach kk in array array['legacy_blog','snap_pub','withdrawn','plan','legacy_res'] loop
    p := userbase_app_post_create(a,'coletivoxv','key-0043-'||kk,encode(sha256(kk::bytea),'hex'),'text','Title '||kk,'post '||kk,'[]',null,null,true);
    p := userbase_app_post_review(x,'coletivoxv',p.id,'approve');
    insert into t_ids values (kk, p.id);
  end loop;
  select * into p from userbase_app_post_publish_claim((select id from t_ids where k='legacy_blog'),'w0');
  p := userbase_app_post_publish_reserve(p.id, p.publish_claim_token, 'skateuser', 'shared_default');
  p := userbase_app_post_publish_complete(p.id, p.publish_claim_token, true);
  assert p.status = 'published';
  -- legacy_res: author reserved with 0038, no parent (becomes legacy_target_unknown later)
  select * into p from userbase_app_post_publish_claim((select id from t_ids where k='legacy_res'),'w0');
  p := userbase_app_post_publish_reserve(p.id, p.publish_claim_token, 'skateuser', 'shared_default');
  p := userbase_app_post_publish_complete(p.id, p.publish_claim_token, false, 'chain_unavailable');
  select * into p from userbase_app_post_publish_claim((select id from t_ids where k='withdrawn'),'w0');
  p := userbase_app_post_publish_complete(p.id, p.publish_claim_token, false, 'withdrawn_by_author', false);
  assert p.status = 'failed';
end $$;
SQL
psql_run < "$MIG/0041_userbase_app_post_snap_target.sql" 2>/dev/null
psql_run <<'SQL'
set role service_role;
do $$ declare p public.userbase_app_posts; begin
  select * into p from userbase_app_post_publish_claim((select id from t_ids where k='snap_pub'),'w0');
  p := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'skateuser', 'shared_default', 'peak.snaps', 'snap-container-1771683120');
  p := userbase_app_post_publish_complete(p.id, p.publish_claim_token, true);
  assert p.status = 'published' and p.publish_parent_permlink = 'snap-container-1771683120';
end $$;
reset role;
create table public.t_before as select id, body_hash, request_hash, publish_author, publish_permlink,
  publish_parent_author, publish_parent_permlink, status, published_at, last_error_code from public.userbase_app_posts;
SQL

echo "an open connection with prepared statements on the recreated read RPCs"
docker exec -i "$NAME" psql -U postgres -qAt -v ON_ERROR_STOP=1 > "$TMPD/plan" 2>&1 <<'SQL' &
set role service_role;
prepare f as select count(*) from userbase_app_feed('coletivoxv');
prepare g as select count(*) from userbase_app_post_list_mine(encode(sha256('alice'::bytea),'hex'),'coletivoxv');
execute f; execute g;
select pg_sleep(4);
select 'after-feed', count(*) from userbase_app_feed('coletivoxv');
select 'after-mine', count(*) from userbase_app_post_list_mine(encode(sha256('alice'::bytea),'hex'),'coletivoxv');
execute f;
execute g;
SQL
sleep 1.5

echo "apply 0043 twice (idempotent)"
psql_run < "$MIG/0043_userbase_app_post_publication_type.sql" 2>/dev/null
psql_run < "$MIG/0043_userbase_app_post_publication_type.sql" 2>/dev/null
wait
grep -q '^after-feed|2$' "$TMPD/plan" && grep -q '^after-mine|5$' "$TMPD/plan" && [ "$(grep -c -E '^(2|5)$' "$TMPD/plan")" -ge 4 ] && ! grep -q ERROR "$TMPD/plan" || { echo "FAIL open connection"; cat "$TMPD/plan"; exit 1; }
echo "  open connection ok (by name and via statements prepared before the drop+create)"

echo "existing rows preserved; legacy root reclassified with an event"
psql_run <<'SQL'
do $$ begin
  -- nothing changed except publication_type on the legacy root
  assert not exists (
    select 1 from public.userbase_app_posts p join public.t_before b using (id)
    where (p.body_hash, p.request_hash, p.publish_author, p.publish_permlink, p.publish_parent_author,
           p.publish_parent_permlink, p.status, p.published_at, p.last_error_code)
       is distinct from
          (b.body_hash, b.request_hash, b.publish_author, b.publish_permlink, b.publish_parent_author,
           b.publish_parent_permlink, b.status, b.published_at, b.last_error_code)), 'rows unchanged';
  assert (select publication_type from userbase_app_posts where id = (select id from t_ids where k='legacy_blog')) = 'article';
  assert (select publish_parent_author is null from userbase_app_posts where id = (select id from t_ids where k='legacy_blog'));
  assert (select publication_type from userbase_app_posts where id = (select id from t_ids where k='snap_pub')) = 'snap';
  assert (select publication_type from userbase_app_posts where id = (select id from t_ids where k='withdrawn')) = 'snap';
  assert (select count(*) from userbase_app_post_events where post_id = (select id from t_ids where k='legacy_blog') and action = 'reclassified') = 1,
    'one reclassified event, even after applying twice';
end $$;
SQL

echo "behaviour (as service_role)"
psql_run <<SQL
$EXPECT_FN
set role service_role;
do \$\$
declare
  a text := encode(sha256('alice'::bytea),'hex'); x text := encode(sha256('xv1'::bytea),'hex');
  p public.userbase_app_posts; q public.userbase_app_posts; r record; big text := repeat('a', 20000);
begin
  -- old clients (no p_publication_type) get a snap with the old hash formula
  p := userbase_app_post_create(p_token_hash => a, p_app => 'coletivoxv', p_idempotency_key => 'key-0043-old', p_request_hash => repeat('1',64),
        p_kind => 'text', p_title => null, p_body => 'old client', p_media => '[]', p_context_kind => null, p_context_slug => null, p_consent_publish => true);
  assert p.publication_type = 'snap';
  assert p.body_hash = userbase_app__body_hash(p.kind, p.title, p.body, p.media, p.context_kind, p.context_slug), 'snap hash unchanged';
  -- article: title + body required, limits per type
  perform pg_temp.expect(format(\$q\$select userbase_app_post_create(%L,'coletivoxv','key-0043-a1',repeat('2',64),'text',null,'body','[]',null,null,true,'article')\$q\$, a), 'UB422');
  perform pg_temp.expect(format(\$q\$select userbase_app_post_create(%L,'coletivoxv','key-0043-a2',repeat('3',64),'photo','Title','',%L,null,null,true,'article')\$q\$, a, '[{"type":"image","url":"https://images.hive.blog/x.jpg"}]'), 'UB422');
  perform pg_temp.expect(format(\$q\$select userbase_app_post_create(%L,'coletivoxv','key-0043-a3',repeat('4',64),'text',%L,'b','[]',null,null,true,'article')\$q\$, a, repeat('t',121)), 'UB422');
  perform pg_temp.expect(format(\$q\$select userbase_app_post_create(%L,'coletivoxv','key-0043-a4',repeat('5',64),'text','T',%L,'[]',null,null,true,'article')\$q\$, a, big || 'x'), 'UB422');
  perform pg_temp.expect(format(\$q\$select userbase_app_post_create(%L,'coletivoxv','key-0043-s1',repeat('6',64),'text',null,%L,'[]',null,null,true,'snap')\$q\$, a, repeat('s',5001)), 'UB422');
  perform pg_temp.expect(format(\$q\$select userbase_app_post_create(%L,'coletivoxv','key-0043-z1',repeat('7',64),'text',null,'b','[]',null,null,true,'story')\$q\$, a), 'UB422');
  p := userbase_app_post_create(a,'coletivoxv','key-0043-art',repeat('8',64),'text','Arte do Corre II',big,'[]','instalacao','rio-de-janeiro',true,'article');
  assert p.publication_type = 'article' and length(p.body) = 20000;
  assert p.body_hash <> userbase_app__body_hash(p.kind, p.title, p.body, p.media, p.context_kind, p.context_slug), 'article hash includes the type';
  assert p.body_hash = userbase_app__body_hash_v2('article', p.kind, p.title, p.body, p.media, p.context_kind, p.context_slug);
  q := userbase_app_post_create(a,'coletivoxv','key-0043-art',repeat('8',64),'text','Arte do Corre II',big,'[]','instalacao','rio-de-janeiro',true,'article');
  assert q.id = p.id, 'idempotent retry';
  -- type is immutable
  perform pg_temp.expect(format(\$q\$update userbase_app_posts set publication_type='snap' where id=%L\$q\$, p.id), 'UB409');
  perform pg_temp.expect(format(\$q\$update userbase_app_posts set publication_type='snap' where id=%L\$q\$, (select id from t_ids where k='legacy_blog')), 'UB409');

  -- article destination: only '' + hive-173115
  p := userbase_app_post_review(x,'coletivoxv',p.id,'approve');
  select * into p from userbase_app_post_publish_claim(p.id,'w1');
  perform pg_temp.expect(format(\$q\$select userbase_app_post_publish_reserve_target(%L,%L,'skateuser','shared_default','peak.snaps','snap-container-1')\$q\$, p.id, p.publish_claim_token), 'UB422');
  perform pg_temp.expect(format(\$q\$select userbase_app_post_publish_reserve_target(%L,%L,'skateuser','shared_default','','hive-999999')\$q\$, p.id, p.publish_claim_token), 'UB422');
  perform pg_temp.expect(format(\$q\$select userbase_app_post_publish_reserve_target(%L,%L,'skateuser','shared_default',null,'hive-173115')\$q\$, p.id, p.publish_claim_token), 'UB422');
  assert (select publish_author is null and publish_parent_author is null and status = 'publishing' from userbase_app_posts where id = p.id), 'nothing written';
  q := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'skateuser', 'shared_default', '', 'hive-173115');
  assert q.status = 'publishing' and q.publish_parent_author = '' and q.publish_parent_permlink = 'hive-173115';
  q := userbase_app_post_publish_reserve_target(p.id, p.publish_claim_token, 'skateuser', 'shared_default', '', 'hive-173115');
  assert q.status = 'publishing', 'identical re-reserve no-op';
  q := userbase_app_post_publish_complete(p.id, p.publish_claim_token, true);
  assert q.status = 'published' and q.publish_parent_author = '';
  perform pg_temp.expect(format(\$q\$update userbase_app_posts set publish_parent_author=null, publish_parent_permlink=null where id=%L\$q\$, p.id), 'UB409');

  -- snap destination: only peak.snaps container; article destination refused
  q := userbase_app_post_create(a,'coletivoxv','key-0043-snap2',repeat('9',64),'text',null,'snap two','[]',null,null,true);
  q := userbase_app_post_review(x,'coletivoxv',q.id,'approve');
  select * into q from userbase_app_post_publish_claim(q.id,'w1');
  perform pg_temp.expect(format(\$q\$select userbase_app_post_publish_reserve_target(%L,%L,'skateuser','shared_default','','hive-173115')\$q\$, q.id, q.publish_claim_token), 'UB422');
  q := userbase_app_post_publish_reserve_target(q.id, q.publish_claim_token, 'skateuser', 'shared_default', 'peak.snaps', 'snap-container-1771683120');
  -- rotation still -> target_changed (persisted)
  q := userbase_app_post_publish_complete(q.id, q.publish_claim_token, false, 'chain_unavailable');
  select * into q from userbase_app_post_publish_claim(q.id,'w1');
  q := userbase_app_post_publish_reserve_target(q.id, q.publish_claim_token, 'skateuser', 'shared_default', 'peak.snaps', 'snap-container-1771769520');
  assert q.status = 'failed' and q.last_error_code = 'target_changed';
  assert (select status from userbase_app_posts where id = q.id) = 'failed';

  -- direct row writes can't fake an article destination on a snap
  perform pg_temp.expect(format(\$q\$insert into userbase_app_posts (app,user_id,idempotency_key,request_hash,kind,body,consent_publish_at,publication_type,title)
    values ('coletivoxv','00000000-0000-0000-0000-00000000000a','key-0043-raw',repeat('a',64),'text','x',now(),'article',null)\$q\$), '23514');

  -- read RPCs carry publication_type; public detail is published-only
  assert (select count(*) from userbase_app_feed('coletivoxv') where publication_type = 'article') = 2;
  assert (select publication_type from userbase_app_post_get(a,'coletivoxv',(select id from t_ids where k='legacy_blog'))) = 'article';
  assert (select count(*) from userbase_app_post_queue(x,'coletivoxv','failed') where publication_type = 'snap') >= 1;
  select * into r from userbase_app_post_public('coletivoxv', p.id);
  assert r.publication_type = 'article' and r.title = 'Arte do Corre II' and length(r.body) = 20000 and r.publish_permlink is not null;
  assert (select count(*) from userbase_app_post_public('coletivoxv', (select id from t_ids where k='withdrawn'))) = 0, 'not published -> nothing';
  assert (select count(*) from userbase_app_post_public('other', p.id)) = 0;

  -- safeguards unchanged
  perform pg_temp.expect(format(\$q\$select userbase_app_post_publish_requeue(%L,'coletivoxv',%L)\$q\$, x, (select id from t_ids where k='withdrawn')), 'UB409');
  perform pg_temp.expect(format(\$q\$select userbase_app_post_publish_requeue(%L,'coletivoxv',%L)\$q\$, x, q.id), 'UB409');
  assert to_regprocedure('public.userbase_app_post_publish_mark_legacy(uuid,uuid,text)') is not null;
  assert to_regprocedure('public.userbase_app_post_create(text,text,text,text,text,text,text,jsonb,text,text,boolean)') is null, 'old create signature gone';
end \$\$;
reset role;
do \$\$ begin
  -- no email in the new public RPC
  assert not exists (select 1 from pg_proc where proname = 'userbase_app_post_public' and array_to_string(proargnames, ',') ilike '%email%');
end \$\$;
SQL

echo "privileges"
psql_run <<'SQL'
do $$
declare f text;
begin
  foreach f in array array['public.userbase_app_post_public(text,uuid)',
    'public.userbase_app_post_create(text,text,text,text,text,text,text,jsonb,text,text,boolean,text)',
    'public.userbase_app_feed(text,text,text,timestamptz,uuid,integer)',
    'public.userbase_app_post_get(text,text,uuid)',
    'public.userbase_app_post_queue(text,text,text,timestamptz,uuid,integer)',
    'public.userbase_app__body_hash_v2(text,text,text,text,jsonb,text,text)',
    'public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)'] loop
    assert has_function_privilege('service_role', f, 'execute'), f || ' service_role';
    assert not has_function_privilege('anon', f, 'execute'), f || ' anon';
    assert not has_function_privilege('authenticated', f, 'execute'), f || ' authenticated';
    assert not (select prosecdef from pg_proc where oid = to_regprocedure(f)), f || ' definer';
  end loop;
  assert not has_function_privilege('service_role','public.userbase_app_post_reconcile_legacy_root(uuid,text,text)','execute');
end $$;
SQL

echo "owner reconcile of a legacy root after 0043 marks it article (narrow guard exception)"
psql_run <<SQL
$EXPECT_FN
set role service_role;
do \$\$ declare p public.userbase_app_posts; begin
  select * into p from userbase_app_post_publish_claim((select id from t_ids where k='legacy_res'),'w9');
  p := userbase_app_post_publish_mark_legacy(p.id, p.publish_claim_token, 'root on chain (test)');
  assert p.status = 'failed' and p.last_error_code = 'legacy_target_unknown' and p.publication_type = 'snap';
  -- the API can't reconcile, nor forge the flag to flip the type
  perform pg_temp.expect(format(\$q\$select userbase_app_post_reconcile_legacy_root(%L,'api','x')\$q\$, p.id), '42501');
  perform set_config('userbase.reconcile_legacy_root', 'on', true);
  perform pg_temp.expect(format(\$q\$update userbase_app_posts set publication_type='article', status='published', published_at=now() where id=%L\$q\$, p.id), 'UB409');
  perform pg_temp.expect(format(\$q\$update userbase_app_posts set publication_type='article' where id=%L\$q\$, p.id), 'UB409');
  perform set_config('userbase.reconcile_legacy_root', '', true);
end \$\$;
reset role;
do \$\$ declare q public.userbase_app_posts; b record; begin
  -- owner, but without the function (no flag): still refused
  perform pg_temp.expect(format(\$q\$update userbase_app_posts set publication_type='article' where id=%L\$q\$, (select id from t_ids where k='legacy_res')), 'UB409');
  select * into b from t_before where id = (select id from t_ids where k='legacy_res');
  q := userbase_app_post_reconcile_legacy_root((select id from t_ids where k='legacy_res'), 'grip', 'root confirmed on chain (test)');
  assert q.status = 'published' and q.publication_type = 'article' and q.publish_parent_author is null;
  assert q.body_hash = b.body_hash and q.request_hash = b.request_hash and q.publish_author = b.publish_author
     and q.publish_permlink = b.publish_permlink, 'content, hashes and destination preserved';
  assert (select count(*) from userbase_app_post_events where post_id = q.id and action = 'reclassified') = 1;
  assert (select count(*) from userbase_app_post_events where post_id = q.id and action = 'publish_succeeded'
          and detail like 'legacy root reconciled by operator%') = 1;
  -- the flag does not outlive the call
  perform pg_temp.expect(format(\$q\$update userbase_app_posts set publication_type='article' where id=%L\$q\$, (select id from t_ids where k='snap_pub')), 'UB409');
end \$\$;
SQL
psql_run < "$MIG/0043_userbase_app_post_publication_type.sql" 2>/dev/null
psql_run <<'SQL'
do $$ begin
  assert (select publication_type from userbase_app_posts where id = (select id from t_ids where k='legacy_res')) = 'article';
  assert (select count(*) from userbase_app_post_events where post_id = (select id from t_ids where k='legacy_res') and action = 'reclassified') = 1,
    're-apply after reconcile: no duplicate event';
  assert (select count(*) from userbase_app_post_events where post_id = (select id from t_ids where k='legacy_blog') and action = 'reclassified') = 1;
end $$;
SQL
echo "  reconcile -> article ok; API role / forged flag refused; re-apply clean"

echo "rollback refuses once an article is reserved; works on a clean history"
if psql_run < "$MIG/0043_userbase_app_post_publication_type.rollback.sql" > "$TMPD/rb" 2>&1; then
  echo "FAIL rollback should refuse"; exit 1
fi
grep -q "0043 rollback refused" "$TMPD/rb" || { echo "FAIL unexpected rollback error"; cat "$TMPD/rb"; exit 1; }
psql_run <<'SQL'
do $$ begin assert (select count(*) from userbase_app_posts where publication_type = 'article') = 3, 'refused rollback changed nothing'; end $$;
SQL
echo "  refused, nothing changed"
SQL_CLEAN_NAME="sh-0043-rb-$$"
docker rm -f "$NAME" >/dev/null 2>&1 || true
NAME="$SQL_CLEAN_NAME"
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test "$IMAGE" >/dev/null
for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done; sleep 1
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
psql_run < "$MIG/0036_userbase_app_memberships.sql" 2>/dev/null
psql_run < "$MIG/0038_userbase_app_posts.sql" 2>/dev/null
psql_run < "$MIG/0041_userbase_app_post_snap_target.sql" 2>/dev/null
# fixture: one published legacy root (written with triggers off, test only)
psql_run <<'SQL'
insert into userbase_users (id, handle) values ('00000000-0000-0000-0000-0000000000c1', 'carol');
set session_replication_role = replica;
insert into userbase_app_posts (id, app, user_id, idempotency_key, request_hash, kind, title, body, consent_publish_at,
  body_hash, status, reviewed_at, publish_permlink, publish_author, publish_signer_kind, published_at)
values ('20000000-0000-0000-0000-0000000000c1', 'coletivoxv', '00000000-0000-0000-0000-0000000000c1', 'key-0043-legacy-c',
  repeat('c', 64), 'text', 'Legacy blog', 'legacy body', now(), repeat('d', 64), 'published', now(),
  'coletivoxv-legacyc', 'skateuser', 'shared_default', now());
set session_replication_role = origin;
SQL
psql_run < "$MIG/0043_userbase_app_post_publication_type.sql" 2>/dev/null
psql_run <<'SQL'
do $$ begin assert (select publication_type from userbase_app_posts where id = '20000000-0000-0000-0000-0000000000c1') = 'article'; end $$;
SQL
# only the reclassified legacy root is an article -> rollback allowed (x2)
psql_run < "$MIG/0043_userbase_app_post_publication_type.rollback.sql" 2>/dev/null
psql_run < "$MIG/0043_userbase_app_post_publication_type.rollback.sql" 2>/dev/null
psql_run <<'SQL'
do $$ begin
  assert (select status = 'published' and publish_author = 'skateuser' and publish_parent_author is null
          from userbase_app_posts where id = '20000000-0000-0000-0000-0000000000c1'), 'legacy row intact after rollback';
end $$;
SQL
psql_run <<'SQL'
do $$ begin
  assert not exists (select 1 from information_schema.columns where table_name='userbase_app_posts' and column_name='publication_type');
  assert to_regprocedure('public.userbase_app_post_public(text,uuid)') is null;
  assert to_regprocedure('public.userbase_app_post_create(text,text,text,text,text,text,text,jsonb,text,text,boolean)') is not null;
  assert has_function_privilege('service_role','public.userbase_app_post_create(text,text,text,text,text,text,text,jsonb,text,text,boolean)','execute');
  assert not has_function_privilege('anon','public.userbase_app_post_create(text,text,text,text,text,text,text,jsonb,text,text,boolean)','execute');
  assert (select prosrc like '%destination must be a peak.snaps snap-container%' from pg_proc where proname='userbase_app_post_publish_reserve_target');
end $$;
SQL
psql_run < "$MIG/0043_userbase_app_post_publication_type.sql" 2>/dev/null
psql_run <<'SQL'
do $$ begin
  assert (select publication_type from userbase_app_posts where id = '20000000-0000-0000-0000-0000000000c1') = 'article', 're-applied';
end $$;
-- a NEW article that is only pending (no reservation) must block the rollback
insert into userbase_app_posts (app, user_id, idempotency_key, request_hash, kind, publication_type, title, body, consent_publish_at)
values ('coletivoxv', '00000000-0000-0000-0000-0000000000c1', 'key-0043-pending-art', repeat('e', 64), 'text', 'article', 'Pending article', 'body', now());
SQL
if psql_run < "$MIG/0043_userbase_app_post_publication_type.rollback.sql" > "$TMPD/rb2" 2>&1; then
  echo "FAIL rollback must refuse a pending article"; exit 1
fi
grep -q "0043 rollback refused" "$TMPD/rb2" || { echo "FAIL unexpected"; cat "$TMPD/rb2"; exit 1; }
psql_run <<'SQL'
do $$ begin
  assert (select publication_type from userbase_app_posts where idempotency_key = 'key-0043-pending-art') = 'article', 'choice preserved';
end $$;
SQL
echo "  clean history: legacy-only rollback x2 + re-apply ok; pending article blocks rollback"

echo "PASS 0043 ($IMAGE)"
