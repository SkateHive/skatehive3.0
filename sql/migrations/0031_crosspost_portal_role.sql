-- 0031_crosspost_portal_role.sql
-- Lets the SkateHive portal work the cross-post queue with a scoped role.
--
-- The alternative — and what the portal reaches for by default — is
-- SUPABASE_SERVICE_ROLE_KEY. That key bypasses RLS on every userbase table:
-- userbase_hive_keys (users' encrypted Hive posting keys), sessions, magic
-- links, 2000+ profiles. A portal compromise would then be an account-takeover
-- event rather than "someone posted a bad clip to Instagram".
--
-- This role can touch two tables and nothing else. Both are FORCE ROW LEVEL
-- SECURITY with a service-role-only policy, so GRANTs alone leave it reading
-- zero rows — the policies below are what actually let it in.

-- ── The role ────────────────────────────────────────────────────────────
-- NOLOGIN on purpose. The portal reaches Supabase through PostgREST, which
-- connects as `authenticator` and then switches into whatever role the JWT's
-- `role` claim names — the same mechanism behind the anon and service_role
-- keys. No password is involved, so there is nothing here to keep out of git.
--
-- The portal mints its own key: a JWT signed with the project's JWT secret
-- (HS256) carrying {"role": "portal_curation", "iss": "supabase", ...}, sent
-- as both `apikey` and `Authorization: Bearer <jwt>`.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'portal_curation') then
    create role portal_curation nologin;
  end if;
end
$$;

-- Without this PostgREST cannot assume the role and every portal request fails
-- before reaching a policy: `authenticator` must be a member of any role it is
-- allowed to switch into. Guarded so the migration still applies on a plain
-- Postgres that has no `authenticator`.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    grant portal_curation to authenticator;
  end if;
end
$$;

grant usage on schema public to portal_curation;

-- ── userbase_crosspost_queue: read the inbox, write the decision ────────
-- No INSERT: only the app enqueues. No DELETE: the row is the audit trail.
grant select on table public.userbase_crosspost_queue to portal_curation;

-- UPDATE is granted COLUMN BY COLUMN, and the omissions are the point. A
-- table-wide grant would let this role rewrite `user_id`, `hive_author` and
-- `hive_permlink` — retargeting a queued item at a different author — or swap
-- the media URLs inside `payload` between the curator approving and the post
-- going out. The RLS policy below only constrains `status`, so it would not
-- catch either. Least privilege has to be spelled out to be real.
--
-- `payload` IS here: editing the caption and collaborators before publishing is
-- the curator's job. `attempts`, `target`, `created_at` and the identity
-- columns are not, and now cannot be touched.
grant update (
  payload,
  status,
  reviewed_by_handle,
  reviewed_at,
  review_note,
  published_at,
  publish_error,
  result,
  updated_at
) on table public.userbase_crosspost_queue to portal_curation;

drop policy if exists "Portal can read the crosspost queue"
  on public.userbase_crosspost_queue;

create policy "Portal can read the crosspost queue"
  on public.userbase_crosspost_queue
  for select
  to portal_curation
  using (true);

drop policy if exists "Portal can record a review decision"
  on public.userbase_crosspost_queue;

-- The WITH CHECK is the point: `publishing` is the app's compare-and-swap, the
-- one thing standing between two curators and a double post. The spec says the
-- portal never writes it; this makes that structural instead of a promise.
create policy "Portal can record a review decision"
  on public.userbase_crosspost_queue
  for update
  to portal_curation
  using (true)
  with check (status <> 'publishing');

-- ── userbase_notifications: tell the author what happened ───────────────
-- INSERT only. The portal has no reason to read or edit anyone's inbox.
grant insert on table public.userbase_notifications to portal_curation;

drop policy if exists "Portal can notify a cross-post author"
  on public.userbase_notifications;

create policy "Portal can notify a cross-post author"
  on public.userbase_notifications
  for insert
  to portal_curation
  with check (type like 'crosspost\_%');

-- `id` is uuid DEFAULT gen_random_uuid() on both tables, so there is no
-- sequence and no GRANT USAGE ... ON SEQUENCE to add here.
