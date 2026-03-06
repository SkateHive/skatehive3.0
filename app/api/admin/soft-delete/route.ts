import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isServerSideAdmin, logSecurityAttempt, createUnauthorizedResponse } from '@/lib/server/adminUtils';

// Supabase service-role client for admin DB operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false }
  }
);

interface SoftDeleteRequest {
  target_username: string;
  reason?: string;
  admin_username?: string; // optional - will be validated
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SoftDeleteRequest;
    const { target_username, reason, admin_username } = body;

    if (!target_username) {
      return NextResponse.json({ success: false, message: 'Missing target_username' }, { status: 400 });
    }

    // Validate admin
    const adminUser = admin_username || request.headers.get('x-admin-username') || undefined;
    const isAdmin = isServerSideAdmin(adminUser || '');

    // Log the attempt for auditing
    logSecurityAttempt(adminUser, `soft-delete:${target_username}`, request, isAdmin);

    if (!isAdmin) {
      return createUnauthorizedResponse();
    }

    // Perform soft-delete: set soft_deleted_at, soft_deleted_by, soft_delete_reason
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('users')
      .update({
        soft_deleted_at: now,
        soft_deleted_by: adminUser,
        soft_delete_reason: reason || null
      })
      .eq('hive_account', target_username);

    if (updateError) {
      console.error('Error soft-deleting user:', updateError);
      return NextResponse.json({ success: false, message: 'Database update failed' }, { status: 500 });
    }

    // Insert audit log entry
    const { error: auditError } = await supabase
      .from('admin_audit_logs')
      .insert({
        admin_user: adminUser || 'unknown',
        operation: 'soft_delete_user',
        target_user: target_username,
        details: { reason: reason || null },
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown'
      });

    if (auditError) {
      console.error('Error inserting audit log:', auditError);
      // don't fail the operation on audit log error, but warn
    }

    return NextResponse.json({ success: true, message: 'User soft-deleted' });

  } catch (err) {
    console.error('Soft-delete API error:', err);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
