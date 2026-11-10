#!/usr/bin/env bash
# Local check for sql/migrations/0038_userbase_app_posts.sql on a throwaway
# Postgres container with Supabase-like roles. Never touches Supabase.
#   bash scripts/test-0038-app-posts.sh            (postgres:17)
#   PG_IMAGE=postgres:15-alpine bash scripts/...   (other version)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MIG="$ROOT/sql/migrations"
NAME="sh-0038-test-$$"
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

echo "apply 0038 twice (idempotent)"
psql_run < "$MIG/0038_userbase_app_posts.sql"
psql_run < "$MIG/0038_userbase_app_posts.sql" 2>/dev/null

echo "behaviour (as service_role)"
psql_run <<'SQL'
-- People: alice (author), xvlad (moderator, two emails), bob (other user),
-- mallory (tries to take xvlad's handle).
insert into userbase_users (id, handle) values
  ('00000000-0000-0000-0000-00000000000a', 'alice'),
  ('00000000-0000-0000-0000-00000000000b', 'xvlad-lite'),
  ('00000000-0000-0000-0000-00000000000c', 'bob'),
  ('00000000-0000-0000-0000-00000000000d', 'mallory');
insert into userbase_auth_methods (id, user_id, type, identifier, verified_at) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a', 'email_magic', 'alice@example.invalid', now()),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000b', 'email_magic', 'xv1@example.invalid', now()),
  ('10000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000000b', 'email_magic', 'xv2@example.invalid', now()),
  ('10000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000c', 'email_magic', 'bob@example.invalid', now()),
  ('10000000-0000-0000-0000-00000000000d', '00000000-0000-0000-0000-00000000000d', 'email_magic', 'mal@example.invalid', now());

create function pg_temp.h(t text) returns text language sql
  as $$ select encode(sha256(convert_to(t, 'utf8')), 'hex') $$;
-- expect(sql, sqlstate): the statement must fail with exactly that code.
create function pg_temp.expect(p_sql text, p_code text) returns void language plpgsql as $$
declare v text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v = returned_sqlstate;
    if v <> p_code then
      raise exception 'expected % got %: %', p_code, v, p_sql;
    end if;
    return;
  end;
  raise exception 'expected % but it succeeded: %', p_code, p_sql;
end $$;
grant execute on all functions in schema pg_temp to service_role;

set role service_role;

-- App sessions (0036 RPC), one per person; xvlad gets one per email.
select count(*) from userbase_app_login('00000000-0000-0000-0000-00000000000a','coletivoxv','alice@example.invalid',pg_temp.h('alice'),now()+interval '30 days','email_otp');
select count(*) from userbase_app_login('00000000-0000-0000-0000-00000000000b','coletivoxv','xv1@example.invalid',pg_temp.h('xv1'),now()+interval '30 days','email_otp');
select count(*) from userbase_app_login('00000000-0000-0000-0000-00000000000b','coletivoxv','xv2@example.invalid',pg_temp.h('xv2'),now()+interval '30 days','email_otp');
select count(*) from userbase_app_login('00000000-0000-0000-0000-00000000000c','coletivoxv','bob@example.invalid',pg_temp.h('bob'),now()+interval '30 days','email_otp');
select count(*) from userbase_app_login('00000000-0000-0000-0000-00000000000d','coletivoxv','mal@example.invalid',pg_temp.h('mal'),now()+interval '30 days','email_otp');

do $$
declare
  a text := pg_temp.h('alice'); x1 text := pg_temp.h('xv1'); x2 text := pg_temp.h('xv2');
  b text := pg_temp.h('bob');  m text := pg_temp.h('mal');
  rh text := pg_temp.h('req1');
  img jsonb := '[{"type":"image","url":"https://images.hive.blog/DQm/photo.jpg","alt":"a"}]';
  vid jsonb := '[{"type":"video","url":"https://ipfs.skatehive.app/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG","poster":"https://ipfs.skatehive.app/ipfs/QmPoster"}]';
  p public.userbase_app_posts; p2 public.userbase_app_posts; q public.userbase_app_posts;
  ch record; ch2 record; mo public.userbase_app_moderators; me record; n int;
  tok uuid;
