-- 0019c_manual_merges.sql
-- Manual merges identified by inspecting the user database.
-- All operations use inline SQL (no function call) to work from the SQL editor.
--
-- ============================================================================
-- SECTION A: Clear merges — same person, same username, different identity type
-- ============================================================================

DO $$
DECLARE src_row RECORD;
BEGIN

  -- ------------------------------------------------------------------
  -- A1. vaipraonde
  --     canonical: 397ec18e (farcaster:vaipraonde, oldest, Jan 30)
  --     duplicate: 63a46d41 (hive:vaipraonde, Feb 26)
  -- ------------------------------------------------------------------
  SELECT * INTO src_row FROM public.userbase_users WHERE id = '63a46d41-4315-4e6a-8b42-f029f6357bd0';

  DELETE FROM public.userbase_auth_methods s USING public.userbase_auth_methods t
    WHERE s.user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0' AND t.user_id = '397ec18e-c1ae-414d-8a91-f91e9f54ca20'
      AND s.type = t.type AND s.identifier = t.identifier;
  UPDATE public.userbase_auth_methods SET user_id = '397ec18e-c1ae-414d-8a91-f91e9f54ca20' WHERE user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0';

  DELETE FROM public.userbase_identities s USING public.userbase_identities t
    WHERE s.user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0' AND t.user_id = '397ec18e-c1ae-414d-8a91-f91e9f54ca20'
      AND s.type = t.type AND ((s.handle IS NOT NULL AND s.handle = t.handle) OR (s.address IS NOT NULL AND s.address = t.address) OR (s.external_id IS NOT NULL AND s.external_id = t.external_id));
  UPDATE public.userbase_identities SET user_id = '397ec18e-c1ae-414d-8a91-f91e9f54ca20' WHERE user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0';

  UPDATE public.userbase_magic_links   SET user_id = '397ec18e-c1ae-414d-8a91-f91e9f54ca20' WHERE user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0';
  UPDATE public.userbase_hive_keys     SET user_id = '397ec18e-c1ae-414d-8a91-f91e9f54ca20' WHERE user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0';
  UPDATE public.userbase_soft_posts    SET user_id = '397ec18e-c1ae-414d-8a91-f91e9f54ca20' WHERE user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0';

  DELETE FROM public.userbase_soft_votes s USING public.userbase_soft_votes t
    WHERE s.user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0' AND t.user_id = '397ec18e-c1ae-414d-8a91-f91e9f54ca20' AND s.author = t.author AND s.permlink = t.permlink;
  UPDATE public.userbase_soft_votes SET user_id = '397ec18e-c1ae-414d-8a91-f91e9f54ca20' WHERE user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0';

  UPDATE public.userbase_sessions SET revoked_at = now() WHERE user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0' AND revoked_at IS NULL;
  DELETE FROM public.userbase_identity_challenges WHERE user_id = '63a46d41-4315-4e6a-8b42-f029f6357bd0';

  UPDATE public.userbase_users SET status = 'merged', handle = null, updated_at = now() WHERE id = '63a46d41-4315-4e6a-8b42-f029f6357bd0';
  UPDATE public.userbase_users SET
    display_name = coalesce(display_name, src_row.display_name),
    avatar_url   = coalesce(avatar_url,   src_row.avatar_url),
    bio          = coalesce(bio,          src_row.bio),
    location     = coalesce(location,     src_row.location),
    updated_at   = now()
  WHERE id = '397ec18e-c1ae-414d-8a91-f91e9f54ca20';

  RAISE NOTICE 'A1: vaipraonde merged OK';

  -- ------------------------------------------------------------------
  -- A2. keanucheese
  --     canonical: f95c24d3 (hive:keanucheese, oldest, Feb 7)
  --     duplicate: 5ebe9eb9 (evm:keanucheese.eth, Feb 17)
  -- ------------------------------------------------------------------
  SELECT * INTO src_row FROM public.userbase_users WHERE id = '5ebe9eb9-c997-4649-b7b7-face519abcc7';

  DELETE FROM public.userbase_auth_methods s USING public.userbase_auth_methods t
    WHERE s.user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7' AND t.user_id = 'f95c24d3-c0d1-405a-81ce-cc73fbe93018'
      AND s.type = t.type AND s.identifier = t.identifier;
  UPDATE public.userbase_auth_methods SET user_id = 'f95c24d3-c0d1-405a-81ce-cc73fbe93018' WHERE user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7';

  DELETE FROM public.userbase_identities s USING public.userbase_identities t
    WHERE s.user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7' AND t.user_id = 'f95c24d3-c0d1-405a-81ce-cc73fbe93018'
      AND s.type = t.type AND ((s.handle IS NOT NULL AND s.handle = t.handle) OR (s.address IS NOT NULL AND s.address = t.address) OR (s.external_id IS NOT NULL AND s.external_id = t.external_id));
  UPDATE public.userbase_identities SET user_id = 'f95c24d3-c0d1-405a-81ce-cc73fbe93018' WHERE user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7';

  UPDATE public.userbase_magic_links   SET user_id = 'f95c24d3-c0d1-405a-81ce-cc73fbe93018' WHERE user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7';
  UPDATE public.userbase_hive_keys     SET user_id = 'f95c24d3-c0d1-405a-81ce-cc73fbe93018' WHERE user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7';
  UPDATE public.userbase_soft_posts    SET user_id = 'f95c24d3-c0d1-405a-81ce-cc73fbe93018' WHERE user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7';

  DELETE FROM public.userbase_soft_votes s USING public.userbase_soft_votes t
    WHERE s.user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7' AND t.user_id = 'f95c24d3-c0d1-405a-81ce-cc73fbe93018' AND s.author = t.author AND s.permlink = t.permlink;
  UPDATE public.userbase_soft_votes SET user_id = 'f95c24d3-c0d1-405a-81ce-cc73fbe93018' WHERE user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7';

  UPDATE public.userbase_sessions SET revoked_at = now() WHERE user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7' AND revoked_at IS NULL;
  DELETE FROM public.userbase_identity_challenges WHERE user_id = '5ebe9eb9-c997-4649-b7b7-face519abcc7';

  UPDATE public.userbase_users SET status = 'merged', handle = null, updated_at = now() WHERE id = '5ebe9eb9-c997-4649-b7b7-face519abcc7';
  UPDATE public.userbase_users SET
    display_name = coalesce(display_name, src_row.display_name),
    avatar_url   = coalesce(avatar_url,   src_row.avatar_url),
    bio          = coalesce(bio,          src_row.bio),
    location     = coalesce(location,     src_row.location),
    updated_at   = now()
  WHERE id = 'f95c24d3-c0d1-405a-81ce-cc73fbe93018';

  RAISE NOTICE 'A2: keanucheese merged OK';

