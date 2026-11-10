-- 0041_userbase_app_post_snap_target.sql
-- ⚠ APPLY MANUALLY in the Supabase SQL editor (no migration runner).
--   Needs 0038. Rollback: 0041_userbase_app_post_snap_target.rollback.sql.
--   Read-only checks: sql/admin/0041_preflight.sql, sql/admin/0041_postflight.sql.
--   Local test: bash scripts/test-0041-snap-target.sh (Docker; never touches Supabase).
--
-- Partner-app posts publish to Hive as SNAPS: a reply to the current
-- @peak.snaps container (snap-container-*), not a root (blog) post. Containers
-- rotate, so the full destination (author, signer, parent author, parent
-- permlink) is reserved ONCE, atomically, under a live claim, before any
-- broadcast. Retries and chain reconciliation use only the reserved values.
--
-- * publish_parent_author / publish_parent_permlink: both or neither; when the
--   parent is peak.snaps the permlink must look like a container.
-- * userbase_app_post_publish_reserve_target(): the only way to reserve. Same
--   destination again: no-op. A different one later: the post is persisted as
--   failed 'target_changed' (returned, not raised, so the write sticks) and is
--   never republished elsewhere.
-- * A post reserved before 0041 (author set, parent null) is NOT assumed to be
--   a snap and is NEVER published automatically: reserve_target, or the API's
--   userbase_app_post_publish_mark_legacy() after checking the chain, persists
--   it as failed 'legacy_target_unknown'. A person can then confirm a root post
--   found on chain with userbase_app_post_reconcile_legacy_root() (owner only,
--   SQL editor, operator + note logged); that is the only way a post becomes
--   published without a parent.
-- * Inserts can't carry a destination; only reserve_target sets it.
-- * userbase_app_post_publish_reserve() (0038, no parent) now refuses (UB409).
-- * Guard trigger: the destination is immutable once set, and nothing becomes
--   'published' without a reserved destination. Posts already published before
--   0041 keep a null parent and are left alone.
-- * Requeue refuses signer_changed, withdrawn_by_author, target_changed and
--   legacy_target_unknown. This includes 0040's change, so 0040 is no longer
--   needed; if 0040 is applied anyway it must be applied BEFORE 0041, never
--   after (it would drop target_changed from the refusal list).
--
-- No chain writes, no data rewritten. Safe to run more than once; one transaction.

begin;

alter table public.userbase_app_posts
  add column if not exists publish_parent_author text,
  add column if not exists publish_parent_permlink text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'userbase_app_posts_parent_pair') then
    alter table public.userbase_app_posts add constraint userbase_app_posts_parent_pair
      check ((publish_parent_author is null) = (publish_parent_permlink is null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'userbase_app_posts_parent_format') then
    alter table public.userbase_app_posts add constraint userbase_app_posts_parent_format
      check (publish_parent_author is null or (
        publish_parent_author ~ '^[a-z][a-z0-9.-]{2,15}$'
        and publish_parent_permlink ~ '^[a-z0-9-]{1,255}$'
        and (publish_parent_author <> 'peak.snaps' or publish_parent_permlink ~ '^snap-container-[a-z0-9-]+$')));
  end if;
end $$;

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
       or new.publish_parent_author is not null or new.publish_parent_permlink is not null
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
  -- New reservations always carry the destination (0041): the author can't be
  -- set without the parent (rows reserved before 0041 keep theirs).
  if old.publish_author is null and new.publish_author is not null
     and new.publish_parent_author is null then
    raise exception 'reserve the destination with reserve_target' using errcode = 'UB409';
  end if;
  -- Hive destination (0041): fixed once reserved, never moved.
  if old.publish_parent_author is not null and
     (new.publish_parent_author, new.publish_parent_permlink) is distinct from
     (old.publish_parent_author, old.publish_parent_permlink) then
    raise exception 'hive destination is fixed once reserved' using errcode = 'UB409';
  end if;
  -- Nothing becomes published without a reserved destination (0041). Rows
  -- published before 0041 keep a null parent and are not re-checked. The one
  -- exception is the audited operator path for a legacy root post already on
  -- chain (userbase_app_post_reconcile_legacy_root), which sets a
  -- transaction-local flag; nothing else can publish without a parent.
  if new.status = 'published' and old.status <> 'published'
     and new.publish_parent_author is null
     and not (coalesce(current_setting('userbase.reconcile_legacy_root', true), '') = 'on'
              and current_user not in ('service_role', 'anon', 'authenticated')
              and old.status = 'failed' and old.last_error_code = 'legacy_target_unknown'
              and new.publish_author is not null) then
    raise exception 'hive destination not reserved' using errcode = 'UB409';
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
    or (old.status = 'failed'     and new.status = 'published'
        and coalesce(current_setting('userbase.reconcile_legacy_root', true), '') = 'on'
        and current_user not in ('service_role', 'anon', 'authenticated')
        and old.last_error_code = 'legacy_target_unknown')
  ) then
    raise exception 'transition % -> % not allowed', old.status, new.status using errcode = 'UB409';
  end if;
  return new;
