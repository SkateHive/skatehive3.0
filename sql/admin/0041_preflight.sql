-- 0041_preflight.sql — READ ONLY. Run BEFORE applying
-- sql/migrations/0041_userbase_app_post_snap_target.sql. Rows 1..n must be
-- ok = true; the "info" rows report what 0041 will do to existing posts.
-- Catalog metadata and status counts only; no post content or user data.
-- Positive privilege checks test one privilege each.
with checks(name, ok) as (values
  ('0038 applied: userbase_app_posts', to_regclass('public.userbase_app_posts') is not null),
  ('0038 functions present (guard, reserve, requeue, log)',
     to_regprocedure('public.userbase_app__post_guard()') is not null
     and to_regprocedure('public.userbase_app_post_publish_reserve(uuid,uuid,text,text)') is not null
     and to_regprocedure('public.userbase_app_post_publish_requeue(text,text,uuid)') is not null
     and to_regprocedure('public.userbase_app__log(public.userbase_app_posts,uuid,text,text,text,text,text)') is not null),
  ('absent: 0041 columns', not exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='userbase_app_posts' and column_name like 'publish\_parent%')),
  ('absent: reserve_target', to_regprocedure('public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)') is null),
  ('service_role select on posts', has_table_privilege('service_role','public.userbase_app_posts','select')),
  ('service_role update on posts', has_table_privilege('service_role','public.userbase_app_posts','update')),
  ('service_role insert on post events', has_table_privilege('service_role','public.userbase_app_post_events','insert'))
)
select 'check' as kind, name, ok::text as value from checks
union all
select 'info', 'posts by status', coalesce(string_agg(status || '=' || n, ', ' order by status), 'none')
  from (select status, count(*) n from public.userbase_app_posts group by 1) s
union all
select 'info', 'published with an author (stay as legacy root posts, parent null)',
  count(*)::text from public.userbase_app_posts where status = 'published' and publish_author is not null
union all
select 'info', 'approved/publishing already reserved without parent (reserve_target will fail them as legacy_target_unknown)',
  count(*)::text from public.userbase_app_posts where status in ('approved','publishing') and publish_author is not null
union all
select 'info', 'requeue already refuses withdrawn_by_author (0040 applied?)',
  (select (prosrc like '%withdrawn_by_author%')::text from pg_proc where oid = to_regprocedure('public.userbase_app_post_publish_requeue(text,text,uuid)'));