begin
  -- ---------- auth ----------
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-00000001',%L,'text',null,'hi','[]',null,null,true)$q$, pg_temp.h('nope'), rh), 'UB401');
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'otherapp','k-00000001',%L,'text',null,'hi','[]',null,null,true)$q$, a, rh), 'UB401');

  -- ---------- create ----------
  p := userbase_app_post_create(a,'coletivoxv','k-00000001',rh,'text',null,'primeiro post','[]','instalacao','escultura-1',true);
  assert p.status = 'pending' and p.user_id = '00000000-0000-0000-0000-00000000000a';
  assert p.publish_permlink = 'coletivoxv-' || replace(p.id::text,'-',''), 'deterministic permlink';
  assert p.body_hash ~ '^[0-9a-f]{64}$' and p.consent_publish_at is not null;
  -- same key + same request: same row; same key + other body: 409
  p2 := userbase_app_post_create(a,'coletivoxv','k-00000001',rh,'text',null,'primeiro post','[]','instalacao','escultura-1',true);
  assert p2.id = p.id, 'idempotent retry';
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-00000001',%L,'text',null,'outro','[]',null,null,true)$q$, a, pg_temp.h('req2')), 'UB409');
  -- consent, emptiness, kind/media shape, hosts, context pair
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-00000002',%L,'text',null,'x','[]',null,null,false)$q$, a, rh), 'UB422');
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-00000003',%L,'text',null,'   ','[]',null,null,true)$q$, a, rh), 'UB422');
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-00000004',%L,'text',null,'x',%L,null,null,true)$q$, a, rh, img), 'UB422');
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-00000005',%L,'photo',null,'',%L,null,null,true)$q$, a, rh, '[{"type":"image","url":"https://evil.example/x.jpg"}]'), 'UB422');
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-00000006',%L,'video',null,'',%L,null,null,true)$q$, a, rh, '[{"type":"video","url":"https://ipfs.skatehive.app/ipfs/Qm/../x"}]'), 'UB422');
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-00000007',%L,'photo',null,'',%L,null,null,true)$q$, a, rh, '[{"type":"image","url":"https://images.hive.blog/a.jpg","onclick":"x"}]'), 'UB422');
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-00000008',%L,'text',null,'x','[]','instalacao',null,true)$q$, a, rh), 'UB422');
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-00000009',%L,'text',null,'x','[]','festa','x',true)$q$, a, rh), 'UB422');
  -- empty body with media is valid; title optional
  q := userbase_app_post_create(a,'coletivoxv','k-00000010',pg_temp.h('photo'),'photo',null,'',img,null,null,true);
  assert q.status = 'pending' and q.title is null;
  q := userbase_app_post_create(a,'coletivoxv','k-00000011',pg_temp.h('video'),'video','Vídeo','',vid,'evento','abertura',true);
  assert q.kind = 'video';

  -- ---------- moderator binding ----------
  perform pg_temp.expect(format($q$select * from userbase_app_moderator_challenge_create(%L,'coletivoxv','randomguy')$q$, x1), 'UB403');
  -- pharraxv is seeded revoked (not on Hive yet): no challenge, no binding
  assert (select revoked_at is not null from userbase_app_moderator_allowlist where hive_handle = 'pharraxv');
  assert (select revoked_at is null from userbase_app_moderator_allowlist where hive_handle = 'wilbor');
  perform pg_temp.expect(format($q$select * from userbase_app_moderator_challenge_create(%L,'coletivoxv','pharraxv')$q$, m), 'UB403');
  select * into ch from userbase_app_moderator_challenge_create(x1,'coletivoxv','XVlad');
  assert ch.message like '%account: xvlad%' and ch.message like '%app: coletivoxv%', 'challenge message names app+handle';
  assert ch.expires_at <= now() + interval '5 minutes';
  -- another session can't read or consume it
  perform pg_temp.expect(format($q$select * from userbase_app_moderator_challenge_get(%L,'coletivoxv',%L)$q$, m, ch.challenge_id), 'UB404');
  perform pg_temp.expect(format($q$select userbase_app_moderator_bind(%L,'coletivoxv',%L,'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4')$q$, m, ch.challenge_id), 'UB410');
  -- same user, other email session: not its challenge either
  perform pg_temp.expect(format($q$select * from userbase_app_moderator_challenge_get(%L,'coletivoxv',%L)$q$, x2, ch.challenge_id), 'UB404');
  perform 1 from userbase_app_moderator_challenge_get(x1,'coletivoxv',ch.challenge_id);
  perform pg_temp.expect(format($q$select userbase_app_moderator_bind(%L,'coletivoxv',%L,'not-a-key')$q$, x1, ch.challenge_id), 'UB422');
  -- the failed bind rolled back with its statement, so the challenge is still open
  mo := userbase_app_moderator_bind(x1,'coletivoxv',ch.challenge_id,'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4');
  assert mo.hive_handle = 'xvlad' and mo.auth_method_id = '10000000-0000-0000-0000-00000000000b';
  perform pg_temp.expect(format($q$select userbase_app_moderator_bind(%L,'coletivoxv',%L,'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4')$q$, x1, ch.challenge_id), 'UB410');
  -- expired challenge
  select * into ch2 from userbase_app_moderator_challenge_create(x1,'coletivoxv','xvlad');
  update userbase_app_moderator_challenges set created_at = now() - interval '6 minutes', expires_at = now() - interval '1 minute' where id = ch2.challenge_id;
  perform pg_temp.expect(format($q$select userbase_app_moderator_bind(%L,'coletivoxv',%L,'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4')$q$, x1, ch2.challenge_id), 'UB410');
  -- mallory proves... nothing: xvlad is bound to another account -> 409
  select * into ch2 from userbase_app_moderator_challenge_create(m,'coletivoxv','xvlad');
  perform pg_temp.expect(format($q$select userbase_app_moderator_bind(%L,'coletivoxv',%L,'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4')$q$, m, ch2.challenge_id), 'UB409');

  -- moderator only through the bound email's session
  select * into me from userbase_app_me(x1,'coletivoxv');
  assert me.moderator_handle = 'xvlad', 'bound email session is moderator';
  select * into me from userbase_app_me(x2,'coletivoxv');
  assert me.moderator_handle is null, 'other email of same user is NOT moderator';
  select * into me from userbase_app_me(a,'coletivoxv');
  assert me.moderator_handle is null and me.handle = 'alice';

  -- ---------- review ----------
  perform pg_temp.expect(format($q$select userbase_app_post_review(%L,'coletivoxv',%L,'approve')$q$, a, p.id), 'UB403');
  perform pg_temp.expect(format($q$select userbase_app_post_review(%L,'coletivoxv',%L,'approve')$q$, x2, p.id), 'UB403');
  perform pg_temp.expect(format($q$select * from userbase_app_post_queue(%L,'coletivoxv')$q$, b), 'UB403');
  assert (select count(*) from userbase_app_post_queue(x1,'coletivoxv')) = 3;
  perform pg_temp.expect(format($q$select userbase_app_post_review(%L,'coletivoxv',%L,'maybe')$q$, x1, p.id), 'UB422');
  p := userbase_app_post_review(x1,'coletivoxv',p.id,'approve');
  assert p.status = 'approved' and p.reviewed_by_hive_handle = 'xvlad';
  perform pg_temp.expect(format($q$select userbase_app_post_review(%L,'coletivoxv',%L,'reject')$q$, x1, p.id), 'UB409');
  perform pg_temp.expect(format($q$select userbase_app_post_review(%L,'coletivoxv',%L,'approve')$q$, x1, gen_random_uuid()), 'UB404');
  q := userbase_app_post_review(x1,'coletivoxv',(select id from userbase_app_posts where idempotency_key='k-00000010'),'reject','fora do tema');
  assert q.status = 'rejected' and q.reject_reason = 'fora do tema';

  -- owner / moderator view; others 404
  assert (select is_owner from userbase_app_post_get(a,'coletivoxv',p.id));
  assert (select viewer_is_moderator from userbase_app_post_get(x1,'coletivoxv',p.id));
  perform pg_temp.expect(format($q$select * from userbase_app_post_get(%L,'coletivoxv',%L)$q$, b, p.id), 'UB404');
  assert (select count(*) from userbase_app_post_list_mine(a,'coletivoxv')) = 3;

  -- ---------- immutability + state machine (even for service_role) ----------
  perform pg_temp.expect(format($q$update userbase_app_posts set body='edited' where id=%L$q$, p.id), 'UB409');
  perform pg_temp.expect(format($q$update userbase_app_posts set title='new title' where id=%L$q$, p.id), 'UB409');
  perform pg_temp.expect(format($q$update userbase_app_posts set kind='photo', media=%L where id=%L$q$, img, p.id), 'UB409');
  perform pg_temp.expect(format($q$update userbase_app_posts set consent_publish_at=now() - interval '1 day' where id=%L$q$, p.id), 'UB409');
  perform pg_temp.expect(format($q$update userbase_app_posts set publish_permlink='other' where id=%L$q$, p.id), 'UB409');
  perform pg_temp.expect(format($q$update userbase_app_posts set status='pending' where id=%L$q$, p.id), 'UB409');
  perform pg_temp.expect(format($q$update userbase_app_posts set status='published' where id=%L$q$, p.id), 'UB409');
  perform pg_temp.expect(format($q$update userbase_app_posts set status='approved' where id=%L$q$, q.id), 'UB409');
  perform pg_temp.expect(format($q$insert into userbase_app_posts (app,user_id,idempotency_key,request_hash,kind,body,consent_publish_at,status) values ('coletivoxv','00000000-0000-0000-0000-00000000000a','k-direct-1',%L,'text','x',now(),'published')$q$, rh), 'UB422');

  -- ---------- publish ----------
  assert (select count(*) from userbase_app_feed('coletivoxv')) = 0, 'nothing published yet';
  select * into q from userbase_app_post_publish_claim(p.id,'w1');
  assert q.status = 'publishing' and q.publish_attempts = 1 and q.publish_claim_token is not null;
  -- a second claim of the same post gets nothing while the lease is live
  assert (select count(*) from userbase_app_post_publish_claim(p.id,'w2')) = 0;
  -- success needs a reserved author
  perform pg_temp.expect(format($q$select userbase_app_post_publish_complete(%L,%L,true)$q$, p.id, q.publish_claim_token), 'UB409');
  perform pg_temp.expect(format($q$select userbase_app_post_publish_reserve(%L,%L,'skateuser','own_key')$q$, p.id, gen_random_uuid()), 'UB409');
  q := userbase_app_post_publish_reserve(p.id, q.publish_claim_token, 'skateuser', 'shared_default');
  assert q.publish_author = 'skateuser' and q.status = 'publishing';
  q := userbase_app_post_publish_reserve(p.id, q.publish_claim_token, 'skateuser', 'shared_default');
  assert q.status = 'publishing', 'same signer again is a no-op';
  -- transient failure -> back to approved, author kept
  q := userbase_app_post_publish_complete(p.id, q.publish_claim_token, false, 'rpc_timeout');
  assert q.status = 'approved' and q.publish_author = 'skateuser' and q.last_error_code = 'rpc_timeout';
  perform pg_temp.expect(format($q$select userbase_app_post_publish_complete(%L,%L,true)$q$, p.id, gen_random_uuid()), 'UB409');
  -- lease expiry: a reclaim takes over; the old token is dead
  select * into q from userbase_app_post_publish_claim(p.id,'w1');
  tok := q.publish_claim_token;
  update userbase_app_posts set publish_lease_until = now() - interval '1 second' where id = p.id;
  select * into q from userbase_app_post_publish_claim(null,'w2',60,5);
  assert q.id = p.id and q.publish_claim_token <> tok and q.publish_attempts = 3;
  perform pg_temp.expect(format($q$select userbase_app_post_publish_complete(%L,%L,true)$q$, p.id, tok), 'UB409');
  q := userbase_app_post_publish_complete(p.id, q.publish_claim_token, true);
  assert q.status = 'published' and q.published_at is not null;
  perform pg_temp.expect(format($q$update userbase_app_posts set publish_author='other', publish_signer_kind='own_key' where id=%L$q$, p.id), 'UB409');

  -- feed: published only, public fields only
  assert (select count(*) from userbase_app_feed('coletivoxv')) = 1;
  assert (select count(*) from userbase_app_feed('coletivoxv','instalacao','escultura-1')) = 1;
  assert (select count(*) from userbase_app_feed('coletivoxv','evento','abertura')) = 0;
  assert (select count(*) from userbase_app_feed('otherapp')) = 0;

  -- crosspost link once
  perform pg_temp.expect(format($q$select userbase_app_post_link_crosspost(%L,%L)$q$, p.id, '20000000-0000-0000-0000-000000000001'), 'UB404');
  insert into userbase_crosspost_queue (id, target, status) values ('20000000-0000-0000-0000-000000000001', 'instagram', 'pending_review'),
    ('20000000-0000-0000-0000-000000000002', 'instagram', 'pending_review');
  q := userbase_app_post_link_crosspost(p.id, '20000000-0000-0000-0000-000000000001');
  q := userbase_app_post_link_crosspost(p.id, '20000000-0000-0000-0000-000000000001');
  assert q.crosspost_queue_id = '20000000-0000-0000-0000-000000000001';
  perform pg_temp.expect(format($q$select userbase_app_post_link_crosspost(%L,%L)$q$, p.id, '20000000-0000-0000-0000-000000000002'), 'UB409');

  -- signer_changed: another author later -> failed, no requeue
  q := userbase_app_post_review(x1,'coletivoxv',(select id from userbase_app_posts where idempotency_key='k-00000011'),'approve');
  select * into q from userbase_app_post_publish_claim(q.id,'w1');
  q := userbase_app_post_publish_reserve(q.id, q.publish_claim_token, 'alice-own', 'own_key');
  q := userbase_app_post_publish_complete(q.id, q.publish_claim_token, false, 'rpc_timeout');
  select * into q from userbase_app_post_publish_claim(q.id,'w1');
  q := userbase_app_post_publish_reserve(q.id, q.publish_claim_token, 'skateuser', 'shared_default');
  assert q.status = 'failed' and q.last_error_code = 'signer_changed';
  perform pg_temp.expect(format($q$select userbase_app_post_publish_requeue(%L,'coletivoxv',%L)$q$, x1, q.id), 'UB409');

  -- out of attempts -> failed; moderator requeue -> approved; non-mod 403
  q := userbase_app_post_create(b,'coletivoxv','k-bob-0001',pg_temp.h('bob1'),'text',null,'bob','[]',null,null,true);
  q := userbase_app_post_review(x1,'coletivoxv',q.id,'approve');
  for n in 1..5 loop
    select * into q from userbase_app_post_publish_claim(q.id,'w1');
    q := userbase_app_post_publish_complete(q.id, q.publish_claim_token, false, 'broadcast_error');
  end loop;
  assert q.status = 'failed' and q.publish_attempts = 5;
  assert (select count(*) from userbase_app_post_publish_claim(q.id,'w1')) = 0, 'failed is not claimable';
  perform pg_temp.expect(format($q$select userbase_app_post_publish_requeue(%L,'coletivoxv',%L)$q$, b, q.id), 'UB403');
  q := userbase_app_post_publish_requeue(x1,'coletivoxv',q.id);
  assert q.status = 'approved' and q.publish_attempts = 0;
  -- non-retryable error fails at once
  select * into q from userbase_app_post_publish_claim(q.id,'w1');
  q := userbase_app_post_publish_complete(q.id, q.publish_claim_token, false, 'content_rejected', false);
  assert q.status = 'failed';
  perform pg_temp.expect(format($q$select userbase_app_post_publish_complete(%L,%L,false,'BAD CODE')$q$, q.id, gen_random_uuid()), 'UB409');

  -- lease expiry on the last attempt -> failed lease_expired
  q := userbase_app_post_create(b,'coletivoxv','k-bob-0002',pg_temp.h('bob2'),'text',null,'bob2','[]',null,null,true);
  q := userbase_app_post_review(x1,'coletivoxv',q.id,'approve');
  update userbase_app_posts set publish_max_attempts = 1 where id = q.id;
  select * into q from userbase_app_post_publish_claim(q.id,'w1');
  update userbase_app_posts set publish_lease_until = now() - interval '1 second' where id = q.id;
  assert (select count(*) from userbase_app_post_publish_claim(q.id,'w2')) = 0;
  assert (select status from userbase_app_posts where id = q.id) = 'failed';
  assert (select last_error_code from userbase_app_posts where id = q.id) = 'lease_expired';

  -- moderator's own post: auto-approved via the bound email only
  q := userbase_app_post_create(x1,'coletivoxv','k-xv-00001',pg_temp.h('xv'),'text',null,'mod post','[]',null,null,true);
  assert q.status = 'approved' and q.auto_approved and q.reviewed_by_hive_handle = 'xvlad';
  q := userbase_app_post_create(x2,'coletivoxv','k-xv-00002',pg_temp.h('xv2'),'text',null,'other email','[]',null,null,true);
  assert q.status = 'pending' and not q.auto_approved;

  -- revoked allowlist entry: no longer moderator
  update userbase_app_moderator_allowlist set revoked_at = now() where hive_handle = 'xvlad';
  assert (select moderator_handle from userbase_app_me(x1,'coletivoxv')) is null;
  update userbase_app_moderator_allowlist set revoked_at = null where hive_handle = 'xvlad';
  -- unbind
  assert userbase_app_moderator_unbind('coletivoxv','xvlad');
  assert (select moderator_handle from userbase_app_me(x1,'coletivoxv')) is null;

  -- rate limit: 20 per 24h
  for n in 1..20 loop
    perform userbase_app_post_create(m,'coletivoxv','k-mal-' || lpad(n::text, 4, '0'),pg_temp.h('m'||n),'text',null,'spam '||n,'[]',null,null,true);
  end loop;
  perform pg_temp.expect(format($q$select userbase_app_post_create(%L,'coletivoxv','k-mal-9999',%L,'text',null,'x','[]',null,null,true)$q$, m, pg_temp.h('m99')), 'UB429');

  -- re-bind after an unbind works with a fresh challenge
  select * into ch from userbase_app_moderator_challenge_create(x1,'coletivoxv','xvlad');
  mo := userbase_app_moderator_bind(x1,'coletivoxv',ch.challenge_id,'STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4');
  assert (select moderator_handle from userbase_app_me(x1,'coletivoxv')) = 'xvlad';
  assert (select count(*) from userbase_app_moderators where hive_handle = 'xvlad' and revoked_at is null) = 1;

  -- outbox: follow-ups written with 'published', claimed and retried on their own
  q := userbase_app_post_create(a,'coletivoxv','k-00000020',pg_temp.h('ob'),'text',null,'outbox','[]',null,null,true);
  q := userbase_app_post_review(x1,'coletivoxv',q.id,'approve');
  select * into q from userbase_app_post_publish_claim(q.id,'w1');
  q := userbase_app_post_publish_reserve(q.id, q.publish_claim_token, 'skateuser', 'shared_default');
  perform pg_temp.expect(format($q$select userbase_app_post_publish_complete(%L,%L,true,null,true,'{tweet}')$q$, q.id, q.publish_claim_token), 'UB422');
  q := userbase_app_post_publish_complete(q.id, q.publish_claim_token, true, null, true, '{soft_post,instagram_enqueue,soft_post}');
  assert (select count(*) from userbase_app_post_outbox where post_id = q.id) = 2;
  declare ob record; ob2 record; begin
    select * into ob from userbase_app_post_outbox_claim('soft_post','w1');
    assert ob.post_id = q.id and ob.publish_author = 'skateuser' and ob.attempts = 1;
    assert (select count(*) from userbase_app_post_outbox_claim('soft_post','w2')) = 0, 'leased';
    perform pg_temp.expect(format($q$select userbase_app_post_outbox_complete(%L,%L,true)$q$, ob.outbox_id, gen_random_uuid()), 'UB409');
    perform userbase_app_post_outbox_complete(ob.outbox_id, ob.claim_token, false, 'db_timeout');
    assert (select status from userbase_app_post_outbox where id = ob.outbox_id) = 'queued';
    update userbase_app_post_outbox set next_attempt_at = now() where id = ob.outbox_id;
    select * into ob2 from userbase_app_post_outbox_claim('soft_post','w1');
    perform userbase_app_post_outbox_complete(ob2.outbox_id, ob2.claim_token, true, null, '{"soft_post":"ok"}');
    assert (select status from userbase_app_post_outbox where id = ob.outbox_id) = 'done';
    assert (select status from userbase_app_posts where id = q.id) = 'published', 'outbox never touches the post';
    perform pg_temp.expect(format($q$select userbase_app_post_outbox_requeue(%L)$q$, ob.outbox_id), 'UB409');
  end;

  -- backoff never overflows: max_attempts 50, failures on attempts 27 and 50
  declare ob record; r public.userbase_app_post_outbox; begin
    update userbase_app_post_outbox set max_attempts = 50, attempts = 26, next_attempt_at = now(),
      status = 'queued' where post_id = q.id and kind = 'instagram_enqueue';
    select * into ob from userbase_app_post_outbox_claim('instagram_enqueue','w1');
    assert ob.attempts = 27;
    r := userbase_app_post_outbox_complete(ob.outbox_id, ob.claim_token, false, 'ig_down');
    assert r.status = 'queued', 'attempt 27 failure is a retry, not an overflow';
    assert r.next_attempt_at = now() + interval '3600 seconds', 'backoff capped at 3600s';
    update userbase_app_post_outbox set attempts = 49, next_attempt_at = now() where id = r.id;
    select * into ob from userbase_app_post_outbox_claim('instagram_enqueue','w1');
    assert ob.attempts = 50;
    r := userbase_app_post_outbox_complete(ob.outbox_id, ob.claim_token, false, 'ig_down');
    assert r.status = 'failed', 'attempt 50 of 50 is terminal';
    -- small attempt counts keep the short backoff
    update userbase_app_post_outbox set status = 'queued', attempts = 0, max_attempts = 50,
      next_attempt_at = now() where id = r.id;
    select * into ob from userbase_app_post_outbox_claim('instagram_enqueue','w1');
    r := userbase_app_post_outbox_complete(ob.outbox_id, ob.claim_token, false, 'ig_down');
    assert r.next_attempt_at = now() + interval '60 seconds', 'attempt 1 -> 60s';
  end;

  -- keyset cursor: equal timestamps never skip or repeat rows
  update userbase_app_posts set published_at = '2026-01-01T00:00:00Z'
    where status = 'published' and app = 'coletivoxv';
  declare seen uuid[] := '{}'; pg record; cur_at timestamptz; cur_id uuid; total int; got int; begin
    total := (select count(*) from userbase_app_posts where status = 'published' and app = 'coletivoxv');
    assert total >= 2, 'need ties';
    loop
      got := 0;
      for pg in select * from userbase_app_feed('coletivoxv', null, null, cur_at, cur_id, 1) loop
        got := got + 1;
        assert not pg.id = any(seen), 'row repeated';
        seen := seen || pg.id; cur_at := pg.published_at; cur_id := pg.id;
      end loop;
      exit when got = 0;
    end loop;
    assert cardinality(seen) = total, 'row skipped';
  end;
  assert (select count(*) from userbase_app_post_list_mine(a,'coletivoxv',null,null,100))
       = (select count(*) from userbase_app_posts where user_id = '00000000-0000-0000-0000-00000000000a');

  -- audit log is append-only and complete
  assert (select count(*) from userbase_app_post_events where post_id = p.id) >= 8;
  -- service_role has no UPDATE/DELETE on the log at all
  perform pg_temp.expect('update userbase_app_post_events set detail = null', '42501');
  perform pg_temp.expect('delete from userbase_app_post_events', '42501');
