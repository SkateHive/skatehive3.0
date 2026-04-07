import { NextRequest, NextResponse } from 'next/server';
import { getSponsorClaimedAccounts } from '@/lib/hive/accountCreation';

/**
 * GET /api/userbase/sponsorships/acc-status?username=steemskate
 *
 * Returns the number of pending claimed account tokens (ACC) for the given
 * Hive account. Used by the sponsorship modal to decide whether to offer
 * the free ACC option for the connected sponsor.
 */
export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get('username');

  if (!username) {
    return NextResponse.json({ available: 0, account: null });
  }

  const available = await getSponsorClaimedAccounts(username);
  return NextResponse.json({ available, account: username });
}
