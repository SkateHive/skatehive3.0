-- Email OTP storage for mobile email login (served by api.skatehive.app).
--
-- This is the CANONICAL source for the userbase_email_otps table. It lives in
-- this folder with the rest of the userbase schema (single source of truth);
-- the table is consumed by services/skatehive-api (lib/userbase/otp.ts) against
-- the same userbase Supabase project as userbase_users / userbase_sessions.
--
-- Codes are stored hashed (sha256 of "<email>:<code>") with a short TTL and an
-- attempt cap, so they can't be brute-forced. Single-use via consumed_at.

create table if not exists public.userbase_email_otps (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  code_hash   text not null,
  attempts    integer not null default 0,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Fast "newest live OTP for this email" lookup.
create index if not exists idx_userbase_email_otps_email_created
  on public.userbase_email_otps (email, created_at desc);

-- Optional hygiene (run periodically): drop stale rows.
-- delete from public.userbase_email_otps where created_at < now() - interval '1 day';