end $$;

reset role;

-- Second layer: even the table owner can't rewrite the log (trigger).
do $$ begin
  perform pg_temp.expect('update userbase_app_post_events set detail = null', 'UB409');
  perform pg_temp.expect('delete from userbase_app_post_events', 'UB409');
end $$;

-- No email anywhere in the new objects.
do $$ begin
  assert not exists (select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name in ('userbase_app_posts','userbase_app_post_events','userbase_app_moderators',
                         'userbase_app_moderator_challenges','userbase_app_moderator_allowlist')
      and column_name ilike '%email%');
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('userbase_app_feed','userbase_app_post_get',
      'userbase_app_post_queue','userbase_app_me')
      and array_to_string(p.proargnames, ',') ilike '%email%');
end $$;
SQL

echo "concurrency: two sessions claim the due queue at once, no post is claimed twice"
psql_run <<'SQL'
insert into userbase_users (id, handle) values ('00000000-0000-0000-0000-0000000000e1', 'eve');
insert into userbase_app_posts (app,user_id,idempotency_key,request_hash,kind,body,consent_publish_at,
  status,auto_approved,reviewed_at)
select 'coletivoxv','00000000-0000-0000-0000-0000000000e1','k-conc-'||g, encode(sha256(g::text::bytea),'hex'),
  'text','c'||g, now(),'approved',true,now()
