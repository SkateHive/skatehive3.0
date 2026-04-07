import { NextResponse } from 'next/server';
import { getSponsorClaimedAccounts } from '@/lib/hive/accountCreation';
import { SPONSORSHIP_CONFIG } from '@/config/app.config';

/**
 * GET /api/userbase/sponsorships/acc-status
 *
 * Returns the number of ACC tokens available on the platform account.
 * Used by the sponsorship modal to decide whether to show the free ACC option.
 */
export async function GET() {
  const platformAccount = SPONSORSHIP_CONFIG.PLATFORM_ACC_ACCOUNT;

  if (!platformAccount) {
    return NextResponse.json({ available: 0, account: null });
  }

  const available = await getSponsorClaimedAccounts(platformAccount);
  return NextResponse.json({ available, account: platformAccount });
}
