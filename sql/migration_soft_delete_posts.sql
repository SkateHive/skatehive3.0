-- Migration: Soft Delete Support for Posts (snaps/comments)
-- Adds optional soft-delete columns to posts/comments table for systems that mirror on-chain content

-- These columns are added conditionally if a posts table exists. The migration is safe to run multiple times.

ALTER TABLE IF EXISTS posts
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS soft_deleted_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS soft_delete_reason TEXT;

-- If the project uses a different table name (e.g. "userbase_posts"), include safe ALTER statements as well
ALTER TABLE IF EXISTS userbase_posts
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS soft_deleted_by VARCHAR(100),
  ADD COLUMN IF NOT EXISTS soft_delete_reason TEXT;

-- Add indexes to speed up queries that filter out deleted content
CREATE INDEX IF NOT EXISTS idx_posts_soft_deleted_at ON posts(soft_deleted_at);
CREATE INDEX IF NOT EXISTS idx_userbase_posts_soft_deleted_at ON userbase_posts(soft_deleted_at);

-- Note: RLS policies are not modified by this migration. Ensure service role or admin can update these columns.