end;
$$;

-- 0038's reserve (author only) is closed: every reservation must carry the
-- full destination.
create or replace function public.userbase_app_post_publish_reserve(
  p_post_id uuid, p_claim_token uuid, p_author text, p_signer_kind text)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
begin
  raise exception 'use userbase_app_post_publish_reserve_target' using errcode = 'UB409';
end;
$$;

-- Reserve author + signer + snap parent atomically under a live claim.
-- Returns the row; the caller broadcasts ONLY when status is still
-- 'publishing'. A failed row (target_changed / legacy_target_unknown) is
-- persisted and returned, not raised.
create or replace function public.userbase_app_post_publish_reserve_target(
  p_post_id uuid, p_claim_token uuid, p_author text, p_signer_kind text,
  p_parent_author text, p_parent_permlink text)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  v_row public.userbase_app_posts;
  v_author text := lower(btrim(p_author));
  v_pa text := lower(btrim(p_parent_author));
  v_pp text := btrim(p_parent_permlink);
  v_code text;
begin
  if v_pa is distinct from 'peak.snaps'
     or v_pp is null or v_pp !~ '^snap-container-[a-z0-9-]+$' then
    raise exception 'destination must be a peak.snaps snap-container' using errcode = 'UB422';
  end if;
  if v_author is null or v_author !~ '^[a-z][a-z0-9.-]{2,15}$'
     or p_signer_kind is null or p_signer_kind not in ('own_key', 'shared_default') then
    raise exception 'invalid author or signer kind' using errcode = 'UB422';
  end if;

  select * into v_row from public.userbase_app_posts p
  where p.id = p_post_id and p.publish_claim_token = p_claim_token
    and p.status = 'publishing' and p.publish_lease_until > now()
  for update;
  if v_row.id is null then
    raise exception 'claim lost or expired' using errcode = 'UB409';
  end if;

  -- First reservation: everything at once.
  if v_row.publish_author is null and v_row.publish_parent_author is null then
    update public.userbase_app_posts p
      set publish_author = v_author, publish_signer_kind = p_signer_kind,
          publish_parent_author = v_pa, publish_parent_permlink = v_pp
      where p.id = v_row.id returning * into v_row;
    perform public.userbase_app__log(v_row, null, null, 'worker', 'publish_reserved',
      'publishing', v_author || ' -> ' || v_pa || '/' || v_pp);
    return v_row;
  end if;

  -- Same destination again: no-op.
  if v_row.publish_author = v_author and v_row.publish_signer_kind = p_signer_kind
     and v_row.publish_parent_author = v_pa and v_row.publish_parent_permlink = v_pp then
    return v_row;
  end if;

  -- Anything else is a conflict, persisted as a terminal failure.
  v_code := case when v_row.publish_parent_author is null then 'legacy_target_unknown'
                 else 'target_changed' end;
  update public.userbase_app_posts p
    set status = 'failed', publish_claim_token = null, publish_lease_until = null,
        last_error_code = v_code
    where p.id = v_row.id returning * into v_row;
  perform public.userbase_app__log(v_row, null, null, 'system', 'publish_failed', 'publishing', v_code);
  return v_row;
