-- 0019b_cleanup_duplicate_users.sql
-- One-time cleanup of duplicate user accounts caused by bootstrap bug.
--
-- Root cause: bootstrap/route.ts only checked for existing Hive identity,
-- so EVM/Farcaster users got a brand-new account on every new session.
--
-- NOTE: userbase_merge_users() requires service_role JWT, which the SQL editor
-- doesn't have. This script performs the same merge logic inline to avoid that.
-- Run in the Supabase SQL editor (postgres role is fine here).

-- ============================================================================
-- STEP 1: Preview duplicates before merging
-- ============================================================================

-- Duplicate EVM addresses
SELECT
  i.address,
  count(*) as user_count,
  array_agg(i.user_id ORDER BY u.created_at ASC) as user_ids_oldest_first
FROM public.userbase_identities i
JOIN public.userbase_users u ON u.id = i.user_id
WHERE i.type = 'evm'
  AND i.address IS NOT NULL
  AND u.status = 'active'
GROUP BY i.address
HAVING count(*) > 1
ORDER BY user_count DESC;

-- Duplicate Farcaster fids
SELECT
  i.external_id as farcaster_fid,
  count(*) as user_count,
  array_agg(i.user_id ORDER BY u.created_at ASC) as user_ids_oldest_first
FROM public.userbase_identities i
JOIN public.userbase_users u ON u.id = i.user_id
WHERE i.type = 'farcaster'
  AND i.external_id IS NOT NULL
  AND u.status = 'active'
GROUP BY i.external_id
HAVING count(*) > 1
ORDER BY user_count DESC;

-- ============================================================================
-- STEP 2: Merge duplicate accounts (inline — no function call needed)
-- Run this block. It merges all newer duplicates into the oldest account.
-- ============================================================================

DO $$
DECLARE
  dup        RECORD;
  pair       RECORD;
  src        uuid;
  tgt        uuid;
  src_row    RECORD;
