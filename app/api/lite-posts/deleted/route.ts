import { NextResponse } from 'next/server';

import { listSoftDeletedPostKeys } from '@/lib/supabase/userPosts';

export async function GET() {
  try {
    const deletedPosts = await listSoftDeletedPostKeys();
    return NextResponse.json({ data: deletedPosts }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to fetch deleted posts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
