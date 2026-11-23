#!/usr/bin/env bash
# Local test for sql/migrations/0045_savings_jars_usdc.sql. Docker only; never
# touches Supabase. Usage: bash scripts/test-0045-savings-jars-usdc.sh
set -euo pipefail
cd "$(dirname "$0")/.."
NAME="ub0045-$$"
docker run -d --rm --name "$NAME" -e POSTGRES_PASSWORD=x postgres:16-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
for _ in $(seq 1 60); do docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 0.5; done
sleep 1
psql() { docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U postgres -qAt "$@"; }
# Run SQL as the Supabase service role (auth.jwt() ->> 'role' = 'service_role').
svc() { psql -c "set request.jwt.claims = '{\"role\":\"service_role\"}'; $1"; }

psql <<'SQL'
create role anon; create role authenticated; create role service_role bypassrls;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
-- Minimal Supabase auth.jwt() emulation.
create schema auth;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;
SQL
for m in 0025_userbase_savings_jars 0025_userbase_savings_jars_rls 0026_userbase_savings_jar_events \
         0027_userbase_cofrinhos_used_challenges 0028_cofrinhos_allocate_rpc; do
  psql < "sql/migrations/$m.sql"
done

# An HBD jar created before 0045, with history, to check nothing breaks.
psql -c "insert into userbase_savings_jars (id, hive_account, name, allocated_hbd) values ('00000000-0000-0000-0000-0000000000a1','skater','Deck',5)"
psql -c "insert into userbase_savings_jar_events (jar_id, hive_account, type, amount_hbd) values ('00000000-0000-0000-0000-0000000000a1','skater','fund',5)"

psql < sql/migrations/0045_savings_jars_usdc.sql
psql < sql/migrations/0045_savings_jars_usdc.sql   # idempotent

fail() { echo "FAIL: $*"; exit 1; }
expect_err() { local out; out=$(psql -c "$1" 2>&1 || true); grep -q "$2" <<<"$out"; }
svc_err() { local out; out=$(svc "$1" 2>&1 || true); grep -q "$2" <<<"$out"; }
W=0x00000000000000000000000000000000000000aa
W2=0x00000000000000000000000000000000000000bb

# --- existing data ------------------------------------------------------------
[ "$(psql -c "select currency || ' ' || owner_key from userbase_savings_jars where name='Deck'")" = "HBD hive:skater" ] || fail "old jar backfilled as HBD"
[ "$(psql -c "select owner_key from userbase_savings_jar_events limit 1")" = "hive:skater" ] || fail "old event owner_key"
svc "select cofrinhos_allocate('skater','00000000-0000-0000-0000-0000000000a1',1,100,true)" >/dev/null || fail "old RPC still works"
echo "ok existing HBD jars untouched, old RPC still works"

# --- owner / currency rules -----------------------------------------------------
psql -c "insert into userbase_savings_jars (id, evm_address, currency, name) values ('00000000-0000-0000-0000-0000000000b1','$W','USDC','Trip')"
[ "$(psql -c "select owner_key from userbase_savings_jars where name='Trip'")" = "evm:$W" ] || fail "usdc owner_key"
expect_err "insert into userbase_savings_jars (evm_address, currency, name) values ('$W','HBD','x')" "owner_currency" || fail "evm owner with HBD"
expect_err "insert into userbase_savings_jars (hive_account, currency, name) values ('skater','USDC','x')" "owner_currency" || fail "hive owner with USDC"
expect_err "insert into userbase_savings_jars (hive_account, evm_address, currency, name) values ('skater','$W','USDC','x')" "owner_currency" || fail "two owners"
expect_err "insert into userbase_savings_jars (currency, name) values ('USDC','x')" "owner_currency" || fail "no owner"
expect_err "insert into userbase_savings_jars (evm_address, currency, name) values ('0xABC','USDC','x')" "evm_address_format" || fail "bad address"
expect_err "insert into userbase_savings_jars (evm_address, currency, name) values ('0x00000000000000000000000000000000000000AA','USDC','x')" "evm_address_format" || fail "uppercase address"
expect_err "insert into userbase_savings_jars (hive_account, currency, name) values ('skater','EUR','x')" "owner_currency" || fail "unknown currency"
expect_err "insert into userbase_savings_jar_events (jar_id, type) values ('00000000-0000-0000-0000-0000000000b1','create')" "one_owner" || fail "event without owner"
expect_err "insert into userbase_cofrinhos_used_challenges (nonce, expires_at) values ('n1', now())" "one_owner" || fail "challenge without owner"
psql -c "insert into userbase_cofrinhos_used_challenges (nonce, evm_address, expires_at) values ('n2','$W', now())"
expect_err "insert into userbase_cofrinhos_used_challenges (nonce, evm_address, expires_at) values ('n2','$W', now())" "duplicate key" || fail "nonce single use"
echo "ok owner/currency constraints"

