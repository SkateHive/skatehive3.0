-- 0036_postflight.sql — READ ONLY. Run in the Supabase SQL editor right AFTER
-- applying 0036. Every row must say ok = true. Catalog metadata only.
-- Do not call the RPCs in production to test them: login writes rows.

with
fns(sig) as (values
  ('public.userbase_app_login(uuid,text,text,text,timestamp with time zone,text,text)'),
  ('public.userbase_app_session_resolve(text,text)'),
  ('public.userbase_app_session_revoke(text,text)'),
  ('public.userbase_app_sessions_cleanup()')),
tbls(t) as (values ('public.userbase_app_memberships'), ('public.userbase_app_sessions')),
checks(name, ok) as (
  select 'table ' || t || ' exists', to_regclass(t) is not null from tbls
  union all
  select 'RLS enabled+forced on ' || t,
    coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass(t)), false)
  from tbls
  union all
  select 'service_role full DML on ' || t,
    to_regclass(t) is not null
    and has_table_privilege('service_role', t, 'select') and has_table_privilege('service_role', t, 'insert')
    and has_table_privilege('service_role', t, 'update') and has_table_privilege('service_role', t, 'delete')
  from tbls
  union all
  select 'no client access on ' || t,
    to_regclass(t) is not null
    and not has_table_privilege('anon', t, 'select') and not has_table_privilege('anon', t, 'insert')
    and not has_table_privilege('authenticated', t, 'select') and not has_table_privilege('authenticated', t, 'insert')
  from tbls
  union all
  select 'function ' || sig || ' exists', to_regprocedure(sig) is not null from fns
  union all
  select 'execute only service_role: ' || sig,
    to_regprocedure(sig) is not null
    and has_function_privilege('service_role', sig, 'execute')
    and not has_function_privilege('anon', sig, 'execute')
    and not has_function_privilege('authenticated', sig, 'execute')
  from fns
  union all
  select 'functions are SECURITY INVOKER',
    not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and p.proname in ('userbase_app_login','userbase_app_session_resolve',
                          'userbase_app_session_revoke','userbase_app_sessions_cleanup'))
  union all
  select 'token_hash unique', exists (select 1 from pg_constraint
    where conname = 'userbase_app_sessions_token_hash_uniq' and contype = 'u')
  union all
  select 'userbase_sessions has no app column', not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='userbase_sessions' and column_name='app')

)
select name, ok from checks order by ok, name;

-- PostgREST caches the schema: if the API gets "function not found" right
-- after applying, run:  notify pgrst, 'reload schema';