END $$;


-- ============================================================================
-- SECTION B: Burst groups — multiple wallet accounts created within seconds
--            (same browser session, same person with multiple wallets)
--
-- Review each group before running. Each merges into the OLDEST account.
-- Comment out any group you are NOT sure about.
-- ============================================================================

-- Temporary helper procedure (dropped at the end)
CREATE OR REPLACE PROCEDURE _merge_into(src uuid, tgt uuid)
LANGUAGE plpgsql AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM public.userbase_users WHERE id = src;

  DELETE FROM public.userbase_auth_methods s USING public.userbase_auth_methods t
    WHERE s.user_id = src AND t.user_id = tgt AND s.type = t.type AND s.identifier = t.identifier;
  UPDATE public.userbase_auth_methods SET user_id = tgt WHERE user_id = src;

  DELETE FROM public.userbase_identities s USING public.userbase_identities t
    WHERE s.user_id = src AND t.user_id = tgt AND s.type = t.type
      AND ((s.handle IS NOT NULL AND s.handle = t.handle) OR (s.address IS NOT NULL AND s.address = t.address) OR (s.external_id IS NOT NULL AND s.external_id = t.external_id));

  -- Demote is_primary on source identities where target already has a primary of that type,
  -- to avoid violating the (user_id, type) WHERE is_primary = true unique constraint.
  UPDATE public.userbase_identities s
    SET is_primary = false
  FROM public.userbase_identities t
  WHERE s.user_id = src AND t.user_id = tgt
    AND s.type = t.type AND s.is_primary = true AND t.is_primary = true;

  UPDATE public.userbase_identities SET user_id = tgt WHERE user_id = src;

  UPDATE public.userbase_magic_links SET user_id = tgt WHERE user_id = src;
  UPDATE public.userbase_hive_keys   SET user_id = tgt WHERE user_id = src;
  UPDATE public.userbase_soft_posts  SET user_id = tgt WHERE user_id = src;

  DELETE FROM public.userbase_soft_votes s USING public.userbase_soft_votes t
    WHERE s.user_id = src AND t.user_id = tgt AND s.author = t.author AND s.permlink = t.permlink;
  UPDATE public.userbase_soft_votes SET user_id = tgt WHERE user_id = src;

  UPDATE public.userbase_sessions SET revoked_at = now() WHERE user_id = src AND revoked_at IS NULL;
  DELETE FROM public.userbase_identity_challenges WHERE user_id = src;

  UPDATE public.userbase_users SET status = 'merged', handle = null, updated_at = now() WHERE id = src;
  UPDATE public.userbase_users SET
    display_name = coalesce(display_name, r.display_name),
    avatar_url   = coalesce(avatar_url,   r.avatar_url),
    bio          = coalesce(bio,          r.bio),
    location     = coalesce(location,     r.location),
    updated_at   = now()
  WHERE id = tgt;
