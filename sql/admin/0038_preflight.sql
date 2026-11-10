-- 0038_preflight.sql — READ ONLY. Run BEFORE applying
-- sql/migrations/0038_userbase_app_posts.sql. Every row must be ok = true.
-- Catalog metadata only; no user data is read.
with checks(name, ok) as (values
  ('0036 applied: userbase_app_sessions', to_regclass('public.userbase_app_sessions') is not null),
  ('0036 applied: userbase_app_memberships', to_regclass('public.userbase_app_memberships') is not null),
  ('0036 RPC userbase_app_session_resolve(text,text)',
     to_regprocedure('public.userbase_app_session_resolve(text,text)') is not null),
  ('0036 app_sessions.auth_method_id', exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='userbase_app_sessions' and column_name='auth_method_id')),
  ('0029 applied: userbase_crosspost_queue (FK target)', to_regclass('public.userbase_crosspost_queue') is not null),
  ('userbase_users(id,handle,display_name,avatar_url,status)',
     (select count(*) from information_schema.columns where table_schema='public' and table_name='userbase_users'
      and column_name in ('id','handle','display_name','avatar_url','status')) = 5),
  ('userbase_auth_methods(id)', exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='userbase_auth_methods' and column_name='id')),
  ('gen_random_uuid() + sha256() available',
     to_regprocedure('gen_random_uuid()') is not null and to_regprocedure('sha256(bytea)') is not null),
  ('roles service_role/anon/authenticated',
     (select count(*) from pg_roles where rolname in ('service_role','anon','authenticated')) = 3),
  ('service_role bypasses RLS', (select rolbypassrls from pg_roles where rolname = 'service_role')),
  ('service_role can read users/auth_methods/app_sessions/memberships (RPCs run as caller)',
     has_table_privilege('service_role','public.userbase_users','select')
     and has_table_privilege('service_role','public.userbase_auth_methods','select')
     and has_table_privilege('service_role','public.userbase_app_sessions','select,update')
     and has_table_privilege('service_role','public.userbase_app_memberships','select')),
  ('absent: 0038 tables', to_regclass('public.userbase_app_posts') is null
     and to_regclass('public.userbase_app_post_events') is null
     and to_regclass('public.userbase_app_post_outbox') is null
     and to_regclass('public.userbase_app_moderators') is null
     and to_regclass('public.userbase_app_moderator_challenges') is null
     and to_regclass('public.userbase_app_moderator_allowlist') is null),
  ('absent: 0038 functions', not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and (p.proname like 'userbase\_app\_\_%' or p.proname like 'userbase\_app\_post%'
       or p.proname like 'userbase\_app\_moderator%' or p.proname in ('userbase_app_me','userbase_app_feed'))))
)
select name, ok from checks order by ok, name;
