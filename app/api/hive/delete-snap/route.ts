import { NextRequest, NextResponse } from 'next/server';
import { deletePostAsSkatedev } from '@/lib/hive/server-actions';

// Simple auth using SIGNER_TOKEN header (same pattern as other internal endpoints)
const SIGNER_TOKEN = process.env.SIGNER_TOKEN || process.env.NEXT_PUBLIC_SIGNER_TOKEN || process.env.SIGNER_TOKEN;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { author, permlink } = body || {};

    if (!author || !permlink) {
      return NextResponse.json({ success: false, message: 'Missing author or permlink' }, { status: 400 });
    }

    const headerToken = request.headers.get('x-signer-token') || '';
    if (!SIGNER_TOKEN || headerToken !== SIGNER_TOKEN) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    // Only allow deleting posts authored by app account
    const result = await deletePostAsSkatedev({ author, permlink });

    if (!result.success) {
      return NextResponse.json({ success: false, message: result.error || 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete snap API error:', err);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