# --- allocate_owner -------------------------------------------------------------
B=00000000-0000-0000-0000-0000000000b1
[ "$(svc "select allocated_hbd from cofrinhos_allocate_owner('evm:$W','$B',10,10.5,true)")" = "10.000" ] || fail "fund usdc jar"
svc_err "select cofrinhos_allocate_owner('evm:$W','$B',1,10.5,true)" "Not enough unallocated" || fail "invariant"
svc_err "select cofrinhos_allocate_owner('evm:$W2','$B',1,100,true)" "Jar not found" || fail "other wallet can't touch jar"
svc_err "select cofrinhos_allocate_owner('hive:skater','$B',1,100,true)" "Jar not found" || fail "hive owner can't touch usdc jar"
svc_err "select cofrinhos_allocate_owner('evm:$W','$B',-11,0,false)" "Cannot remove more" || fail "overdraw"
[ "$(svc "select allocated_hbd from cofrinhos_allocate_owner('evm:$W','$B',-4,0,false)")" = "6.000" ] || fail "withdraw"
svc_err "select cofrinhos_allocate_owner(null,'$B',1,10,true)" "Invalid input" || fail "null owner"
# HBD savings don't count toward USDC and vice versa: hive jar at 6 HBD, usdc jar can still use its own 10.5.
[ "$(svc "select allocated_hbd from cofrinhos_allocate_owner('evm:$W','$B',4.5,10.5,true)")" = "10.500" ] || fail "fill to the cent"
echo "ok allocate_owner: invariant, ownership, overdraw, null input"

# Concurrency: 6 parallel +1 allocations with room for exactly 2 -> exactly 2 win.
psql -c "insert into userbase_savings_jars (id, evm_address, currency, name) values ('00000000-0000-0000-0000-0000000000b2','$W2','USDC','Shoes')"
for _ in $(seq 1 6); do
  (svc "select cofrinhos_allocate_owner('evm:$W2','00000000-0000-0000-0000-0000000000b2',1,2,true)" >/dev/null 2>&1 && echo won || echo lost) &
done > /tmp/ub0045-$$.out; wait
[ "$(grep -c won /tmp/ub0045-$$.out)" = 2 ] || fail "concurrent allocate allowed $(grep -c won /tmp/ub0045-$$.out) winners"
rm -f /tmp/ub0045-$$.out
echo "ok invariant holds under concurrency"

# --- privileges -----------------------------------------------------------------
for r in anon authenticated; do
  out=$(psql -c "set role $r; select cofrinhos_allocate_owner('evm:$W','$B',1,100,true)" 2>&1 || true)
  grep -q "permission denied" <<<"$out" || fail "$r can execute allocate_owner"
done
out=$(psql -c "set role service_role; select cofrinhos_allocate_owner('evm:$W','$B',1,100,true)" 2>&1 || true)
grep -q "Unauthorized" <<<"$out" || fail "service_role grant without jwt role must still be Unauthorized"
echo "ok privileges"

# --- rollback -------------------------------------------------------------------
psql < sql/migrations/0045_savings_jars_usdc.rollback.sql
[ "$(psql -c "select count(*) from userbase_savings_jars")" = 1 ] || fail "rollback keeps HBD jars only"
[ "$(psql -c "select count(*) from information_schema.columns where table_name='userbase_savings_jars' and column_name in ('currency','evm_address','owner_key')")" = 0 ] || fail "rollback drops columns"
[ "$(psql -c "select is_nullable from information_schema.columns where table_name='userbase_savings_jars' and column_name='hive_account'")" = NO ] || fail "rollback restores not null"
svc "select cofrinhos_allocate('skater','00000000-0000-0000-0000-0000000000a1',1,100,true)" >/dev/null || fail "old RPC after rollback"
psql < sql/migrations/0045_savings_jars_usdc.sql   # re-apply after rollback
echo "ok rollback + re-apply"

echo "ALL OK 0045"
