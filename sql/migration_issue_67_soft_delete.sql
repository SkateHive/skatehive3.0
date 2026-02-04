-- Issue #67: Soft delete system for lite accounts
-- Preserves posts for audit while hiding deleted content from public queries.

ALTER TABLE user_posts
ADD COLUMN IF NOT EXISTS deleted BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_user_posts_deleted
ON user_posts (deleted);

CREATE INDEX IF NOT EXISTS idx_user_posts_deleted_at
ON user_posts (deleted_at);

CREATE TABLE IF NOT EXISTS user_post_delete_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author VARCHAR(50) NOT NULL,
  permlink VARCHAR(255) NOT NULL,
  deleted_by VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  reason TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_post_delete_audit_author_permlink
ON user_post_delete_audit (author, permlink);

CREATE INDEX IF NOT EXISTS idx_user_post_delete_audit_logged_at
ON user_post_delete_audit (logged_at DESC);
