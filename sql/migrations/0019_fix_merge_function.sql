-- 0019_fix_merge_function.sql
-- Fix userbase_merge_users after 0018 dropped:
--   - userbase_community_memberships
--   - userbase_merge_audit
--   - userbase_user_keys / userbase_secrets / userbase_key_usage_audit
-- The old function referenced all of those → every merge call threw an exception
-- and rolled back silently, leaving duplicate accounts unfixed.
--
-- Changes vs old function:
--   REMOVED: delete from userbase_community_memberships (table dropped)
--   REMOVED: update userbase_user_keys (table dropped)
--   REMOVED: insert into userbase_merge_audit (table dropped)
--   ADDED:   update userbase_hive_keys (new key system from 0016)

create or replace function public.userbase_merge_users(
  source_user_id uuid,
  target_user_id uuid,
  actor_user_id uuid,
  reason text default null,
  metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row record;
begin
  if (auth.jwt() ->> 'role') is distinct from 'service_role' then
    raise exception 'Unauthorized';
  end if;

  if source_user_id = target_user_id then
    raise exception 'Source and target users must be different';
  end if;

  select * into source_row from public.userbase_users where id = source_user_id;
  if source_row is null then
    raise exception 'Source user not found';
  end if;

  if not exists (select 1 from public.userbase_users where id = target_user_id) then
    raise exception 'Target user not found';
  end if;

  -- Auth methods: dedupe by type+identifier, then move remainder
  delete from public.userbase_auth_methods s
  using public.userbase_auth_methods t
  where s.user_id = source_user_id
    and t.user_id = target_user_id
    and s.type = t.type
    and s.identifier = t.identifier;

  update public.userbase_auth_methods
    set user_id = target_user_id
  where user_id = source_user_id;

  -- Identities: dedupe by matching handle/address/external_id, then move remainder
  delete from public.userbase_identities s
  using public.userbase_identities t
  where s.user_id = source_user_id
    and t.user_id = target_user_id
    and s.type = t.type
    and (
      (s.handle is not null and s.handle = t.handle) or
      (s.address is not null and s.address = t.address) or
      (s.external_id is not null and s.external_id = t.external_id)
    );

  update public.userbase_identities
    set user_id = target_user_id
  where user_id = source_user_id;

  -- Magic links
  update public.userbase_magic_links
    set user_id = target_user_id
  where user_id = source_user_id;

  -- Hive keys (new system from migration 0016)
  update public.userbase_hive_keys
    set user_id = target_user_id
  where user_id = source_user_id;

  -- Soft posts
  update public.userbase_soft_posts
    set user_id = target_user_id
  where user_id = source_user_id;

  -- Soft votes: dedupe by (author, permlink), then move remainder
  delete from public.userbase_soft_votes s
  using public.userbase_soft_votes t
  where s.user_id = source_user_id
    and t.user_id = target_user_id
    and s.author = t.author
    and s.permlink = t.permlink;

  update public.userbase_soft_votes
    set user_id = target_user_id
  where user_id = source_user_id;

  -- Revoke source sessions
  update public.userbase_sessions
    set revoked_at = now()
  where user_id = source_user_id
    and revoked_at is null;

  -- Drop stale challenges
  delete from public.userbase_identity_challenges
  where user_id = source_user_id;

  -- Mark source merged + clear handle to free uniqueness slot
  update public.userbase_users
    set status = 'merged',
        handle = null,
        updated_at = now()
  where id = source_user_id;

  -- Backfill target profile with source data (target wins on conflict)
  update public.userbase_users
    set handle       = coalesce(handle,       source_row.handle),
        display_name = coalesce(display_name, source_row.display_name),
        avatar_url   = coalesce(avatar_url,   source_row.avatar_url),
        cover_url    = coalesce(cover_url,    source_row.cover_url),
        bio          = coalesce(bio,          source_row.bio),
        location     = coalesce(location,     source_row.location),
        updated_at   = now()
  where id = target_user_id;
end;
$$;
