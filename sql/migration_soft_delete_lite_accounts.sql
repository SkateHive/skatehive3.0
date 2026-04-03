-- Migration: Soft Delete System for Lite Accounts
-- Adds soft-delete columns to users table and creates admin_audit_logs for audit trail

-- Add soft delete columns to users
ALTER TABLE IF EXISTS users
    ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS soft_deleted_by VARCHAR(50),
    ADD COLUMN IF NOT EXISTS soft_delete_reason TEXT;

-- Create table to record admin audit logs
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user VARCHAR(50) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    target_user VARCHAR(50),
    details JSONB,
    ip VARCHAR(128),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for queries by target_user
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_user ON admin_audit_logs(target_user);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_user ON admin_audit_logs(admin_user);

-- Grant minimal RLS: service role can insert/select
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage admin_audit_logs" ON admin_audit_logs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Add comment explaining purpose
COMMENT ON TABLE admin_audit_logs IS 'Audit logs for admin operations (soft-delete, restore, other sensitive actions)';
