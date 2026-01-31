-- 0018_drop_unused_and_legacy_tables.sql
-- Clean up unused and legacy tables for fresh start

-- ============================================================================
-- DROP TRULY UNUSED TABLES
-- ============================================================================
-- These tables were never used in the codebase

-- Drop community memberships (planned feature, never implemented)
DROP TABLE IF EXISTS public.userbase_community_memberships CASCADE;

-- Drop merge audit (replaced by different approach)
DROP TABLE IF EXISTS public.userbase_merge_audit CASCADE;

COMMENT ON SCHEMA public IS 'Dropped unused tables: userbase_community_memberships, userbase_merge_audit';

-- ============================================================================
-- DROP LEGACY KEY STORAGE SYSTEM
-- ============================================================================
-- Old system: userbase_user_keys + userbase_secrets + userbase_key_usage_audit
-- New system: userbase_hive_keys (simpler, better encryption)
-- Since we're still in development, start clean with new system only

-- Drop key usage audit table (old system tracking)
DROP TABLE IF EXISTS public.userbase_key_usage_audit CASCADE;

-- Drop secrets table (old encrypted keys storage)
DROP TABLE IF EXISTS public.userbase_secrets CASCADE;

-- Drop user keys registry (old system)
DROP TABLE IF EXISTS public.userbase_user_keys CASCADE;

COMMENT ON SCHEMA public IS 'Dropped legacy key system tables. Using userbase_hive_keys only.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify tables were dropped:

-- SELECT tablename
-- FROM pg_tables
-- WHERE schemaname = 'public'
--   AND tablename LIKE 'userbase_%'
-- ORDER BY tablename;

-- Expected remaining tables (10 total):
-- - userbase_auth_methods
-- - userbase_hive_keys (NEW key system)
-- - userbase_identities
-- - userbase_identity_challenges
-- - userbase_magic_links
-- - userbase_sessions
-- - userbase_soft_posts
-- - userbase_soft_votes
-- - userbase_sponsorships
-- - userbase_users

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- If you need to rollback, re-run migration 0001_userbase.sql to recreate:
-- - userbase_user_keys
-- - userbase_secrets
-- - userbase_key_usage_audit
-- - userbase_community_memberships
--
-- And re-run 0011_userbase_merge_audit.sql to recreate:
-- - userbase_merge_audit
--
-- Then restore any data from backup if it existed.
