import { NextRequest, NextResponse } from 'next/server';
import { editPostAsSkatedev } from '@/lib/hive/server-actions';
import { isServerSideAdmin, logSecurityAttempt, createUnauthorizedResponse } from '@/lib/server/adminUtils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { author, permlink, updates, admin_username } = body || {};

    const adminUser = admin_username || request.headers.get('x-admin-username') || undefined;
    const isAdmin = isServerSideAdmin(adminUser || '');
    logSecurityAttempt(adminUser, `edit-post:${author}/${permlink}`, request, isAdmin);

    if (!isAdmin) {
      return createUnauthorizedResponse();
    }

    if (!author || !permlink || !updates || typeof updates !== 'object') {
      return NextResponse.json({ success: false, message: 'Missing required parameters' }, { status: 400 });
    }

    const result = await editPostAsSkatedev({
      author,
      permlink,
      title: updates.title,
      body: updates.body,
      bodyAppend: updates.bodyAppend,
      tags: Array.isArray(updates.tags) ? updates.tags : undefined,
      metadataUpdates: updates.metadataUpdates,
    });

    if (result.success) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, message: result.error || 'Unknown error' }, { status: 500 });
  } catch (error) {
    console.error('API edit post error:', error);
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