END;
$$;

DO $$
BEGIN

  -- B1: 2026-03-14 00:12 — 3 wallets in 25s → keep wallet-d74cf8 (oldest)
  -- wallet-d74cf8 (2c6111d5), wallet-90822e (0f4a5e6e), wallet-e82e8f (68310509)
  CALL _merge_into('0f4a5e6e-63a0-40d9-b935-bd63b7210b4a', '2c6111d5-1206-4fd7-83d8-13a21a5d441c');
  CALL _merge_into('68310509-f7eb-4383-b40d-92183b967d70', '2c6111d5-1206-4fd7-83d8-13a21a5d441c');
  RAISE NOTICE 'B1: 2026-03-14 00:12 burst merged OK';

  -- B2: 2026-03-13 23:34 — 5 wallets in 45s → keep wallet-d39bdb (oldest)
  -- wallet-d39bdb (535dd072), wallet-bd73cf (7ccff220), wallet-3ed2a5 (d93b7739),
  -- wallet-c658f7 (d953148d), wallet-359df3 (b83c30e5)
  CALL _merge_into('7ccff220-079c-4998-a577-8c9d256451b8', '535dd072-c128-40b7-9670-9f2bb60198e0');
  CALL _merge_into('d93b7739-8008-4d83-8fda-d8f908e861f0', '535dd072-c128-40b7-9670-9f2bb60198e0');
  CALL _merge_into('d953148d-4aaa-4eff-b1a0-c77a67809ff1', '535dd072-c128-40b7-9670-9f2bb60198e0');
  CALL _merge_into('b83c30e5-254b-46e7-8ccf-80466ef50dd3', '535dd072-c128-40b7-9670-9f2bb60198e0');
  RAISE NOTICE 'B2: 2026-03-13 23:34 burst merged OK';

  -- B3: 2026-03-12 20:31 — 3 wallets in 2s → keep wallet-81a8be (oldest)
  -- wallet-81a8be (b1828521), wallet-ebfaa3 (61f6226f), wallet-3b597f (72b40b6e)
  CALL _merge_into('61f6226f-a93a-40ee-a96a-3a6ceb4403bc', 'b1828521-213b-4a0e-ac3d-99be0291bde9');
  CALL _merge_into('72b40b6e-3b77-4583-9319-51429c0267ad', 'b1828521-213b-4a0e-ac3d-99be0291bde9');
  RAISE NOTICE 'B3: 2026-03-12 20:31 burst merged OK';

  -- B4: 2026-03-12 20:29 — 2 wallets in 2s → keep wallet-0bf3c0 (oldest)
  -- wallet-0bf3c0 (a9438159), wallet-cb058c (018c8260)
  CALL _merge_into('018c8260-d6cf-4fd8-9b49-060908fa44ee', 'a9438159-1753-4b37-801b-4290bdfb3300');
  RAISE NOTICE 'B4: 2026-03-12 20:29 burst merged OK';

  -- B5: 2026-03-11 16:35 — 3 wallets in 18s → keep wallet-d6cbdc (oldest)
  -- wallet-d6cbdc (0955a8f5), wallet-37017c (0577c54a), wallet-590d72 (a9c92463)
  CALL _merge_into('0577c54a-45e8-4f42-b9f7-fc6a60b72d89', '0955a8f5-9244-4b88-ae4c-9f90fb6746a6');
  CALL _merge_into('a9c92463-bd3f-4e91-9e4e-69887be64457', '0955a8f5-9244-4b88-ae4c-9f90fb6746a6');
  RAISE NOTICE 'B5: 2026-03-11 16:35 burst merged OK';

  -- B6: 2026-03-11 11:14 — 3 wallets in 7s → keep wallet-a643ae (oldest)
  -- wallet-a643ae (f7681b38), wallet-beba3c (1ddff586), wallet-762fba (bf016684)
  CALL _merge_into('1ddff586-eee9-4718-8edc-f553938658a7', 'f7681b38-9de8-4e9b-9ac0-077ad42787c0');
  CALL _merge_into('bf016684-0f0d-4dde-9f2d-f489e25c60ed', 'f7681b38-9de8-4e9b-9ac0-077ad42787c0');
  RAISE NOTICE 'B6: 2026-03-11 11:14 burst merged OK';

  -- B7: 2026-03-11 04:29 — 3 wallets in 22s → keep wallet-0fc1e5 (oldest)
  -- wallet-0fc1e5 (35911a09), wallet-66666e (b42eb5f3), wallet-eff867 (8cb99579)
  CALL _merge_into('b42eb5f3-0ba3-46f1-844f-28b0b53d626d', '35911a09-b667-42fc-ac9c-598ebd79c286');
  CALL _merge_into('8cb99579-0d92-46b9-ae10-cc906a951d0d', '35911a09-b667-42fc-ac9c-598ebd79c286');
  RAISE NOTICE 'B7: 2026-03-11 04:29 burst merged OK';

  -- B8: 2026-03-11 03:06 — 2 wallets in 13s → keep wallet-647478 (oldest)
  -- wallet-647478 (02b5d535), wallet-0080b8 (a58ddbb8)
  CALL _merge_into('a58ddbb8-5c0d-4d4d-88e0-d7e052065a38', '02b5d535-396b-4ebd-8645-c985bd8fe0ed');
  RAISE NOTICE 'B8: 2026-03-11 03:06 burst merged OK';

  -- B9: 2026-02-21 22:28 — 2 wallets in 9s → keep wallet-76e1c0 (oldest)
  -- wallet-76e1c0 (327fc171), wallet-476942 (0b15414d)
  CALL _merge_into('0b15414d-1bf0-4782-8a20-d450a0880c25', '327fc171-130e-4f40-9947-cfb6accc69e4');
  RAISE NOTICE 'B9: 2026-02-21 burst merged OK';

  -- B10: 2026-02-14 21:49 — 3 wallets in 7s → keep wallet-feb02e (oldest)
  -- wallet-feb02e (7da17e27), wallet-852a3b (9b214b35), wallet-beb91a (6e727a82)
  CALL _merge_into('9b214b35-d6c5-4e88-8dde-6f12a3e9bde4', '7da17e27-d743-496b-8e50-bfc2dafefd70');
  CALL _merge_into('6e727a82-4f0f-419f-8064-047a17e585f9', '7da17e27-d743-496b-8e50-bfc2dafefd70');
  RAISE NOTICE 'B10: 2026-02-14 burst merged OK';

END $$;

-- Drop temporary helper
DROP PROCEDURE IF EXISTS _merge_into(uuid, uuid);

-- ============================================================================
-- VERIFY: active user count before vs after
-- ============================================================================
SELECT count(*) as active_users FROM public.userbase_users WHERE status = 'active';
SELECT count(*) as merged_users FROM public.userbase_users WHERE status = 'merged';
