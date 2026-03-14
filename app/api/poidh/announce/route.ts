import { NextRequest, NextResponse } from 'next/server';
import { PrivateKey, Operation } from '@hiveio/dhive';
import HiveClient from '@/lib/hive/hiveclient';
import { HIVE_CONFIG } from '@/config/app.config';
import { CHAIN_LABEL } from '@/lib/poidh-constants';
import { createClient } from '@supabase/supabase-js';

const APP_AUTHOR = HIVE_CONFIG.APP_ACCOUNT || 'skatedev';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

async function getLastSnapsContainer() {
  const author = HIVE_CONFIG.THREADS.AUTHOR;
  const beforeDate = new Date().toISOString().split('.')[0];
  const result = await HiveClient.database.call('get_discussions_by_author_before_date',
    [author, '', beforeDate, 1]);
  return { author, permlink: result[0].permlink };
}

/**
 * Resolve an EVM wallet address to the best display identity.
 * Priority: Hive handle > ENS-like display > Farcaster > shortened address
 */
async function resolveWalletIdentity(address: string): Promise<{
  display: string;
  hiveHandle: string | null;
  tag: string | null; // @hivehandle or null
}> {
  const fallback = {
    display: `${address.slice(0, 6)}...${address.slice(-4)}`,
    hiveHandle: null,
    tag: null,
  };

  if (!supabase) return fallback;

  try {
    // Find user by EVM address
    const { data: identity } = await supabase
      .from('userbase_identities')
      .select('user_id')
      .eq('type', 'evm')
      .eq('address', address.toLowerCase())
      .limit(1)
      .single();

    if (!identity?.user_id) return fallback;

    // Get user profile
    const { data: user } = await supabase
      .from('userbase_users')
      .select('handle, display_name')
      .eq('id', identity.user_id)
      .single();

    // Get all identities for this user
    const { data: identities } = await supabase
      .from('userbase_identities')
      .select('type, handle, metadata')
      .eq('user_id', identity.user_id);

    const hiveIdentity = identities?.find(i => i.type === 'hive');
    const farcasterIdentity = identities?.find(i => i.type === 'farcaster');

    if (hiveIdentity?.handle) {
      return {
        display: `@${hiveIdentity.handle}`,
        hiveHandle: hiveIdentity.handle,
        tag: `@${hiveIdentity.handle}`,
      };
    }

    if (farcasterIdentity?.handle) {
      return {
        display: farcasterIdentity.handle,
        hiveHandle: null,
        tag: null,
      };
    }

    if (user?.display_name) {
      return { display: user.display_name, hiveHandle: null, tag: null };
    }

    return fallback;
  } catch {
    return fallback;
  }
}

export async function POST(req: NextRequest) {
  try {
    const postingKey = process.env.HIVE_POSTING_KEY;
    if (!postingKey) {
      return NextResponse.json({ error: 'HIVE_POSTING_KEY not configured' }, { status: 500 });
    }

    const body = await req.json();
    const { title, amount, chainId, issuerAddress, bountyOnChainId } = body as {
      title: string;
      amount: string; // ETH amount as string
      chainId: number;
      issuerAddress: string;
      bountyOnChainId?: number;
    };

    if (!title || !amount || !chainId || !issuerAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const chainLabel = CHAIN_LABEL[chainId] || `Chain ${chainId}`;
    const identity = await resolveWalletIdentity(issuerAddress);

    // Build snap body — one phrase + specific bounty URL (renders as rich card)
    const creator = identity.tag || identity.display;
    const bountyUrl = bountyOnChainId != null
      ? `https://skatehive.app/bounties/poidh/${chainId}/${bountyOnChainId}`
      : `https://skatehive.app/bounties`;
    const snapBody = `${creator} just dropped a ${amount} ETH bounty on ${chainLabel} — think you can land it?\n\n${bountyUrl}`;

    // Get snaps container
    let parentAuthor = HIVE_CONFIG.THREADS.AUTHOR;
    let parentPermlink = HIVE_CONFIG.THREADS.PERMLINK;
    try {
      const container = await getLastSnapsContainer();
      parentPermlink = container.permlink;
    } catch {
      // use default
    }

    const timestamp = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const permlink = `poidh-bounty-${timestamp}`;

    const jsonMetadata = {
      app: 'Skatehive App 3.0',
      tags: [
        HIVE_CONFIG.COMMUNITY_TAG,
        HIVE_CONFIG.THREADS.PERMLINK,
        HIVE_CONFIG.SEARCH_TAG,
        'poidh',
        'bounty',
        chainLabel.toLowerCase(),
      ],
      poidh_bounty: {
        title,
        amount,
        chainId,
        issuerAddress,
        creatorDisplay: identity.display,
      },
      snap_type: 'bounty_announcement',
    };

    const operation: Operation = [
      'comment',
      {
        parent_author: parentAuthor,
        parent_permlink: parentPermlink,
        author: APP_AUTHOR,
        permlink,
        title: '',
        body: snapBody,
        json_metadata: JSON.stringify(jsonMetadata),
      },
    ];

    const privateKey = PrivateKey.fromString(postingKey);
    await HiveClient.broadcast.sendOperations([operation], privateKey);

    return NextResponse.json({
      success: true,
      author: APP_AUTHOR,
      permlink,
      creatorDisplay: identity.display,
    });
  } catch (error) {
    console.error('Failed to announce POIDH bounty:', error);
    return NextResponse.json(
      { error: 'Failed to announce bounty' },
      { status: 500 }
    );
  }
}
