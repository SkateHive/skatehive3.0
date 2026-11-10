-- Keep partner and first-party codes independent for the same email.
-- Empty app_id denotes first-party; existing rows and legacy inserts keep
-- that meaning. Hash binding remains an additional API-side scope check.
-- Apply before deploying the API that filters OTP reads by app_id.
begin;
alter table public.userbase_email_otps
  add column if not exists app_id text not null default '';
create index if not exists idx_userbase_email_otps_app_email_created
  on public.userbase_email_otps (app_id, email, created_at desc);
commit;
