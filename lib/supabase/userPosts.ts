import { createClient, SupabaseClient } from '@supabase/supabase-js';

import HiveClient from '@/lib/hive/hiveclient';
import { parseJsonMetadata } from '@/lib/hive/metadata-utils';

if (typeof window !== 'undefined') {
  throw new Error('Server-only Supabase client cannot be imported in the browser');
}

interface SoftDeleteInput {
  author: string;
  permlink: string;
  deletedBy: string;
}

interface PostDeleteAuditInput {
  author: string;
  permlink: string;
  deletedBy: string;
  status: 'SUCCESS' | 'FAILED';
  reason?: string;
}

interface HivePostMetadata {
  created_via?: string;
  creator_ethereum_address?: string;
}

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!supabaseAdmin) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error(
        'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY'
      );
    }

    supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdmin;
}

function normalizeAddress(value: string): string {
  return value.trim().toLowerCase();
}

function validateIdentifier(value: string, fieldName: string): string {
  const clean = value.trim();
  if (!clean) {
    throw new Error(`${fieldName} is required`);
  }
  if (clean.length > 255) {
    throw new Error(`${fieldName} is too long`);
  }
  return clean;
}

async function getHivePost(author: string, permlink: string): Promise<any> {
  return HiveClient.call('bridge', 'get_post', {
    author,
    permlink,
    observer: '',
  });
}

async function isLitePostOwnedByAddress(
  author: string,
  permlink: string,
  address: string
): Promise<boolean> {
  try {
    const post = await getHivePost(author, permlink);
    if (!post || !post.author) {
      return false;
    }

    const metadata = parseJsonMetadata(post.json_metadata) as HivePostMetadata;
    const creatorAddress = metadata.creator_ethereum_address;
    const createdVia = metadata.created_via;

    if (!creatorAddress || !createdVia) {
      return false;
    }

    if (createdVia !== 'ethereum_wallet') {
      return false;
    }

    return normalizeAddress(creatorAddress) === normalizeAddress(address);
  } catch (error) {
    console.error('Failed to validate lite post ownership:', error);
    return false;
  }
}

export async function listSoftDeletedPostKeys(): Promise<Array<{ author: string; permlink: string }>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_posts')
    .select('author, permlink')
    .eq('deleted', true);

  if (error) {
    throw new Error(`Failed to load soft deleted posts: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    author: String(row.author || '').toLowerCase(),
    permlink: String(row.permlink || '').toLowerCase(),
  }));
}

export async function isPostSoftDeleted(author: string, permlink: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('user_posts')
    .select('deleted')
    .eq('author', author.toLowerCase())
    .eq('permlink', permlink.toLowerCase())
    .eq('deleted', true)
    .limit(1);

  if (error) {
    throw new Error(`Failed to check soft-delete state: ${error.message}`);
  }

  return Array.isArray(data) && data.length > 0;
}

async function logDeleteAudit(input: PostDeleteAuditInput): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error } = await supabase.from('user_post_delete_audit').insert({
    author: input.author,
    permlink: input.permlink,
    deleted_by: normalizeAddress(input.deletedBy),
    status: input.status,
    reason: input.reason || null,
    logged_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Failed to insert delete audit log:', error);
  }
}

export async function softDeletePost(input: SoftDeleteInput): Promise<void> {
  const author = validateIdentifier(input.author, 'author').toLowerCase();
  const permlink = validateIdentifier(input.permlink, 'permlink').toLowerCase();
  const deletedBy = normalizeAddress(validateIdentifier(input.deletedBy, 'deletedBy'));
  const supabase = getSupabaseAdmin();

  const ownsPost = await isLitePostOwnedByAddress(author, permlink, deletedBy);
  if (!ownsPost) {
    await logDeleteAudit({
      author,
      permlink,
      deletedBy,
      status: 'FAILED',
      reason: 'NOT_POST_OWNER_OR_NOT_LITE_POST',
    });
    throw new Error('You are not allowed to delete this post');
  }

  const deleteTimestamp = new Date().toISOString();
  const updatePayload = {
    deleted: true,
    deleted_at: deleteTimestamp,
    deleted_by: deletedBy,
  };

  const { data: updatedRows, error: updateError } = await supabase
    .from('user_posts')
    .update(updatePayload)
    .eq('author', author)
    .eq('permlink', permlink)
    .select('author, permlink')
    .limit(1);

  let writeError = updateError;

  if (!writeError && (!updatedRows || updatedRows.length === 0)) {
    const { error: insertError } = await supabase.from('user_posts').insert({
      author,
      permlink,
      ...updatePayload,
    });
    writeError = insertError;
  }

  if (writeError) {
    await logDeleteAudit({
      author,
      permlink,
      deletedBy,
      status: 'FAILED',
      reason: `SUPABASE_ERROR:${writeError.message}`,
    });
    throw new Error(`Failed to soft-delete post: ${writeError.message}`);
  }

  await logDeleteAudit({
    author,
    permlink,
    deletedBy,
    status: 'SUCCESS',
  });
}
