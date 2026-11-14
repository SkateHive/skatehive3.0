-- Rollback for 0038_userbase_app_posts.sql.
-- Turn the community API off first (no new posts, no publishing). Drops posts,
-- their event log, moderator bindings and challenges for good: export them
-- first if they are needed. Posts already on Hive stay on Hive. Nothing in
-- 0036 or earlier is touched. Safe to run more than once.

begin;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'userbase_app_me', 'userbase_app_moderator_challenge_create',
        'userbase_app_moderator_challenge_get', 'userbase_app_moderator_bind',
        'userbase_app_moderator_unbind', 'userbase_app_post_create', 'userbase_app_post_review',
        'userbase_app_post_get', 'userbase_app_post_list_mine', 'userbase_app_post_queue',
        'userbase_app_feed', 'userbase_app_post_publish_claim',
        'userbase_app_post_publish_reserve', 'userbase_app_post_publish_complete',
        'userbase_app_post_publish_requeue', 'userbase_app_post_link_crosspost',
        'userbase_app_post_outbox_claim', 'userbase_app_post_outbox_complete',
        'userbase_app_post_outbox_requeue',
        'userbase_app__session', 'userbase_app__moderator_handle', 'userbase_app__log')
  loop
    execute format('drop function if exists %s', f.sig);
  end loop;
end $$;

drop table if exists public.userbase_app_post_outbox;
drop table if exists public.userbase_app_post_events;
drop table if exists public.userbase_app_posts;
drop table if exists public.userbase_app_moderators;
drop table if exists public.userbase_app_moderator_challenges;
drop table if exists public.userbase_app_moderator_allowlist;
drop function if exists public.userbase_app__post_guard();
drop function if exists public.userbase_app__append_only();
drop function if exists public.userbase_app__body_hash(text, text, text, jsonb, text, text);
drop function if exists public.userbase_app__media_valid(text, jsonb);

commit;