from generate_series(1,10) g;
SQL
DUE=$(docker exec "$NAME" psql -U postgres -qAt -c "select count(*) from userbase_app_posts where status='approved' and publish_attempts < publish_max_attempts")
docker exec -i "$NAME" psql -U postgres -qAt -v ON_ERROR_STOP=1 > "$TMPD/c1" <<'SQL' &
set role service_role;
begin;
select id from userbase_app_post_publish_claim(null,'A',60,6);
select pg_sleep(2);
commit;
SQL
sleep 0.5
docker exec -i "$NAME" psql -U postgres -qAt -v ON_ERROR_STOP=1 > "$TMPD/c2" <<'SQL'
set role service_role;
select id from userbase_app_post_publish_claim(null,'B',60,6);
SQL
wait
A=$(grep -cE '^[0-9a-f-]{36}$' "$TMPD/c1" || true); B=$(grep -cE '^[0-9a-f-]{36}$' "$TMPD/c2" || true)
DUP=$(cat "$TMPD/c1" "$TMPD/c2" | grep -E '^[0-9a-f-]{36}$' | sort | uniq -d | wc -l | tr -d ' ')
rm -f "$TMPD/c1" "$TMPD/c2"
echo "  due=$DUE A=$A B=$B duplicates=$DUP"
[ "$DUP" = 0 ] && [ "$A" -ge 1 ] && [ "$B" -ge 1 ] && [ $((A + B)) -le "$DUE" ] || { echo "FAIL concurrency"; exit 1; }

