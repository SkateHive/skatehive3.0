import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { SPONSORSHIP_CONFIG } from '@/config/app.config';
import { validateHiveUsernameFormat, checkHiveAccountExists } from '@/lib/utils/hiveAccountUtils';

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

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function getSessionUserId(request: NextRequest) {
  if (!supabase) {
    return {
      error: NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      ),
    };
  }

  const refreshToken = request.cookies.get('userbase_refresh')?.value;
  if (!refreshToken) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const refreshTokenHash = hashToken(refreshToken);
  const { data: sessionRows, error: sessionError } = await supabase
    .from('userbase_sessions')
    .select('id, user_id, expires_at, revoked_at')
    .eq('refresh_token_hash', refreshTokenHash)
    .is('revoked_at', null)
    .limit(1);

  if (sessionError || !sessionRows || sessionRows.length === 0) {
    return {
      error: NextResponse.json({ error: 'Invalid session' }, { status: 401 }),
    };
  }

  const session = sessionRows[0];
  const now = new Date();
  const expiresAt = new Date(session.expires_at);

  if (now > expiresAt) {
    return {
      error: NextResponse.json({ error: 'Session expired' }, { status: 401 }),
    };
  }

  return { userId: session.user_id };
}

interface CreateSponsorshipRequest {
  lite_user_id: string;
  hive_username: string;
  cost_type: 'hive_transfer' | 'account_token';
  cost_amount?: number;
  hive_tx_id?: string;
}

interface CreateSponsorshipResponse {
  success: boolean;
  sponsorship_id?: string;
  error?: string;
}

/**
 * POST /api/userbase/sponsorships/create
 * Creates a pending sponsorship record
 * Called after sponsor signs the transaction with Keychain
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateSponsorshipResponse>> {
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Missing Supabase configuration' },
      { status: 500 }
    );
  }

  // Get current user (sponsor)
  const auth = await getSessionUserId(request);
  if (auth.error) {
    return auth.error as NextResponse<CreateSponsorshipResponse>;
  }
  const sponsorUserId = auth.userId!;

  try {
    const body: CreateSponsorshipRequest = await request.json();
    const { lite_user_id, hive_username, cost_type, cost_amount, hive_tx_id } = body;

    // Validate required fields
    if (!lite_user_id || !hive_username || !cost_type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1. Verify sponsor is not the same as lite user
    if (sponsorUserId === lite_user_id) {
      return NextResponse.json(
        { success: false, error: 'Cannot sponsor yourself' },
        { status: 400 }
      );
    }

    // 2. Check sponsor has Hive identity
    const { data: sponsorHiveIdentity, error: sponsorIdentityError } = await supabase
      .from('userbase_identities')
      .select('handle')
      .eq('user_id', sponsorUserId)
      .eq('type', 'hive')
      .single();

    if (sponsorIdentityError || !sponsorHiveIdentity) {
      return NextResponse.json(
        { success: false, error: 'Sponsor must have a linked Hive account' },
        { status: 403 }
      );
    }

    // 3. Validate Hive username format
    const usernameValidation = validateHiveUsernameFormat(hive_username);
    if (!usernameValidation.isValid) {
      return NextResponse.json(
        { success: false, error: usernameValidation.error || 'Invalid Hive username format' },
        { status: 400 }
      );
    }

    // 4. Check that Hive username is not already taken
    const accountExists = await checkHiveAccountExists(hive_username);
    if (accountExists) {
      return NextResponse.json(
        { success: false, error: 'This Hive username is already taken' },
        { status: 400 }
      );
    }

    // 7. Create sponsorship record
    const { data: sponsorship, error: createError } = await supabase
      .from('userbase_sponsorships')
      .insert({
        lite_user_id,
        sponsor_user_id: sponsorUserId,
        hive_username,
        cost_type,
        cost_amount: cost_amount || SPONSORSHIP_CONFIG.COST_HIVE,
        hive_tx_id,
        status: 'pending',
      })
      .select('id')
      .single();

    if (createError) {
      // Check for unique constraint violation (already sponsored)
      if (createError.code === '23505') {
        return NextResponse.json(
          { success: false, error: 'User already has a pending or completed sponsorship' },
          { status: 409 }
        );
      }

      console.error('Error creating sponsorship:', createError);
      return NextResponse.json(
        { success: false, error: 'Failed to create sponsorship' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        sponsorship_id: sponsorship.id,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in sponsorship creation:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
