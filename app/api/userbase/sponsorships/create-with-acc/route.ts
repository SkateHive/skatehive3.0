import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateHiveKeys } from '@/lib/hive/keyGeneration';
import { buildCreateClaimedAccountOperation, getSponsorClaimedAccounts } from '@/lib/hive/accountCreation';
import { storeEncryptedKey } from '@/lib/userbase/keyManagement';
import { sendSponsorshipEmail } from '@/lib/email/sendSponsorshipEmail';
import { SPONSORSHIP_CONFIG } from '@/config/app.config';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

/**
 * POST /api/userbase/sponsorships/create-with-acc
 *
 * Server-side account creation using the platform's pending claimed account
 * tokens (ACC). Signs the create_claimed_account operation with
 * HIVE_ACTIVE_KEY (the platform account's active key) — no Keychain required
 * on the client.
 *
 * Body:
 *   lite_user_id   — UUID of the lite user being sponsored
 *   hive_username  — desired Hive username for the new account
 *   sponsor_user_id — UUID of the viewer who initiated the sponsorship
 */
export async function POST(request: NextRequest) {
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase configuration' }, { status: 500 });
  }

  const platformAccount = SPONSORSHIP_CONFIG.PLATFORM_ACC_ACCOUNT;
  const platformActiveKey = process.env.HIVE_ACTIVE_KEY;

  if (!platformAccount || !platformActiveKey) {
    return NextResponse.json(
      { error: 'Platform ACC account not configured (HIVE_ACCOUNT_CREATOR / HIVE_ACTIVE_KEY missing)' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { lite_user_id, hive_username, sponsor_user_id } = body;

    if (!lite_user_id || !hive_username) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify the platform account still has ACC tokens
    const available = await getSponsorClaimedAccounts(platformAccount);
    if (available <= 0) {
      return NextResponse.json(
        { error: 'No ACC tokens available on platform account' },
        { status: 422 }
      );
    }

    // 2. Generate keys for the new account
    const keys = generateHiveKeys(hive_username);

    // 3. Build create_claimed_account operation
    const operation = buildCreateClaimedAccountOperation(platformAccount, hive_username, keys);

    // 4. Broadcast with platform active key
    const { Client, PrivateKey } = await import('@hiveio/dhive');
    const hiveClient = new Client(SPONSORSHIP_CONFIG.HIVE_API_NODES);

    let txId: string;
    try {
      const tx = await hiveClient.broadcast.sendOperations(
        [operation],
        PrivateKey.fromString(platformActiveKey)
      );
      txId = (tx as any).id || (tx as any).tx_id || 'unknown';
    } catch (broadcastErr: any) {
      return NextResponse.json(
        { error: `Broadcast failed: ${broadcastErr.message}` },
        { status: 502 }
      );
    }

    // 5. Create sponsorship record in DB
    const { data: sponsorship, error: createErr } = await supabase
      .from('userbase_sponsorships')
      .insert({
        lite_user_id,
        sponsor_user_id: sponsor_user_id || null,
        hive_username,
        cost_type: 'account_token',
        cost_amount: 0,
        status: 'processing',
        hive_tx_id: txId,
      })
      .select('id')
      .single();

    if (createErr || !sponsorship) {
      console.error('Failed to create sponsorship record:', createErr);
      // Don't fail — account is already created on chain
    }

    // 6. Encrypt and store posting key
    await storeEncryptedKey(
      supabase,
      lite_user_id,
      hive_username,
      keys.posting,
      'sponsored'
    );

    // 7. Create Hive identity record
    await supabase.from('userbase_identities').insert({
      user_id: lite_user_id,
      type: 'hive',
      handle: hive_username,
      is_primary: true,
      verified_at: new Date().toISOString(),
      metadata: {
        sponsored: true,
        sponsor_account: platformAccount,
        created_via: 'skatehive_sponsorship_acc',
      },
      is_sponsored: true,
      sponsor_user_id: sponsor_user_id || null,
    });

    // 8. Update Hive profile metadata with lite account info
    try {
      const { data: userData } = await supabase
        .from('userbase_users')
        .select('display_name, avatar_url, handle')
        .eq('id', lite_user_id)
        .single();

      if (userData) {
        const profileMetadata = {
          profile: {
            name: userData.handle || userData.display_name || hive_username,
            profile_image: userData.avatar_url || '',
            about: 'Skatehive member • Sponsored account',
            website: 'https://skatehive.app',
          },
        };
        const accountUpdateOp: ['account_update2', any] = [
          'account_update2',
          {
            account: hive_username,
            posting_json_metadata: JSON.stringify(profileMetadata),
            extensions: [],
          },
        ];
        await hiveClient.broadcast.sendOperations(
          [accountUpdateOp],
          PrivateKey.fromString(keys.posting)
        );
      }
    } catch (profileErr: any) {
      console.warn('Profile metadata update failed (non-fatal):', profileErr.message);
    }

    // 9. Email keys to user
    const { data: authMethod } = await supabase
      .from('userbase_auth_methods')
      .select('identifier')
      .eq('user_id', lite_user_id)
      .eq('type', 'email_magic')
      .single();

    let emailSent = false;
    if (authMethod?.identifier) {
      emailSent = await sendSponsorshipEmail(
        authMethod.identifier,
        hive_username,
        platformAccount,
        keys
      );
    }

    // 10. Mark sponsorship completed
    if (sponsorship?.id) {
      await supabase
        .from('userbase_sponsorships')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', sponsorship.id);
    }

    return NextResponse.json({
      success: true,
      hive_username,
      tx_id: txId,
      email_sent: emailSent,
    });
  } catch (err: any) {
    console.error('create-with-acc error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