end;
$$;

-- API path for a post reserved before 0041 (author set, parent null): mark it
-- terminal legacy_target_unknown under its live claim, whether or not the API
-- found it on chain. Never published automatically, never assumed to be a
-- snap. p_detail records what the API saw (e.g. 'root on chain: a/p').
-- Persisted and returned, not raised.
create or replace function public.userbase_app_post_publish_mark_legacy(
  p_post_id uuid, p_claim_token uuid, p_detail text)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare v_row public.userbase_app_posts;
begin
  select * into v_row from public.userbase_app_posts p
  where p.id = p_post_id and p.publish_claim_token = p_claim_token
    and p.status = 'publishing' and p.publish_lease_until > now()
  for update;
  if v_row.id is null then
    raise exception 'claim lost or expired' using errcode = 'UB409';
  end if;
  if v_row.publish_author is null or v_row.publish_parent_author is not null then
    raise exception 'not a legacy reservation' using errcode = 'UB409';
  end if;
  update public.userbase_app_posts p
    set status = 'failed', publish_claim_token = null, publish_lease_until = null,
        last_error_code = 'legacy_target_unknown'
    where p.id = v_row.id returning * into v_row;
  perform public.userbase_app__log(v_row, null, null, 'system', 'publish_failed', 'publishing',
    'legacy_target_unknown: ' || coalesce(left(p_detail, 400), ''));
  return v_row;
end;
$$;

-- Operator-only, audited: confirm that a legacy_target_unknown post is
-- already on chain as a ROOT post under its reserved author/permlink, and
-- record it as published with a null parent (like posts published before
-- 0041). Run by a person from the SQL editor after checking the chain; the
-- API can't call it (no service_role grant). Operator and note are logged.
create or replace function public.userbase_app_post_reconcile_legacy_root(
  p_post_id uuid, p_operator text, p_note text)
returns public.userbase_app_posts
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare v_row public.userbase_app_posts;
begin
  if coalesce(btrim(p_operator), '') = '' or coalesce(btrim(p_note), '') = '' then
    raise exception 'operator and note are required' using errcode = 'UB422';
  end if;
  perform set_config('userbase.reconcile_legacy_root', 'on', true);
  update public.userbase_app_posts p
    set status = 'published', published_at = now(), last_error_code = null
    where p.id = p_post_id and p.status = 'failed'
      and p.last_error_code = 'legacy_target_unknown'
      and p.publish_author is not null and p.publish_parent_author is null
    returning * into v_row;
  perform set_config('userbase.reconcile_legacy_root', '', true);
  if v_row.id is null then
    raise exception 'post is not a legacy_target_unknown reservation' using errcode = 'UB409';
  end if;
  perform public.userbase_app__log(v_row, null, left(btrim(p_operator), 64), 'system', 'publish_succeeded',
    'failed', 'legacy root reconciled by operator: ' || left(p_note, 400));
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
      and coalesce(p.last_error_code, '') not in
        ('signer_changed', 'withdrawn_by_author', 'target_changed', 'legacy_target_unknown')
    returning * into v_row;
  if v_row.id is null then
    raise exception 'post is not a retryable failure' using errcode = 'UB409';
  end if;
  perform public.userbase_app__log(v_row, s.user_id, v_mod, 'moderator', 'publish_requeued',
                                   'failed', null);
  return v_row;
end;
$$;

revoke all on function public.userbase_app_post_publish_reserve_target(uuid, uuid, text, text, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.userbase_app_post_publish_reserve_target(uuid, uuid, text, text, text, text)
  to service_role;
revoke all on function public.userbase_app_post_publish_mark_legacy(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.userbase_app_post_publish_mark_legacy(uuid, uuid, text)
  to service_role;
-- Operator path: owner only (SQL editor). No service_role grant, so the API
-- (PostgREST with the service key) can't call it.
revoke all on function public.userbase_app_post_reconcile_legacy_root(uuid, text, text)
  from public, anon, authenticated, service_role;

commit;
