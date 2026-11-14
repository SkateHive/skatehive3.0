-- Rollback for 0043. Restores the 0041 guard and reserve_target, the 0038
-- post_create (without p_publication_type) and read RPCs, drops
-- userbase_app_post_public, body_hash_v2, the per-type constraints and the
-- column. Turn the API's article support off first.
--
-- REFUSES (raises) when it would lose information: any article other than a
-- legacy root post reclassified by 0043 (published, parent NULL, with a
-- 'reclassified' event) - including new articles still pending, approved,
-- rejected or failed, so an author's choice is never silently turned into a
-- snap - or any body over 5000 characters. Legacy reclassified rows lose only
-- the label (0043 re-applies it). The 'reclassified' events stay in the
-- append-only log (the wider action list is kept). Safe to run more than once.

begin;

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public'
             and table_name = 'userbase_app_posts' and column_name = 'publication_type') then
    if exists (select 1 from public.userbase_app_posts p
               where length(p.body) > 5000
                  or (p.publication_type = 'article'
                      and not (p.status = 'published' and p.publish_parent_author is null
                               and exists (select 1 from public.userbase_app_post_events e
                                           where e.post_id = p.id and e.action = 'reclassified')))) then
      raise exception '0043 rollback refused: articles chosen by authors or long bodies exist' using errcode = 'UB409';
    end if;
  end if;
end $$;

drop function if exists public.userbase_app_post_public(text, uuid);
drop function if exists public.userbase_app_post_create(text, text, text, text, text, text, text, jsonb, text, text, boolean, text);
drop function if exists public.userbase_app_feed(text, text, text, timestamptz, uuid, integer);
drop function if exists public.userbase_app_post_get(text, text, uuid);
drop function if exists public.userbase_app_post_queue(text, text, text, timestamptz, uuid, integer);

