import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SPONSORSHIP_CONFIG } from '@/config/app.config';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

interface EligibilityResponse {
  eligible: boolean;
  reason?: string;
}

/**
 * GET /api/userbase/sponsorships/eligible/[user_id]
 * Checks if a lite account can be sponsored
 * Simplified: Any Hive user can sponsor any lite account
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ user_id: string }> }
): Promise<NextResponse<EligibilityResponse>> {
  if (!supabase) {
    return NextResponse.json(
      { eligible: false, reason: 'Missing Supabase configuration' },
      { status: 500 }
    );
  }

  const { user_id: userId } = await params;

  try {
    // 1. Check if user exists and is active
    const { data: user, error: userError } = await supabase
      .from('userbase_users')
      .select('id, status')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { eligible: false, reason: 'User not found' },
        { status: 404 }
      );
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { eligible: false, reason: 'Account is not active' },
        { status: 200 }
      );
    }

    // 2. Check if already sponsored
    const { data: existingSponsorship } = await supabase
      .from('userbase_sponsorships')
      .select('id, status')
      .eq('lite_user_id', userId)
      .single();

    if (existingSponsorship) {
      return NextResponse.json(
        {
          eligible: false,
          reason:
            existingSponsorship.status === 'completed'
              ? 'Already sponsored'
              : 'Sponsorship pending',
        },
        { status: 200 }
      );
    }

    // 3. Check if user already has a Hive identity
    const { data: hiveIdentity } = await supabase
      .from('userbase_identities')
      .select('id')
      .eq('user_id', userId)
      .eq('type', 'hive')
      .single();

    if (hiveIdentity) {
      return NextResponse.json(
        { eligible: false, reason: 'Already has Hive account' },
        { status: 200 }
      );
    }

    // All checks passed - lite account ready for sponsorship!
    return NextResponse.json(
      {
        eligible: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error checking sponsorship eligibility:', error);
    return NextResponse.json(
      { eligible: false, reason: 'Internal server error' },
      { status: 500 }
    );
  }
}
