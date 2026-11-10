-- Rollback for 0036_userbase_app_memberships.sql.
-- Deploy an API that no longer issues or resolves app sessions BEFORE running
-- this. App sessions live in their own table, so dropping it simply ends every
-- partner-app login — no app token can turn into a Skatehive session, and
-- userbase_sessions is not touched. Drops membership history for good; export
-- it first if it is needed. Safe to run more than once.

begin;

drop function if exists public.userbase_app_sessions_cleanup();
drop function if exists public.userbase_app_session_revoke(text, text);
drop function if exists public.userbase_app_session_resolve(text, text);
drop function if exists public.userbase_app_login(uuid, text, text, text, timestamptz, text, text);
drop table if exists public.userbase_app_sessions;
drop table if exists public.userbase_app_memberships;

commit;
