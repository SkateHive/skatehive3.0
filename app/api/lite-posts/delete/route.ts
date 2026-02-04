import { NextRequest, NextResponse } from 'next/server';

import { softDeletePost } from '@/lib/supabase/userPosts';

interface SoftDeleteRequestBody {
  author?: string;
  permlink?: string;
  deletedBy?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SoftDeleteRequestBody;
    const author = body.author?.trim();
    const permlink = body.permlink?.trim();
    const deletedBy = body.deletedBy?.trim();

    if (!author || !permlink || !deletedBy) {
      return NextResponse.json(
        { error: 'author, permlink and deletedBy are required' },
        { status: 400 }
      );
    }

    await softDeletePost({
      author,
      permlink,
      deletedBy,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to soft-delete post';
    const status = message.includes('not allowed') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