create or replace function public.userbase_app_post_create(
  p_token_hash text,
  p_app text,
  p_idempotency_key text,
  p_request_hash text,
  p_kind text,
  p_title text,
  p_body text,
  p_media jsonb,
  p_context_kind text,
  p_context_slug text,
  p_consent_publish boolean
)
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

  select * into v_row from public.userbase_app_posts p
  where p.app = p_app and p.user_id = s.user_id and p.idempotency_key = p_idempotency_key;
  if v_row.id is not null then
    if v_row.request_hash <> p_request_hash then
      raise exception 'idempotency key reused with another body' using errcode = 'UB409';
    end if;
    return v_row;  -- retry of the same request
  end if;

  if p_consent_publish is not true then
    raise exception 'consent to publish is required' using errcode = 'UB422';
  end if;
  if (select count(*) from public.userbase_app_posts p
      where p.app = p_app and p.user_id = s.user_id
        and p.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'too many posts today' using errcode = 'UB429';
  end if;

  v_mod := public.userbase_app__moderator_handle(s.user_id, s.auth_method_id, p_app);

  begin
    insert into public.userbase_app_posts
      (app, user_id, idempotency_key, request_hash, kind, title, body, media,
       context_kind, context_slug, consent_publish_at,
       status, auto_approved, reviewed_by, reviewed_by_hive_handle, reviewed_at)
    values
      (p_app, s.user_id, p_idempotency_key, p_request_hash, p_kind,
       nullif(btrim(p_title), ''), coalesce(p_body, ''), coalesce(p_media, '[]'::jsonb),
       p_context_kind, p_context_slug, now(),
       case when v_mod is null then 'pending' else 'approved' end,
       v_mod is not null,
       case when v_mod is null then null else s.user_id end,
       v_mod,
       case when v_mod is null then null else now() end)
    returning * into v_row;
  exception
    when unique_violation then
      select * into v_row from public.userbase_app_posts p
      where p.app = p_app and p.user_id = s.user_id and p.idempotency_key = p_idempotency_key;
      if v_row.id is null or v_row.request_hash <> p_request_hash then
        raise exception 'idempotency key reused with another body' using errcode = 'UB409';
      end if;
      return v_row;
    when check_violation then
      raise exception 'invalid post content' using errcode = 'UB422';
  end;

  perform public.userbase_app__log(v_row, s.user_id, null, 'author', 'created', null, null);
  if v_mod is not null then
    perform public.userbase_app__log(v_row, s.user_id, v_mod, 'moderator', 'auto_approved',
                                     'pending', null);
  end if;
  return v_row;
end;
$$;

create or replace function public.userbase_app_feed(
  p_app text, p_context_kind text default null, p_context_slug text default null,
  p_before_at timestamptz default null, p_before_id uuid default null, p_limit integer default 20)
returns table (
  id uuid, kind text, title text, body text, media jsonb, context_kind text, context_slug text,
  author_handle text, author_display_name text, author_avatar_url text,
  publish_author text, publish_permlink text, published_at timestamptz)
language sql
stable
set search_path = public
as $$
  select p.id, p.kind, p.title, p.body, p.media, p.context_kind, p.context_slug,
         u.handle, u.display_name, u.avatar_url, p.publish_author, p.publish_permlink, p.published_at
  from public.userbase_app_posts p
  join public.userbase_users u on u.id = p.user_id
  where p.app = p_app and p.status = 'published'
    and (p_context_kind is null or p.context_kind = p_context_kind)
    and (p_context_slug is null or p.context_slug = p_context_slug)
    and (p_before_at is null
         or (p.published_at, p.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by p.published_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

create or replace function public.userbase_app_post_get(
  p_token_hash text, p_app text, p_post_id uuid)
returns table (
  id uuid, status text, kind text, title text, body text, media jsonb,
  context_kind text, context_slug text,
  author_user_id uuid, author_handle text, author_display_name text, author_avatar_url text,
  created_at timestamptz, reviewed_at timestamptz, reject_reason text, published_at timestamptz,
  publish_author text, publish_permlink text, last_error_code text, auto_approved boolean,
  is_owner boolean, viewer_is_moderator boolean)
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare
  s record;
  v_is_mod boolean;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  v_is_mod := public.userbase_app__moderator_handle(s.user_id, s.auth_method_id, p_app) is not null;
  return query
  select p.id, p.status, p.kind, p.title, p.body, p.media, p.context_kind, p.context_slug,
         p.user_id, u.handle, u.display_name, u.avatar_url,
         p.created_at, p.reviewed_at, p.reject_reason, p.published_at,
         case when p.status = 'published' then p.publish_author end,
         case when p.status = 'published' then p.publish_permlink end,
         p.last_error_code, p.auto_approved, p.user_id = s.user_id, v_is_mod
  from public.userbase_app_posts p
  join public.userbase_users u on u.id = p.user_id
  where p.id = p_post_id and p.app = p_app and (p.user_id = s.user_id or v_is_mod);
  if not found then
    raise exception 'post not found' using errcode = 'UB404';
  end if;
end;
$$;

create or replace function public.userbase_app_post_queue(
  p_token_hash text, p_app text, p_status text default 'pending',
  p_before_at timestamptz default null, p_before_id uuid default null, p_limit integer default 50)
returns table (
  id uuid, status text, kind text, title text, body text, media jsonb,
  context_kind text, context_slug text,
  author_user_id uuid, author_handle text, author_display_name text, author_avatar_url text,
  created_at timestamptz, reviewed_at timestamptz, reviewed_by_hive_handle text,
  reject_reason text, last_error_code text, publish_attempts integer)
language plpgsql
volatile
set search_path = public
as $$
#variable_conflict use_column
declare s record;
begin
  select * into s from public.userbase_app__session(p_token_hash, p_app);
  if public.userbase_app__moderator_handle(s.user_id, s.auth_method_id, p_app) is null then
    raise exception 'not a moderator of this app' using errcode = 'UB403';
  end if;
  return query
  select p.id, p.status, p.kind, p.title, p.body, p.media, p.context_kind, p.context_slug,
         p.user_id, u.handle, u.display_name, u.avatar_url, p.created_at, p.reviewed_at,
         p.reviewed_by_hive_handle, p.reject_reason, p.last_error_code, p.publish_attempts
  from public.userbase_app_posts p
  join public.userbase_users u on u.id = p.user_id
  where p.app = p_app and p.status = p_status
    and (p_before_at is null
         or (p.created_at, p.id) < (p_before_at, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
  order by p.created_at desc, p.id desc
  limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

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

revoke all on function public.userbase_app_post_reconcile_legacy_root(uuid, text, text)
  from public, anon, authenticated, service_role;

alter table public.userbase_app_posts drop constraint if exists userbase_app_posts_parent_format;
alter table public.userbase_app_posts add constraint userbase_app_posts_parent_format
  check (publish_parent_author is null or (
    publish_parent_author ~ '^[a-z][a-z0-9.-]{2,15}$'
    and publish_parent_permlink ~ '^[a-z0-9-]{1,255}$'
    and (publish_parent_author <> 'peak.snaps' or publish_parent_permlink ~ '^snap-container-[a-z0-9-]+$')));
alter table public.userbase_app_posts drop constraint if exists userbase_app_posts_article_content;
alter table public.userbase_app_posts drop constraint if exists userbase_app_posts_body_len_by_type;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'userbase_app_posts_body_len') then
    alter table public.userbase_app_posts add constraint userbase_app_posts_body_len check (length(body) <= 5000);
  end if;
end $$;
alter table public.userbase_app_posts drop constraint if exists userbase_app_posts_publication_type;
alter table public.userbase_app_posts drop column if exists publication_type;
drop function if exists public.userbase_app__body_hash_v2(text, text, text, text, jsonb, text, text);

do $$
declare f text;
begin
  foreach f in array array[
    'public.userbase_app_post_create(text, text, text, text, text, text, text, jsonb, text, text, boolean)', 'public.userbase_app_feed(text, text, text, timestamptz, uuid, integer)', 'public.userbase_app_post_get(text, text, uuid)', 'public.userbase_app_post_queue(text, text, text, timestamptz, uuid, integer)',
    'public.userbase_app_post_publish_reserve_target(uuid, uuid, text, text, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

commit;
