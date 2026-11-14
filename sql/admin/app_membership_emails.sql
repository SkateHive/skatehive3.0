-- app_membership_emails.sql
-- Admin only: run in the Supabase SQL editor (or any service_role connection).
-- There is no endpoint for this on purpose. The result holds people's emails:
-- don't paste it into chats or tickets, and don't feed it to a mailing list.
-- Signing in to an app is not marketing consent.
--
-- Needs migration 0036. Change the app id in the first CTE for other apps.
--
-- Which email is shown, and why:
-- A Skatehive account can have more than one email auth method (for example
-- after an account merge), so joining memberships to "the user's email" could
-- show an address the person never used on the app. Each login stores the
-- auth method it was verified through: userbase_app_login() only accepts an
-- email that is an email_magic method of that user and that the API just
-- verified (OTP or signup token). These queries follow that pointer and never
-- look up other emails on the account:
--   * query 1 — membership.last_auth_method_id: email used on the latest login.
--     Survives session cleanup.
--   * query 2 — app_sessions.auth_method_id: email per login, but only for
--     sessions still kept (cleanup drops expired ones, and revoked ones after
--     7 days).
-- "email unavailable" means the person later removed that email from their
-- account (the pointer was cleared, nothing was copied).

-- 1. Everyone who signed in to the app, with the email they used last time.
with params as (select 'coletivoxv'::text as app)
select
  m.user_id,
  u.handle,
  u.display_name,
  coalesce(am.identifier, '(email unavailable)') as verified_email,
  am.verified_at as email_verified_at,
  m.status as membership_status,
  u.status as account_status,
  m.first_login_at,
  m.last_login_at,
  m.login_count
from public.userbase_app_memberships m
join params p on p.app = m.app
join public.userbase_users u on u.id = m.user_id
left join public.userbase_auth_methods am
  on am.id = m.last_auth_method_id
 and am.user_id = m.user_id          -- guard: never show another account's email
 and am.type = 'email_magic'
order by m.last_login_at desc;

-- 2. Login history (sessions still retained), with the email each login used.
with params as (select 'coletivoxv'::text as app)
select
  s.created_at as logged_in_at,
  s.user_id,
  u.handle,
  am.identifier as verified_email,
  s.method,
  s.expires_at,
  s.revoked_at
from public.userbase_app_sessions s
join params p on p.app = s.app
join public.userbase_users u on u.id = s.user_id
join public.userbase_auth_methods am
  on am.id = s.auth_method_id
 and am.user_id = s.user_id
 and am.type = 'email_magic'
order by s.created_at desc;

-- 3. Totals.
with params as (select 'coletivoxv'::text as app)
select
  count(*) as members,
  count(*) filter (where m.status = 'active') as active_members,
  count(*) filter (where m.last_login_at > now() - interval '30 days') as seen_last_30_days
from public.userbase_app_memberships m
join params p on p.app = m.app;
