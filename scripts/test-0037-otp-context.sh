#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
container="otp-context-test-$$"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$container" -e POSTGRES_PASSWORD=test postgres:17-alpine >/dev/null
for i in {1..30}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
sql() { docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q; }
sql < "$root/sql/migrations/0024_userbase_email_otps.sql"
sql <<'SQL'
insert into userbase_email_otps(email,code_hash,expires_at)
values ('same@example.invalid','legacy',now()+interval '10min');
SQL
sql < "$root/sql/migrations/0037_userbase_otp_app_context.sql"
sql < "$root/sql/migrations/0037_userbase_otp_app_context.sql"
sql <<'SQL'
insert into userbase_email_otps(email,app_id,code_hash,expires_at)
values ('same@example.invalid','coletivoxv','partner',now()+interval '10min');
do $$ begin
  assert (select app_id='' from userbase_email_otps where code_hash='legacy');
  assert (select count(*)=1 from userbase_email_otps where email='same@example.invalid' and app_id='');
  assert (select count(*)=1 from userbase_email_otps where email='same@example.invalid' and app_id='coletivoxv');
  assert (select count(*)=0 from userbase_email_otps where email='same@example.invalid' and app_id='otherapp');
end $$;
SQL
sql < "$root/sql/migrations/0037_userbase_otp_app_context.rollback.sql"
sql <<'SQL'
do $$ begin
  assert (select count(*)=1 from userbase_email_otps);
  assert (select code_hash='legacy' from userbase_email_otps);
end $$;
SQL
sql < "$root/sql/migrations/0037_userbase_otp_app_context.sql"
echo 'PASS: existing rows, independent app contexts, idempotent apply and rollback'