echo "bind race: two accounts bind the same handle at once -> one wins, the other gets UB409 and nothing of its call stays"
psql_run <<'SQL'
insert into userbase_users (id, handle) values
  ('00000000-0000-0000-0000-0000000000f1', 'race-p'), ('00000000-0000-0000-0000-0000000000f2', 'race-q');
insert into userbase_auth_methods (id, user_id, type, identifier, verified_at) values
  ('10000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f1', 'email_magic', 'p@example.invalid', now()),
  ('10000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f2', 'email_magic', 'q@example.invalid', now());
set role service_role;
select count(*) from userbase_app_login('00000000-0000-0000-0000-0000000000f1','coletivoxv','p@example.invalid',encode(sha256('race-p'::bytea),'hex'),now()+interval '1 day','email_otp');
select count(*) from userbase_app_login('00000000-0000-0000-0000-0000000000f2','coletivoxv','q@example.invalid',encode(sha256('race-q'::bytea),'hex'),now()+interval '1 day','email_otp');
SQL
psql_run <<'SQL'
create table public.race_ids (who text primary key, challenge_id uuid);
grant all on public.race_ids to service_role;
set role service_role;
insert into race_ids select 'p', challenge_id from userbase_app_moderator_challenge_create(encode(sha256('race-p'::bytea),'hex'),'coletivoxv','wilbor');
insert into race_ids select 'q', challenge_id from userbase_app_moderator_challenge_create(encode(sha256('race-q'::bytea),'hex'),'coletivoxv','wilbor');
SQL
KEY=STM6LLegbAgLAy28EHrffBVuANFWcFgmqRMW13wBmTExqFE9SCkg4
docker exec -i "$NAME" psql -U postgres -qAt -v ON_ERROR_STOP=1 > "$TMPD/ra" 2>&1 <<SQL &
set role service_role;
begin;
select hive_handle from userbase_app_moderator_bind(encode(sha256('race-p'::bytea),'hex'),'coletivoxv',(select challenge_id from race_ids where who='p'),'$KEY');
select pg_sleep(2);
commit;
SQL
sleep 0.7
docker exec -i "$NAME" psql -U postgres -qAt -v VERBOSITY=verbose > "$TMPD/rb" 2>&1 <<SQL || true
set role service_role;
select hive_handle from userbase_app_moderator_bind(encode(sha256('race-q'::bytea),'hex'),'coletivoxv',(select challenge_id from race_ids where who='q'),'$KEY');
SQL
wait
grep -q '^wilbor$' "$TMPD/ra" || { echo "FAIL race: A did not bind"; cat "$TMPD/ra"; exit 1; }
grep -q 'UB409' "$TMPD/rb" || { echo "FAIL race: B did not get UB409"; cat "$TMPD/rb"; exit 1; }
psql_run <<'SQL'
do $$ begin
  assert (select count(*) from userbase_app_moderators where hive_handle = 'wilbor' and revoked_at is null) = 1;
  assert (select user_id from userbase_app_moderators where hive_handle = 'wilbor' and revoked_at is null)
         = '00000000-0000-0000-0000-0000000000f1', 'A owns the binding';
  assert (select used_at from userbase_app_moderator_challenges
          where id = (select challenge_id from race_ids where who = 'q')) is null,
         'loser challenge consumption rolled back';
  assert not exists (select 1 from userbase_app_moderators
                     where user_id = '00000000-0000-0000-0000-0000000000f2'), 'loser left no row';
