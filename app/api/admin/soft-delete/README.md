# POST /api/admin/soft-delete

Admin-only endpoint to soft-delete a lite account (users table). This sets soft_deleted_at, soft_deleted_by and soft_delete_reason on the users row and creates an audit entry in admin_audit_logs.

Request (JSON):
- target_username (string) - hive account to soft-delete (required)
- reason (string) - optional audit reason
- admin_username (string) - optional; if not provided the server will check x-admin-username header

Security:
- Only usernames present in ADMIN_USERS environment variable are allowed (checked via lib/server/adminUtils.isServerSideAdmin)
- Every attempt (success or failure) is logged via lib/server/adminUtils.logSecurityAttempt and a row is inserted into admin_audit_logs on success.
