-- Curation-trail opt-out for posting keys.
-- Everyone is opt-IN by default (column defaults to false). When a user unchecks
-- "Support SkateHive official posts" in Settings, trail_opt_out flips to true and
-- the marketing portal's trail excludes them from boosting official posts.
--
-- Apply in the SkateHive userbase Supabase (SQL editor). Idempotent.

ALTER TABLE userbase_hive_keys
  ADD COLUMN IF NOT EXISTS trail_opt_out boolean NOT NULL DEFAULT false;

-- Optional: index for the portal's filtered read (small table, not required).
CREATE INDEX IF NOT EXISTS idx_userbase_hive_keys_trail_opt_out
  ON userbase_hive_keys (trail_opt_out);