end $$;
drop table public.race_ids;
SQL
echo "  race ok: winner bound, loser UB409, loser challenge still unused"

echo "privileges: anon/authenticated denied on every new table and RPC"
for role in anon authenticated; do
  for stmt in \
    "select * from userbase_app_posts" \
    "select * from userbase_app_post_events" \
    "select * from userbase_app_moderators" \
    "select * from userbase_app_moderator_challenges" \
    "select * from userbase_app_moderator_allowlist" \
    "select * from userbase_app_post_outbox" \
    "select * from userbase_app_feed('coletivoxv')" \
    "select * from userbase_app_me('x','coletivoxv')" \
    "select userbase_app_post_create('x','coletivoxv','k-anon-001','$(printf '%064d' 0)','text',null,'x','[]',null,null,true)" \
    "select * from userbase_app_post_publish_claim(null,'x')" \
    "select userbase_app_moderator_unbind('coletivoxv','xvlad')" \
    "select userbase_app__media_valid('text','[]')"; do
    if out=$(printf 'set role %s;\n%s;\n' "$role" "$stmt" | psql_run 2>&1); then
      echo "FAIL $role was allowed: $stmt"; exit 1
    fi
    echo "$out" | grep -q "permission denied" || { echo "FAIL $role unexpected error: $out"; exit 1; }
  done
