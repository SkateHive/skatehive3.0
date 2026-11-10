-- Rollback for 0041: restores the 0038 definitions (guard trigger function,
-- reserve, requeue) and drops reserve_target, the parent constraints and the
-- parent columns. Turn the publisher off first. Dropping the columns loses the
-- reserved snap parents of posts in flight: export them first if needed.
-- Note: requeue goes back to the 0038 version (refuses only signer_changed);
-- re-apply 0040 afterwards if withdrawn_by_author must stay refused.
-- Safe to run more than once.

begin;

drop function if exists public.userbase_app_post_publish_reserve_target(uuid, uuid, text, text, text, text);
drop function if exists public.userbase_app_post_publish_mark_legacy(uuid, uuid, text);
drop function if exists public.userbase_app_post_reconcile_legacy_root(uuid, text, text);

create or replace function public.userbase_app__post_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();

  if tg_op = 'INSERT' then
    new.body_hash := public.userbase_app__body_hash(
      new.kind, new.title, new.body, new.media, new.context_kind, new.context_slug);
    new.publish_permlink := new.app || '-' || replace(new.id::text, '-', '');
    if not (new.status = 'pending'
            or (new.status = 'approved' and new.auto_approved and new.reviewed_at is not null))
       or new.publish_author is not null or new.publish_attempts <> 0
       or new.published_at is not null or new.crosspost_queue_id is not null then
      raise exception 'new posts start pending (or auto-approved)' using errcode = 'UB422';
    end if;
    return new;
  end if;

  -- Everything that defines the post, its consent and its Hive destination.
  if (new.id, new.app, new.user_id, new.idempotency_key, new.request_hash, new.kind,
      new.title, new.body, new.media, new.context_kind, new.context_slug,
      new.consent_publish_at, new.body_hash, new.publish_permlink, new.auto_approved,
      new.created_at)
     is distinct from
     (old.id, old.app, old.user_id, old.idempotency_key, old.request_hash, old.kind,
      old.title, old.body, old.media, old.context_kind, old.context_slug,
      old.consent_publish_at, old.body_hash, old.publish_permlink, old.auto_approved,
      old.created_at) then
    raise exception 'post content is immutable' using errcode = 'UB409';
  end if;

  if old.publish_author is not null and
     (new.publish_author, new.publish_signer_kind) is distinct from
     (old.publish_author, old.publish_signer_kind) then
    raise exception 'hive author is fixed once reserved' using errcode = 'UB409';
  end if;
  if old.crosspost_queue_id is not null
     and new.crosspost_queue_id is distinct from old.crosspost_queue_id
     and new.crosspost_queue_id is not null then
    raise exception 'crosspost already linked' using errcode = 'UB409';
  end if;
  if old.reviewed_at is not null and
     (new.reviewed_by, new.reviewed_by_hive_handle, new.reviewed_at) is distinct from
     (old.reviewed_by, old.reviewed_by_hive_handle, old.reviewed_at)
     and not (old.reviewed_by is not null and new.reviewed_by is null
              and new.reviewed_at = old.reviewed_at) then  -- reviewer account deleted
    raise exception 'review is immutable' using errcode = 'UB409';
  end if;

  if new.status <> old.status and not (
       (old.status = 'pending'    and new.status in ('approved', 'rejected'))
    or (old.status = 'approved'   and new.status in ('publishing', 'failed'))
    or (old.status = 'publishing' and new.status in ('published', 'approved', 'failed'))
    or (old.status = 'failed'     and new.status = 'approved')
  ) then
    raise exception 'transition % -> % not allowed', old.status, new.status using errcode = 'UB409';
  end if;
  return new;
end;
$$;

create or replace function public.userbase_app_post_publish_reserve(
  p_post_id uuid, p_claim_token uuid, p_author text, p_signer_kind text)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare v_row public.userbase_app_posts;
begin
  select * into v_row from public.userbase_app_posts p
  where p.id = p_post_id and p.publish_claim_token = p_claim_token and p.status = 'publishing'
  for update;
  if v_row.id is null then
    raise exception 'claim lost' using errcode = 'UB409';
  end if;
  if v_row.publish_author is null then
    begin
      update public.userbase_app_posts p
        set publish_author = lower(p_author), publish_signer_kind = p_signer_kind
        where p.id = v_row.id returning * into v_row;
    exception when check_violation then
      raise exception 'invalid author or signer kind' using errcode = 'UB422';
    end;
    perform public.userbase_app__log(v_row, null, null, 'worker', 'publish_reserved',
                                     'publishing', v_row.publish_author);
    return v_row;
  end if;
  if v_row.publish_author = lower(p_author) and v_row.publish_signer_kind = p_signer_kind then
    return v_row;
  end if;
  update public.userbase_app_posts p
    set status = 'failed', publish_claim_token = null, publish_lease_until = null,
        last_error_code = 'signer_changed'
    where p.id = v_row.id returning * into v_row;
  perform public.userbase_app__log(v_row, null, null, 'system', 'publish_failed',
                                   'publishing', 'signer_changed');
  return v_row;
end;
$$;

create or replace function public.userbase_app_post_publish_requeue(
  p_token_hash text, p_app text, p_post_id uuid)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  s record;
  v_mod text;
  v_row public.userbase_app_posts;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  v_mod := public.userbase_app__moderator_handle(s.user_id, s.auth_method_id, p_app);
  if v_mod is null then
    raise exception 'not a moderator of this app' using errcode = 'UB403';
  end if;
  update public.userbase_app_posts p
    set status = 'approved', publish_attempts = 0
    where p.id = p_post_id and p.app = p_app and p.status = 'failed'
      and p.last_error_code is distinct from 'signer_changed'
    returning * into v_row;
  if v_row.id is null then
    raise exception 'post is not a retryable failure' using errcode = 'UB409';
  end if;
  perform public.userbase_app__log(v_row, s.user_id, v_mod, 'moderator', 'publish_requeued',
                                   'failed', null);
  return v_row;
end;
$$;

alter table public.userbase_app_posts drop constraint if exists userbase_app_posts_parent_format;
alter table public.userbase_app_posts drop constraint if exists userbase_app_posts_parent_pair;
alter table public.userbase_app_posts drop column if exists publish_parent_permlink;
alter table public.userbase_app_posts drop column if exists publish_parent_author;

commit;
