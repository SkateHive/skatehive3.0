-- 0031_crosspost_portal_role.sql
-- Lets the SkateHive portal work the cross-post queue with a scoped role.
--
-- Both queue tables are FORCE ROW LEVEL SECURITY with a single policy keyed on
-- `auth.jwt() ->> 'role' = 'service_role'`. On a direct Postgres connection
-- auth.jwt() is NULL, so that policy is false and the portal would read zero
-- rows and fail every insert — with the GRANTs correct. RLS, not permissions.
--
-- The alternative was handing the portal SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS on every userbase table, including userbase_hive_keys (users'
-- encrypted posting keys), sessions and magic links. A portal compromise would
-- then be a full account-takeover event rather than "someone posted a bad clip
-- to Instagram". Hence a role scoped to the two tables this feature owns.

-- ── The role ────────────────────────────────────────────────────────────
-- Created without LOGIN on purpose: the password must not live in git. After
-- applying this, grant access with (outside version control):
--
--   ALTER ROLE portal_curation WITH LOGIN PASSWORD '<generated>';
--
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'portal_curation') then
    create role portal_curation nologin;
  end if;
end
$$;

grant usage on schema public to portal_curation;

-- ── userbase_crosspost_queue: read the inbox, write the decision ────────
-- No INSERT: only the app enqueues. No DELETE: the row is the audit trail.
grant select, update on table public.userbase_crosspost_queue to portal_curation;

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