done
psql_run <<'SQL'
do $$ begin
  assert (select bool_and(relrowsecurity and relforcerowsecurity) from pg_class
          where relname in ('userbase_app_posts','userbase_app_post_events','userbase_app_moderators',
                            'userbase_app_moderator_challenges','userbase_app_moderator_allowlist',
                            'userbase_app_post_outbox'));
  assert not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname like 'userbase_app%' and p.prosecdef),
         'all SECURITY INVOKER';
end $$;
SQL

echo "service_role: has each needed privilege (checked one at a time)"
psql_run <<'SQL'
do $$
declare t text; p text;
begin
  foreach t in array array['userbase_app_posts','userbase_app_moderators','userbase_app_moderator_challenges',
                           'userbase_app_moderator_allowlist','userbase_app_post_outbox'] loop
    foreach p in array array['select','insert','update'] loop
      assert has_table_privilege('service_role', 'public.' || t, p), t || ' ' || p;
    end loop;
  end loop;
  assert has_table_privilege('service_role', 'public.userbase_app_post_events', 'select');
  assert has_table_privilege('service_role', 'public.userbase_app_post_events', 'insert');
  foreach p in array array['update','delete','truncate'] loop
    assert not has_table_privilege('service_role', 'public.userbase_app_post_events', p), 'events ' || p;
  end loop;
