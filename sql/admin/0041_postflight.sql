-- 0041_postflight.sql — READ ONLY. Run right AFTER applying 0041. Every
-- 'check' row must be true. Catalog metadata and status counts only.
-- If the API gets "function not found": notify pgrst, 'reload schema';
with checks(name, ok) as (values
  ('columns publish_parent_author + publish_parent_permlink',
     (select count(*) = 2 from information_schema.columns where table_schema='public'
      and table_name='userbase_app_posts' and column_name in ('publish_parent_author','publish_parent_permlink'))),
  ('constraints parent_pair + parent_format',
     (select count(*) = 2 from pg_constraint where conrelid = 'public.userbase_app_posts'::regclass
      and conname in ('userbase_app_posts_parent_pair','userbase_app_posts_parent_format'))),
  ('reserve_target exists', to_regprocedure('public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)') is not null),
  ('reserve_target: service_role execute',
     has_function_privilege('service_role','public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)','execute')),
  ('reserve_target: no anon/authenticated execute',
     not has_function_privilege('anon','public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)','execute')
     and not has_function_privilege('authenticated','public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)','execute')),
  ('reserve_target SECURITY INVOKER',
     not (select prosecdef from pg_proc where oid = to_regprocedure('public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)'))),
  ('old reserve refuses (raises)',
     (select prosrc like '%use userbase_app_post_publish_reserve_target%' from pg_proc
      where oid = to_regprocedure('public.userbase_app_post_publish_reserve(uuid,uuid,text,text)'))),
  ('guard: destination immutable + required to publish',
     (select prosrc like '%hive destination is fixed once reserved%' and prosrc like '%hive destination not reserved%'
      from pg_proc where oid = to_regprocedure('public.userbase_app__post_guard()'))),
  ('requeue refuses signer_changed, withdrawn_by_author, target_changed, legacy_target_unknown',
     (select prosrc like '%signer_changed%' and prosrc like '%withdrawn_by_author%' and prosrc like '%target_changed%'
        and prosrc like '%legacy_target_unknown%'
      from pg_proc where oid = to_regprocedure('public.userbase_app_post_publish_requeue(text,text,uuid)'))),
  ('requeue/reserve keep service_role-only execute',
     has_function_privilege('service_role','public.userbase_app_post_publish_requeue(text,text,uuid)','execute')
     and not has_function_privilege('anon','public.userbase_app_post_publish_requeue(text,text,uuid)','execute')
     and not has_function_privilege('anon','public.userbase_app_post_publish_reserve(uuid,uuid,text,text)','execute')),
  ('every post with a parent points at a peak.snaps snap-container',
     not exists (select 1 from public.userbase_app_posts where publish_parent_author is not null
                 and (publish_parent_author <> 'peak.snaps' or publish_parent_permlink !~ '^snap-container-[a-z0-9-]+$'))),
  ('service_role still has no DELETE on posts', not has_table_privilege('service_role','public.userbase_app_posts','delete'))
)
select 'check' as kind, name, ok::text as value from checks
union all
select 'info', 'posts by status', coalesce(string_agg(status || '=' || n, ', ' order by status), 'none')
  from (select status, count(*) n from public.userbase_app_posts group by 1) s
union all
select 'info', 'published legacy root posts (parent null, untouched)',
  count(*)::text from public.userbase_app_posts where status = 'published' and publish_parent_author is null;
