#!/usr/bin/env bash
# Local test for sql/migrations/0044_userbase_whatsapp.sql. Docker only; never
# touches Supabase. Usage: bash scripts/test-0044-whatsapp.sh
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ub0044-$$"
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=x postgres:16-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 0.5; done
sleep 1
psql() { docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U postgres -qAt "$@"; }

psql <<'SQL'
create role anon; create role authenticated; create role service_role bypassrls;
-- Emulate Supabase default privileges: new tables are fully granted to the API roles.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
create table public.userbase_users (id uuid primary key default gen_random_uuid());
insert into public.userbase_users (id) values
  ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
SQL
psql < sql/migrations/0044_userbase_whatsapp.sql
psql < sql/migrations/0044_userbase_whatsapp.sql   # idempotent

H() { printf '%064d' "$1"; }
A=00000000-0000-0000-0000-00000000000a
fail() { echo "FAIL: $*"; exit 1; }
# expect_err "<sql>" "<message>": the statement must fail with that message.
expect_err() { local out; out=$(psql -c "$1" 2>&1 || true); grep -q "$2" <<<"$out"; }

# --- link confirm -----------------------------------------------------------
psql -c "insert into userbase_whatsapp_link_codes values ('$(H 1)','$A',now(),now()+interval '10 min',null)"
[ "$(psql -c "select userbase_whatsapp_link_confirm('$(H 1)','$(H 9)')")" = "$A" ] || fail "confirm"
expect_err "select userbase_whatsapp_link_confirm('$(H 1)','$(H 9)')" "code expired or used" || fail "code reuse"
psql -c "insert into userbase_whatsapp_link_codes values ('$(H 2)','$A',now(),now()-interval '1 min',null)"
expect_err "select userbase_whatsapp_link_confirm('$(H 2)','$(H 9)')" "code expired or used" || fail "expired code"
psql -c "insert into userbase_whatsapp_link_codes values ('$(H 3)','$A',now(),now()+interval '10 min',null)"
psql -c "select userbase_whatsapp_link_confirm('$(H 3)','$(H 8)')" >/dev/null
[ "$(psql -c "select count(*) from userbase_whatsapp_links where user_id='$A'")" = 1 ] || fail "relink keeps one phone per user"
[ "$(psql -c "select phone_hash from userbase_whatsapp_links where user_id='$A'")" = "$(H 8)" ] || fail "relink replaces phone"
echo "ok link confirm"

# --- reserve / settle -------------------------------------------------------
for i in 1 2 3 4; do psql -c "select userbase_whatsapp_snap_reserve('$A','skateuser','wa-$i',5)" >/dev/null; done
# Concurrency: 8 parallel reservations at count 4 -> exactly one wins.
for i in $(seq 10 17); do
  (psql -c "select userbase_whatsapp_snap_reserve('$A','skateuser','wa-$i',5)" >/dev/null 2>&1 && echo won || echo lost) &
done > /tmp/ub0044-$$.out; wait
[ "$(grep -c won /tmp/ub0044-$$.out)" = 1 ] || fail "concurrent reserve allowed $(grep -c won /tmp/ub0044-$$.out) winners"
rm -f /tmp/ub0044-$$.out
expect_err "select userbase_whatsapp_snap_reserve('$A','skateuser','wa-99',5)" "daily limit" || fail "cap"
echo "ok cap holds under concurrency"

# Releasing a proven-failed broadcast frees a slot; published stays charged.
ID=$(psql -c "select id from userbase_whatsapp_posts where permlink='wa-1'")
[ "$(psql -c "select userbase_whatsapp_snap_settle($ID,'failed')")" = t ] || fail "settle failed"
[ "$(psql -c "select userbase_whatsapp_snap_settle($ID,'published')")" = f ] || fail "settle is one-way"
psql -c "select userbase_whatsapp_snap_reserve('$A','skateuser','wa-50',5)" >/dev/null || fail "released slot reusable"
expect_err "select userbase_whatsapp_snap_reserve('$A','skateuser','wa-51',5)" "daily limit" || fail "cap after release"
# Yesterday's rows do not count.
psql -c "update userbase_whatsapp_posts set created_at = now() - interval '1 day' where user_id='$A'"
psql -c "select userbase_whatsapp_snap_reserve('$A','skateuser','wa-60',5)" >/dev/null || fail "new day"
expect_err "select userbase_whatsapp_snap_reserve('$A','BAD','wa-61',5)" "invalid input" || fail "author validation"
echo "ok settle + day window + validation"

# --- NULL arguments are UB422, never a constraint error ------------------------
expect_err "select userbase_whatsapp_link_confirm(null,'$(H 9)')" "invalid input" || fail "null code"
expect_err "select userbase_whatsapp_link_confirm('$(H 1)',null)" "invalid input" || fail "null phone"
expect_err "select userbase_whatsapp_snap_reserve('$A',null,'wa-70',5)" "invalid input" || fail "null author"
expect_err "select userbase_whatsapp_snap_reserve('$A','skateuser',null,5)" "invalid input" || fail "null permlink"
expect_err "select userbase_whatsapp_snap_settle(null,'failed')" "invalid input" || fail "null id"
expect_err "select userbase_whatsapp_snap_settle(1,null)" "invalid input" || fail "null status"
for st in "select userbase_whatsapp_link_confirm(null,'$(H 9)')" "select userbase_whatsapp_snap_settle(1,null)"; do
  out=$(psql -c "$st" 2>&1 || true); grep -q "UB422\|invalid input" <<<"$out" || fail "sqlstate $st"
done
echo "ok null validation"

# --- privileges ---------------------------------------------------------------
# service_role does exactly what the API does directly, and nothing more.
sr() { psql -c "set role service_role; $1"; }
sr "insert into userbase_whatsapp_link_codes (code_hash,user_id,expires_at) values ('$(H 5)','$A',now()+interval '1 min')" >/dev/null || fail "service_role insert code"
sr "select count(*) from userbase_whatsapp_links" >/dev/null || fail "service_role select links"
sr "delete from userbase_whatsapp_links where phone_hash='$(H 7)'" >/dev/null || fail "service_role delete links"
sr "select userbase_whatsapp_snap_reserve('$A','skateuser','wa-80',99)" >/dev/null || fail "service_role reserve"
sr "select userbase_whatsapp_link_confirm('$(H 5)','$(H 6)')" >/dev/null || fail "service_role confirm"
expect_err "set role service_role; select * from userbase_whatsapp_link_codes" "permission denied" || fail "service_role read codes"
expect_err "set role service_role; update userbase_whatsapp_links set linked_at=now()" "permission denied" || fail "service_role update links"
expect_err "set role service_role; insert into userbase_whatsapp_links values ('$(H 4)','$A',now())" "permission denied" || fail "service_role insert links"
expect_err "set role service_role; select * from userbase_whatsapp_posts" "permission denied" || fail "service_role read posts"
expect_err "set role service_role; update userbase_whatsapp_posts set status='failed'" "permission denied" || fail "service_role update posts"
[ "$(psql -c "select has_function_privilege('anon','userbase_whatsapp_snap_reserve(uuid,text,text,integer)','execute')")" = f ] || fail "anon can reserve"
[ "$(psql -c "select has_table_privilege('authenticated','userbase_whatsapp_links','select')")" = f ] || fail "authenticated can read links"
echo "ok privileges"

psql < sql/migrations/0044_userbase_whatsapp.rollback.sql
[ "$(psql -c "select count(*) from pg_tables where tablename like 'userbase_whatsapp%'")" = 0 ] || fail "rollback"
echo "ok rollback"
echo "ALL PASS"
