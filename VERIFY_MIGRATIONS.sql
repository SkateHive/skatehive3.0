-- ============================================================================
-- VERIFY MIGRATIONS 0017 & 0018 APPLIED SUCCESSFULLY
-- ============================================================================
-- Run these queries in Supabase SQL Editor to verify everything worked

-- ============================================================================
-- 1. CHECK TABLES (Should show exactly 8 userbase tables)
-- ============================================================================
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'userbase_%'
ORDER BY tablename;

-- Expected output (8 tables):
-- userbase_auth_methods
-- userbase_hive_keys
-- userbase_identities
-- userbase_sessions
-- userbase_soft_posts
-- userbase_soft_votes
-- userbase_sponsorships
-- userbase_users

-- ============================================================================
-- 2. CHECK NEW INDEXES (From migration 0017)
-- ============================================================================
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'userbase_%'
  AND (
    indexname LIKE '%status_created%' OR
    indexname LIKE '%user_created_type%' OR
    indexname LIKE '%user_active%' OR
    indexname LIKE '%hive_username_status%'
  )
ORDER BY tablename, indexname;

-- Expected new indexes:
-- userbase_sessions_user_active_idx
-- userbase_soft_posts_status_created_idx
-- userbase_soft_posts_user_created_type_idx
-- userbase_soft_votes_status_created_idx
-- userbase_sponsorships_hive_username_status_idx

-- ============================================================================
-- 3. CHECK CONSTRAINTS (From migration 0017)
-- ============================================================================
SELECT
  conrelid::regclass AS table_name,
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid::regclass::text LIKE 'userbase_%'
  AND contype = 'c' -- Check constraints only
  AND (
    conname LIKE 'valid_%' OR
    conname LIKE '%email%' OR
    conname LIKE '%vote%' OR
    conname LIKE '%hive%'
  )
ORDER BY table_name, constraint_name;

-- Expected constraints:
-- userbase_auth_methods: valid_email_format
-- userbase_hive_keys: valid_hive_username
-- userbase_soft_votes: valid_vote_weight
-- userbase_sponsorships: valid_sponsorship_hive_username

-- ============================================================================
-- 4. CHECK FUNCTIONS (From migration 0017)
-- ============================================================================
SELECT
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments,
  pg_get_function_result(oid) AS return_type
FROM pg_proc
WHERE proname IN (
  'cleanup_expired_sessions',
  'cleanup_old_failed_soft_content'
)
ORDER BY proname;

-- Expected functions:
-- cleanup_expired_sessions() → TABLE(deleted_count integer, oldest_deleted timestamptz)
-- cleanup_old_failed_soft_content() → TABLE(deleted_posts integer, deleted_votes integer)

-- ============================================================================
-- 5. VERIFY DROPPED TABLES (Should return 0 rows)
-- ============================================================================
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'userbase_user_keys',
    'userbase_secrets',
    'userbase_key_usage_audit',
    'userbase_community_memberships',
    'userbase_merge_audit'
  );

-- Expected: 0 rows (all legacy tables dropped)

-- ============================================================================
-- 6. TEST CLEANUP FUNCTIONS
-- ============================================================================
-- Test session cleanup (should be safe to run)
SELECT * FROM cleanup_expired_sessions();
-- Returns: (deleted_count: N, oldest_deleted: timestamp or NULL)

-- Test failed content cleanup (should be safe to run)
SELECT * FROM cleanup_old_failed_soft_content();
-- Returns: (deleted_posts: N, deleted_votes: N)

-- ============================================================================
-- 7. CHECK TABLE SIZES (Monitor for bloat)
-- ============================================================================
SELECT
  tablename,
  pg_size_pretty(pg_relation_size('public.'||tablename)) AS table_size,
  pg_size_pretty(pg_total_relation_size('public.'||tablename) - pg_relation_size('public.'||tablename)) AS indexes_size,
  pg_size_pretty(pg_total_relation_size('public.'||tablename)) AS total_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'userbase_%'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;

-- ============================================================================
-- 8. CHECK INDEX USAGE (After some usage)
-- ============================================================================
-- Run this after your app has been running for a while
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan AS times_used,
  idx_tup_read AS rows_read,
  idx_tup_fetch AS rows_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename LIKE 'userbase_%'
  AND indexname LIKE '%status_created%'
ORDER BY idx_scan DESC;

-- ============================================================================
-- 9. VERIFY ROW COUNTS (Sanity check)
-- ============================================================================
SELECT 'userbase_users' AS table_name, COUNT(*) AS row_count FROM userbase_users
UNION ALL
SELECT 'userbase_sessions', COUNT(*) FROM userbase_sessions
UNION ALL
SELECT 'userbase_identities', COUNT(*) FROM userbase_identities
UNION ALL
SELECT 'userbase_hive_keys', COUNT(*) FROM userbase_hive_keys
UNION ALL
SELECT 'userbase_sponsorships', COUNT(*) FROM userbase_sponsorships
UNION ALL
SELECT 'userbase_soft_posts', COUNT(*) FROM userbase_soft_posts
UNION ALL
SELECT 'userbase_soft_votes', COUNT(*) FROM userbase_soft_votes
UNION ALL
SELECT 'userbase_auth_methods', COUNT(*) FROM userbase_auth_methods
ORDER BY table_name;

-- ============================================================================
-- SUCCESS CRITERIA
-- ============================================================================
-- ✅ Query 1: Shows exactly 8 tables
-- ✅ Query 2: Shows 5 new indexes
-- ✅ Query 3: Shows 4 new constraints
-- ✅ Query 4: Shows 2 cleanup functions
-- ✅ Query 5: Returns 0 rows (no legacy tables)
-- ✅ Query 6: Functions run without errors
-- ✅ Query 7: Table sizes look reasonable
-- ✅ Query 9: Row counts match your expectations

-- If all checks pass: ✅ Migrations successful!
-- If any checks fail: ⚠️ Review error messages and check migration logs
