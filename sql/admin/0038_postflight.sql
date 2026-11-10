-- 0038_postflight.sql — READ ONLY. Run right AFTER applying 0038. Every row
-- must be ok = true. Catalog metadata + the moderator allowlist (public Hive
-- handles); no user data. Do not call the RPCs in production to test them.
-- If the API gets "function not found": notify pgrst, 'reload schema';
with
tbls(t) as (values ('public.userbase_app_moderator_allowlist'), ('public.userbase_app_moderator_challenges'),
  ('public.userbase_app_moderators'), ('public.userbase_app_posts'), ('public.userbase_app_post_events'),
  ('public.userbase_app_post_outbox')),
fns as (select p.oid::regprocedure::text as sig, p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and (p.proname like 'userbase\_app\_\_%' or p.proname like 'userbase\_app\_post%'
    or p.proname like 'userbase\_app\_moderator%' or p.proname in ('userbase_app_me','userbase_app_feed'))),
checks(name, ok) as (
  select 'table ' || t, to_regclass(t) is not null from tbls
  union all select 'RLS enabled+forced ' || t,
    coalesce((select relrowsecurity and relforcerowsecurity from pg_class where oid = to_regclass(t)), false) from tbls
  union all select 'no client access ' || t, to_regclass(t) is not null
    and not has_table_privilege('anon', t, 'select,insert,update,delete')
    and not has_table_privilege('authenticated', t, 'select,insert,update,delete') from tbls
  union all select 'service_role has no DELETE/TRUNCATE ' || t, to_regclass(t) is not null
    and not has_table_privilege('service_role', t, 'delete,truncate') from tbls
  union all select 'event log: service_role select+insert only',
    has_table_privilege('service_role','public.userbase_app_post_events','select,insert')
    and not has_table_privilege('service_role','public.userbase_app_post_events','update,delete,truncate')
  union all select 'function count = 26', (select count(*) = 26 from fns)
  union all select 'functions SECURITY INVOKER', not exists (select 1 from fns where prosecdef)
  union all select 'functions execute only service_role', not exists (select 1 from fns
    where not has_function_privilege('service_role', sig, 'execute')
       or has_function_privilege('anon', sig, 'execute')
       or has_function_privilege('authenticated', sig, 'execute'))
  union all select 'triggers: posts guard + events append-only',
    (select count(*) = 2 from pg_trigger where not tgisinternal
     and tgname in ('userbase_app_posts_guard', 'userbase_app_post_events_append_only'))
  union all select 'allowlist: xvlad,wilbor active; pharraxv revoked',
    (select count(*) = 2 from public.userbase_app_moderator_allowlist
     where app = 'coletivoxv' and hive_handle in ('xvlad','wilbor') and revoked_at is null)
    and (select count(*) = 1 from public.userbase_app_moderator_allowlist
     where app = 'coletivoxv' and hive_handle = 'pharraxv' and revoked_at is not null)
  union all select 'no moderator bound yet (fresh proof required)',
    (select count(*) = 0 from public.userbase_app_moderators)
)
select name, ok from checks order by ok, name;
