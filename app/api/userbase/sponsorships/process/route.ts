import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAccountCreationComplete } from '@/lib/hive/accountCreation';
import { storeEncryptedKey } from '@/lib/userbase/keyManagement';
import { sendSponsorshipEmail } from '@/lib/email/sendSponsorshipEmail';
import { HiveAccountKeys } from '@/lib/hive/keyGeneration';

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

interface ProcessSponsorshipRequest {
  sponsorship_id: string;
  transaction_id: string;
  keys: HiveAccountKeys;
}

interface ProcessSponsorshipResponse {
  success: boolean;
  error?: string;
  details?: {
    account_created: boolean;
    key_encrypted: boolean;
    email_sent: boolean;
  };
}

/**
 * POST /api/userbase/sponsorships/process
 * Processes a sponsorship after Keychain signs the transaction
 * - Verifies transaction on blockchain
 * - Encrypts and stores posting key
 * - Emails all keys to user
 * - Updates sponsorship status
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ProcessSponsorshipResponse>> {
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: 'Missing Supabase configuration' },
      { status: 500 }
    );
  }

  try {
    const body: ProcessSponsorshipRequest = await request.json();
    const { sponsorship_id, transaction_id, keys } = body;

    // Validate required fields
    if (!sponsorship_id || !transaction_id || !keys) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 1. Get sponsorship record
    const { data: sponsorship, error: sponsorshipError } = await supabase
      .from('userbase_sponsorships')
      .select('id, lite_user_id, sponsor_user_id, hive_username, status')
      .eq('id', sponsorship_id)
      .single();

    if (sponsorshipError || !sponsorship) {
      return NextResponse.json(
        { success: false, error: 'Sponsorship not found' },
        { status: 404 }
      );
    }

    if (sponsorship.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Sponsorship already ${sponsorship.status}` },
        { status: 400 }
      );
    }

    // Update status to processing
    await supabase
      .from('userbase_sponsorships')
      .update({ status: 'processing' })
      .eq('id', sponsorship_id);

    // 2. Verify transaction on blockchain
    console.log(`Verifying transaction ${transaction_id} for account ${sponsorship.hive_username}`);

    const verification = await verifyAccountCreationComplete(
      transaction_id,
      sponsorship.hive_username
    );

    if (!verification.success) {
      // Mark as failed
      await supabase
        .from('userbase_sponsorships')
        .update({
          status: 'failed',
          error_message: verification.error,
        })
        .eq('id', sponsorship_id);

      return NextResponse.json(
        {
          success: false,
          error: `Transaction verification failed: ${verification.error}`,
        },
        { status: 400 }
      );
    }

    console.log(`Transaction verified! Block: ${verification.blockNumber}`);

    // 3. Get user email
    const { data: authMethod, error: emailError } = await supabase
      .from('userbase_auth_methods')
      .select('identifier')
      .eq('user_id', sponsorship.lite_user_id)
      .eq('type', 'email_magic')
      .single();

    if (emailError || !authMethod?.identifier) {
      // Mark as failed
      await supabase
        .from('userbase_sponsorships')
        .update({
          status: 'failed',
          error_message: 'User email not found',
        })
        .eq('id', sponsorship_id);

      return NextResponse.json(
        { success: false, error: 'User email not found' },
        { status: 400 }
      );
    }

    const userEmail = authMethod.identifier;

    // 4. Get sponsor username for email
    const { data: sponsorIdentity } = await supabase
      .from('userbase_identities')
      .select('handle')
      .eq('user_id', sponsorship.sponsor_user_id)
      .eq('type', 'hive')
      .single();

    const sponsorUsername = sponsorIdentity?.handle || 'anonymous';

    // 5. Encrypt and store posting key
    console.log(`Encrypting posting key for ${sponsorship.hive_username}`);

    await storeEncryptedKey(
      supabase,
      sponsorship.lite_user_id,
      sponsorship.hive_username,
      keys.posting,
      'sponsored'
    );

    // 6. Create Hive identity record
    await supabase.from('userbase_identities').insert({
      user_id: sponsorship.lite_user_id,
      type: 'hive',
      handle: sponsorship.hive_username,
      is_primary: true,
      verified_at: new Date().toISOString(),
      metadata: {
        sponsored: true,
        sponsor_user_id: sponsorship.sponsor_user_id,
        sponsor_username: sponsorUsername,
        created_via: 'skatehive_sponsorship',
      },
      is_sponsored: true,
      sponsor_user_id: sponsorship.sponsor_user_id,
    });

    // 6.5. Update Hive profile metadata with lite account info
    console.log(`Updating Hive profile metadata for ${sponsorship.hive_username}...`);
    try {
      // Get user's display name and avatar
      const { data: userData } = await supabase
        .from('userbase_users')
        .select('display_name, avatar_url, handle')
        .eq('id', sponsorship.lite_user_id)
        .single();

      if (userData) {
        const { Client, PrivateKey } = await import('@hiveio/dhive');
        const hiveClient = new Client([
          'https://api.hive.blog',
          'https://api.deathwing.me',
          'https://hive-api.arcange.eu',
        ]);

        // Build profile metadata
        const profileMetadata = {
          profile: {
            name: userData.handle || userData.display_name || sponsorship.hive_username,
            profile_image: userData.avatar_url || '',
            about: `Skatehive member • Sponsored account`,
            website: 'https://skatehive.app',
          },
        };

        // Create account_update2 operation
        const accountUpdateOp: ['account_update2', {
          account: string;
          posting_json_metadata: string;
          extensions: never[];
        }] = [
          'account_update2',
          {
            account: sponsorship.hive_username,
            posting_json_metadata: JSON.stringify(profileMetadata),
            extensions: [],
          },
        ];

        const privateKey = PrivateKey.fromString(keys.posting);
        await hiveClient.broadcast.sendOperations([accountUpdateOp], privateKey);

        console.log(`✓ Profile metadata updated for ${sponsorship.hive_username}`);
      }
    } catch (error: any) {
      console.error('Failed to update Hive profile metadata:', error);
      // Don't fail the sponsorship if profile update fails
    }

    // 7. Send email with all keys
    console.log(`Sending sponsorship email to ${userEmail}`);

    const emailSent = await sendSponsorshipEmail(
      userEmail,
      sponsorship.hive_username,
      sponsorUsername,
      keys
    );

    if (!emailSent) {
      console.warn('Email delivery failed, but continuing...');
    }

    // 8. Update sponsorship to completed
    await supabase
      .from('userbase_sponsorships')
      .update({
        status: 'completed',
        hive_tx_id: transaction_id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', sponsorship_id);

    console.log(`Sponsorship completed for ${sponsorship.hive_username}`);

    return NextResponse.json(
      {
        success: true,
        details: {
          account_created: true,
          key_encrypted: true,
          email_sent: emailSent,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error processing sponsorship:', error);

    // Try to mark sponsorship as failed
    try {
      const body = await request.json();
      if (body.sponsorship_id) {
        await supabase
          ?.from('userbase_sponsorships')
          .update({
            status: 'failed',
            error_message: error.message || 'Unknown error',
          })
          .eq('id', body.sponsorship_id);
      }
    } catch (updateError) {
      console.error('Failed to update sponsorship status:', updateError);
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
