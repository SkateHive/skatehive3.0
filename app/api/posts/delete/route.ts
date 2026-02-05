import { NextRequest, NextResponse } from 'next/server';
import { isServerSideAdmin, logSecurityAttempt } from '@/lib/server/adminUtils';
import { deletePostAsSkatedev } from '@/lib/hive/server-actions';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminUser, author, permlink } = body || {};

    if (!adminUser || typeof adminUser !== 'string') {
      return NextResponse.json({ success: false, message: 'adminUser is required' }, { status: 400 });
    }

    const isAdmin = isServerSideAdmin(adminUser);
    logSecurityAttempt(adminUser, 'delete post', request, isAdmin);

    if (!isAdmin) {
      return NextResponse.json({ success: false, message: 'Access Denied' }, { status: 403 });
    }

    if (!author || !permlink) {
      return NextResponse.json({ success: false, message: 'author and permlink are required' }, { status: 400 });
    }

    // Only allow deleting posts created by the configured app account
    const appAccount = process.env.NEXT_PUBLIC_APP_ACCOUNT || process.env.APP_ACCOUNT || 'skatedev';
    if (author !== appAccount) {
      return NextResponse.json({ success: false, message: `Can only delete posts authored by ${appAccount}` }, { status: 400 });
    }

    const result = await deletePostAsSkatedev({ author, permlink });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.error || 'Failed to delete post' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in API /api/posts/delete:', error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