end $$;
SQL

echo "service_role: no DELETE/TRUNCATE anywhere, no UPDATE on the audit log"
for stmt in \
  "update userbase_app_post_events set detail = 'x'" \
  "delete from userbase_app_post_events" \
  "truncate userbase_app_post_events" \
  "delete from userbase_app_posts" \
  "truncate userbase_app_posts" \
  "delete from userbase_app_moderators" \
  "delete from userbase_app_moderator_challenges" \
  "delete from userbase_app_moderator_allowlist" \
  "delete from userbase_app_post_outbox"; do
  if out=$(printf 'set role service_role;\n%s;\n' "$stmt" | psql_run 2>&1); then
    echo "FAIL service_role was allowed: $stmt"; exit 1
  fi
  echo "$out" | grep -q "permission denied" || { echo "FAIL service_role unexpected error: $out"; exit 1; }
done

echo "internal helpers: not executable by anon/authenticated/PUBLIC"
psql_run <<'SQL'
create role plain_user nologin;
SQL
for role in anon authenticated plain_user; do
  for stmt in \
    "select * from userbase_app__session('x','coletivoxv')" \
    "select userbase_app__moderator_handle(gen_random_uuid(), gen_random_uuid(), 'coletivoxv')" \
    "select userbase_app__body_hash('text',null,'x','[]',null,null)" \
    "select * from userbase_app_post_outbox_claim('soft_post','x')"; do
    if out=$(printf 'set role %s;\n%s;\n' "$role" "$stmt" | psql_run 2>&1); then
      echo "FAIL $role was allowed: $stmt"; exit 1
    fi
    echo "$out" | grep -q "permission denied" || { echo "FAIL $role unexpected error: $out"; exit 1; }
  done
done

echo "rollback twice (idempotent), 0036 intact, then re-apply"
psql_run < "$MIG/0038_userbase_app_posts.rollback.sql"
psql_run < "$MIG/0038_userbase_app_posts.rollback.sql" 2>/dev/null
psql_run <<'SQL'
do $$ begin
  assert to_regclass('public.userbase_app_posts') is null;
  assert to_regclass('public.userbase_app_moderators') is null;
  assert to_regclass('public.userbase_app_sessions') is not null, '0036 untouched';
  assert to_regprocedure('public.userbase_app_session_resolve(text,text)') is not null;
  assert not exists (select 1 from pg_proc where proname like 'userbase_app\_\_%');
  assert to_regclass('public.userbase_app_post_outbox') is null;
end $$;
SQL
psql_run < "$MIG/0038_userbase_app_posts.sql"

echo "PASS 0038 ($IMAGE)"