BEGIN

  -- ---- EVM duplicates ----
  FOR dup IN
    SELECT
      i.address,
      array_agg(i.user_id ORDER BY u.created_at ASC) as user_ids
    FROM public.userbase_identities i
    JOIN public.userbase_users u ON u.id = i.user_id
    WHERE i.type = 'evm'
      AND i.address IS NOT NULL
      AND u.status = 'active'
    GROUP BY i.address
    HAVING count(*) > 1
  LOOP
    tgt := dup.user_ids[1];  -- oldest = canonical target

    FOR i IN 2..array_length(dup.user_ids, 1) LOOP
      src := dup.user_ids[i];
      SELECT * INTO src_row FROM public.userbase_users WHERE id = src;

      RAISE NOTICE '[EVM] Merging % → % (address: %)', src, tgt, dup.address;

      -- Auth methods
      DELETE FROM public.userbase_auth_methods s
      USING public.userbase_auth_methods t
      WHERE s.user_id = src AND t.user_id = tgt
        AND s.type = t.type AND s.identifier = t.identifier;
      UPDATE public.userbase_auth_methods SET user_id = tgt WHERE user_id = src;

      -- Identities
      DELETE FROM public.userbase_identities s
      USING public.userbase_identities t
      WHERE s.user_id = src AND t.user_id = tgt AND s.type = t.type
        AND (
          (s.handle IS NOT NULL AND s.handle = t.handle) OR
          (s.address IS NOT NULL AND s.address = t.address) OR
          (s.external_id IS NOT NULL AND s.external_id = t.external_id)
        );
      UPDATE public.userbase_identities SET user_id = tgt WHERE user_id = src;

      -- Magic links
      UPDATE public.userbase_magic_links SET user_id = tgt WHERE user_id = src;

      -- Hive keys
      UPDATE public.userbase_hive_keys SET user_id = tgt WHERE user_id = src;

      -- Soft posts
      UPDATE public.userbase_soft_posts SET user_id = tgt WHERE user_id = src;

      -- Soft votes: dedupe by (author, permlink), then move remainder
      DELETE FROM public.userbase_soft_votes s
      USING public.userbase_soft_votes t
      WHERE s.user_id = src AND t.user_id = tgt
        AND s.author = t.author AND s.permlink = t.permlink;
      UPDATE public.userbase_soft_votes SET user_id = tgt WHERE user_id = src;

      -- Revoke source sessions
      UPDATE public.userbase_sessions
        SET revoked_at = now()
      WHERE user_id = src AND revoked_at IS NULL;

      -- Drop stale challenges
      DELETE FROM public.userbase_identity_challenges WHERE user_id = src;

      -- Mark source as merged
      UPDATE public.userbase_users
        SET status = 'merged', handle = null, updated_at = now()
      WHERE id = src;

      -- Backfill target profile (target wins on conflict)
      UPDATE public.userbase_users
        SET
          handle       = coalesce(handle,       src_row.handle),
          display_name = coalesce(display_name, src_row.display_name),
          avatar_url   = coalesce(avatar_url,   src_row.avatar_url),
          cover_url    = coalesce(cover_url,    src_row.cover_url),
          bio          = coalesce(bio,          src_row.bio),
          location     = coalesce(location,     src_row.location),
          updated_at   = now()
      WHERE id = tgt;
    END LOOP;
  END LOOP;

  -- ---- Farcaster duplicates ----
  FOR dup IN
    SELECT
      i.external_id as fid,
      array_agg(i.user_id ORDER BY u.created_at ASC) as user_ids
    FROM public.userbase_identities i
    JOIN public.userbase_users u ON u.id = i.user_id
    WHERE i.type = 'farcaster'
      AND i.external_id IS NOT NULL
      AND u.status = 'active'
    GROUP BY i.external_id
    HAVING count(*) > 1
  LOOP
    tgt := dup.user_ids[1];

    FOR i IN 2..array_length(dup.user_ids, 1) LOOP
      src := dup.user_ids[i];
      SELECT * INTO src_row FROM public.userbase_users WHERE id = src;

      RAISE NOTICE '[Farcaster] Merging % → % (fid: %)', src, tgt, dup.fid;

      DELETE FROM public.userbase_auth_methods s
      USING public.userbase_auth_methods t
      WHERE s.user_id = src AND t.user_id = tgt
        AND s.type = t.type AND s.identifier = t.identifier;
      UPDATE public.userbase_auth_methods SET user_id = tgt WHERE user_id = src;

      DELETE FROM public.userbase_identities s
      USING public.userbase_identities t
      WHERE s.user_id = src AND t.user_id = tgt AND s.type = t.type
        AND (
          (s.handle IS NOT NULL AND s.handle = t.handle) OR
          (s.address IS NOT NULL AND s.address = t.address) OR
          (s.external_id IS NOT NULL AND s.external_id = t.external_id)
        );
      UPDATE public.userbase_identities SET user_id = tgt WHERE user_id = src;

      UPDATE public.userbase_magic_links SET user_id = tgt WHERE user_id = src;
      UPDATE public.userbase_hive_keys SET user_id = tgt WHERE user_id = src;
      UPDATE public.userbase_soft_posts SET user_id = tgt WHERE user_id = src;

      DELETE FROM public.userbase_soft_votes s
      USING public.userbase_soft_votes t
      WHERE s.user_id = src AND t.user_id = tgt
        AND s.author = t.author AND s.permlink = t.permlink;
      UPDATE public.userbase_soft_votes SET user_id = tgt WHERE user_id = src;

      UPDATE public.userbase_sessions
        SET revoked_at = now()
      WHERE user_id = src AND revoked_at IS NULL;

      DELETE FROM public.userbase_identity_challenges WHERE user_id = src;

      UPDATE public.userbase_users
        SET status = 'merged', handle = null, updated_at = now()
      WHERE id = src;

      UPDATE public.userbase_users
        SET
          handle       = coalesce(handle,       src_row.handle),
          display_name = coalesce(display_name, src_row.display_name),
          avatar_url   = coalesce(avatar_url,   src_row.avatar_url),
          cover_url    = coalesce(cover_url,    src_row.cover_url),
          bio          = coalesce(bio,          src_row.bio),
          location     = coalesce(location,     src_row.location),
          updated_at   = now()
      WHERE id = tgt;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Duplicate cleanup complete.';
END $$;

-- ============================================================================
-- STEP 3: Verify — should return 0 rows
-- ============================================================================

SELECT
  i.address,
  count(*) as active_user_count
FROM public.userbase_identities i
JOIN public.userbase_users u ON u.id = i.user_id
WHERE i.type = 'evm' AND i.address IS NOT NULL AND u.status = 'active'
GROUP BY i.address
HAVING count(*) > 1;

SELECT
  i.external_id as farcaster_fid,
  count(*) as active_user_count
FROM public.userbase_identities i
JOIN public.userbase_users u ON u.id = i.user_id
WHERE i.type = 'farcaster' AND i.external_id IS NOT NULL AND u.status = 'active'
GROUP BY i.external_id
HAVING count(*) > 1;
