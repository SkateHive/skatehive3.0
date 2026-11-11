-- 0043_preflight.sql — READ ONLY. Run BEFORE applying
-- sql/migrations/0043_userbase_app_post_publication_type.sql. Every 'check'
-- must be true; 'info' rows describe what 0043 will touch. Status counts and
-- catalog only; no post content or user data. Positive privilege checks test
-- one privilege each.
with checks(name, ok) as (values
  ('0041 applied: parent columns', (select count(*) = 2 from information_schema.columns
     where table_schema='public' and table_name='userbase_app_posts'
       and column_name in ('publish_parent_author','publish_parent_permlink'))),
  ('0041 applied: reserve_target + mark_legacy',
     to_regprocedure('public.userbase_app_post_publish_reserve_target(uuid,uuid,text,text,text,text)') is not null
     and to_regprocedure('public.userbase_app_post_publish_mark_legacy(uuid,uuid,text)') is not null),
  ('absent: publication_type column', not exists (select 1 from information_schema.columns
     where table_schema='public' and table_name='userbase_app_posts' and column_name='publication_type')),
  ('absent: userbase_app_post_public', to_regprocedure('public.userbase_app_post_public(text,uuid)') is null),
  ('present: 0038 post_create signature (11 args)',
     to_regprocedure('public.userbase_app_post_create(text,text,text,text,text,text,text,jsonb,text,text,boolean)') is not null),
  ('no article-style parent yet (empty string)',
     not exists (select 1 from public.userbase_app_posts where publish_parent_author = '')),
  ('every body fits the snap limit today (<=5000)',
     not exists (select 1 from public.userbase_app_posts where length(body) > 5000)),
  ('service_role select on posts', has_table_privilege('service_role','public.userbase_app_posts','select')),
  ('service_role update on posts', has_table_privilege('service_role','public.userbase_app_posts','update')),
  ('service_role insert on post events', has_table_privilege('service_role','public.userbase_app_post_events','insert'))
)
select 'check' as kind, name, ok::text as value from checks
union all
select 'info', 'posts by status', coalesce(string_agg(status || '=' || n, ', ' order by status), 'none')
  from (select status, count(*) n from public.userbase_app_posts group by 1) s
union all
select 'info', 'parent NULL with author (legacy: reserved/published before 0041)',
  count(*)::text from public.userbase_app_posts where publish_author is not null and publish_parent_author is null
union all
select 'info', 'parent NULL without author (never reserved)',
  count(*)::text from public.userbase_app_posts where publish_author is null and publish_parent_author is null
union all
select 'info', 'parent peak.snaps container (snap reservations)',
  count(*)::text from public.userbase_app_posts where publish_parent_author = 'peak.snaps'
union all
select 'info', 'parent empty string (article reservations)',
  count(*)::text from public.userbase_app_posts where publish_parent_author = ''
union all
select 'info', 'will be reclassified article (published, author, parent NULL)',
  count(*)::text from public.userbase_app_posts
  where status = 'published' and publish_author is not null and publish_parent_author is null
union all
select 'info', 'approved/publishing reserved (any parent) — destinations kept as they are',
  count(*)::text from public.userbase_app_posts where status in ('approved','publishing') and publish_author is not null;
