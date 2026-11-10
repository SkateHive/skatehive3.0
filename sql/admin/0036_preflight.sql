-- 0036_preflight.sql — READ ONLY. Run in the Supabase SQL editor BEFORE
-- applying sql/migrations/0036_userbase_app_memberships.sql.
-- Every row must say ok = true. Reads only catalog metadata: no user data.

with checks(name, ok) as (
  values
  -- Dependencies 0036 builds on.
  ('table userbase_users',         to_regclass('public.userbase_users') is not null),
  ('table userbase_auth_methods',  to_regclass('public.userbase_auth_methods') is not null),
  ('table userbase_sessions (untouched by 0036)', to_regclass('public.userbase_sessions') is not null),
  ('column userbase_users.status', exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='userbase_users' and column_name='status')),
  ('columns userbase_auth_methods id/user_id/type/identifier/last_used_at',
     (select count(*) from information_schema.columns
      where table_schema='public' and table_name='userbase_auth_methods'
        and column_name in ('id','user_id','type','identifier','last_used_at')) = 5),
  ('gen_random_uuid() available',  to_regprocedure('gen_random_uuid()') is not null),
  ('roles service_role/anon/authenticated',
     (select count(*) from pg_roles where rolname in ('service_role','anon','authenticated')) = 3),
  ('service_role bypasses RLS',    (select rolbypassrls from pg_roles where rolname = 'service_role')),
  ('service_role can read users / read+update auth_methods (RPCs run as caller)',
     has_table_privilege('service_role','public.userbase_users','select')
     and has_table_privilege('service_role','public.userbase_auth_methods','select')
     and has_table_privilege('service_role','public.userbase_auth_methods','update')),
  -- 0036 not applied yet (if any of these is false, 0036 or a draft is already there: stop and compare).
  ('absent userbase_app_memberships', to_regclass('public.userbase_app_memberships') is null),
  ('absent userbase_app_sessions',    to_regclass('public.userbase_app_sessions') is null),
  ('absent draft userbase_app_logins', to_regclass('public.userbase_app_logins') is null),
  ('absent draft userbase_sessions.app', not exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='userbase_sessions' and column_name='app')),
  ('absent 0036 functions', not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('userbase_app_login','userbase_app_session_resolve',
       'userbase_app_session_revoke','userbase_app_sessions_cleanup','userbase_record_app_login')))
)
select name, ok from checks order by ok, name;
