-- 0043_postflight.sql — READ ONLY. Run right AFTER applying 0043. Every
-- 'check' must be true; compare the 'info' rows with the preflight (parent
-- counts must be identical: 0043 changes no destination).
-- If the API gets "function not found": notify pgrst, 'reload schema';
with fns(sig) as (values
  ('public.userbase_app_post_public(text,uuid)'),
  ('public.userbase_app_post_create(text,text,text,text,text,text,text,jsonb,text,text,boolean,text)'),
  ('public.userbase_app_feed(text,text,text,timestamptz,uuid,integer)'),
  ('public.userbase_app_post_get(text,text,uuid)'),
  ('public.userbase_app_post_queue(text,text,text,timestamptz,uuid,integer)'),
  ('public.userbase_app__body_hash_v2(text,text,text,text,jsonb,text,text)'),
  ('public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)')),
checks(name, ok) as (
  select 'column publication_type not null default snap',
    exists (select 1 from information_schema.columns where table_schema='public' and table_name='userbase_app_posts'
            and column_name='publication_type' and is_nullable='NO' and column_default like '%snap%')
  union all select 'constraints: type, body by type, article content, parent by type',
    (select count(*) = 4 from pg_constraint where conrelid = 'public.userbase_app_posts'::regclass and conname in
      ('userbase_app_posts_publication_type','userbase_app_posts_body_len_by_type',
       'userbase_app_posts_article_content','userbase_app_posts_parent_format'))
  union all select 'old 5000-only body constraint gone',
    not exists (select 1 from pg_constraint where conname = 'userbase_app_posts_body_len')
  union all select 'events accept reclassified',
    (select pg_get_constraintdef(oid) like '%reclassified%' from pg_constraint where conname = 'userbase_app_post_events_action')
  union all select 'exists: ' || sig, to_regprocedure(sig) is not null from fns
  union all select 'service_role only: ' || sig,
    to_regprocedure(sig) is not null
    and has_function_privilege('service_role', sig, 'execute')
    and not has_function_privilege('anon', sig, 'execute')
    and not has_function_privilege('authenticated', sig, 'execute') from fns
  union all select 'no SECURITY DEFINER among them',
    not exists (select 1 from fns join pg_proc p on p.oid = to_regprocedure(fns.sig) where p.prosecdef)
  union all select 'old 11-arg post_create gone',
    to_regprocedure('public.userbase_app_post_create(text,text,text,text,text,text,text,jsonb,text,text,boolean)') is null
  union all select 'guard: publication_type immutable + v2 hash',
    (select prosrc like '%old.publication_type%' and prosrc like '%userbase_app__body_hash_v2%'
     from pg_proc where oid = to_regprocedure('public.userbase_app__post_guard()'))
  union all select 'reserve_target: article -> '''' + hive-173115, snap -> container',
    (select prosrc like '%hive-173115%' and prosrc like '%snap-container%' and prosrc like '%target_changed%'
       and prosrc like '%legacy_target_unknown%'
     from pg_proc where oid = to_regprocedure('public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)'))
  union all select 'safeguards kept: requeue refusals, mark_legacy, owner-only reconcile',
    (select prosrc like '%withdrawn_by_author%' and prosrc like '%target_changed%' and prosrc like '%legacy_target_unknown%'
     from pg_proc where oid = to_regprocedure('public.userbase_app_post_publish_requeue(text,text,uuid)'))
    and to_regprocedure('public.userbase_app_post_publish_mark_legacy(uuid,uuid,text)') is not null
    and not has_function_privilege('service_role','public.userbase_app_post_reconcile_legacy_root(uuid,text,text)','execute')
  union all select 'every reclassified post is a published legacy root',
    not exists (select 1 from public.userbase_app_posts where publication_type = 'article'
                and not (status = 'published' and publish_author is not null and publish_parent_author is null)
                and publish_parent_author is distinct from '')
  union all select 'one reclassified event per reclassified legacy root',
    (select count(*) from public.userbase_app_posts where publication_type = 'article' and publish_parent_author is null)
    = (select count(distinct post_id) from public.userbase_app_post_events where action = 'reclassified')
  union all select 'service_role still has no DELETE on posts', not has_table_privilege('service_role','public.userbase_app_posts','delete')
)
select 'check' as kind, name, ok::text as value from checks
union all
select 'info', 'posts by type/status', coalesce(string_agg(publication_type || '/' || status || '=' || n, ', ' order by publication_type, status), 'none')
  from (select publication_type, status, count(*) n from public.userbase_app_posts group by 1, 2) s
union all
select 'info', 'parent NULL with author (legacy)', count(*)::text from public.userbase_app_posts where publish_author is not null and publish_parent_author is null
union all
select 'info', 'parent peak.snaps container', count(*)::text from public.userbase_app_posts where publish_parent_author = 'peak.snaps'
union all
select 'info', 'parent empty string (article)', count(*)::text from public.userbase_app_posts where publish_parent_author = '';
