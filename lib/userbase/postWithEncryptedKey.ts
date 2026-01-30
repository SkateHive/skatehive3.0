/**
 * Example: How to post to Hive using encrypted posting keys from sponsorship system
 * This demonstrates the integration between sponsorship and posting
 */

import { Client, PrivateKey, Operation } from '@hiveio/dhive';
import { SupabaseClient } from '@supabase/supabase-js';
import { getPostingMethod } from './postingMethod';
import { getDecryptedKey } from './keyManagement';
import { SPONSORSHIP_CONFIG } from '@/config/app.config';

const client = new Client(SPONSORSHIP_CONFIG.HIVE_API_NODES);

export interface PostContent {
  title?: string;
  body: string;
  parent_author?: string;
  parent_permlink?: string;
  tags?: string[];
  json_metadata?: Record<string, any>;
}

export interface PostResult {
  success: boolean;
  method: 'hive_account' | 'keychain_signing' | 'soft_post';
  author: string;
  permlink: string;
  transaction_id?: string;
  error?: string;
  requires_keychain?: boolean;
}

/**
 * Posts content to Hive using the appropriate method for the user
 *
 * @param supabase - Supabase client instance
 * @param userId - The user's ID
 * @param content - The content to post
 * @returns Result with posting method and details
 *
 * @example
 * // For sponsored user (has encrypted key):
 * const result = await postToHive(supabase, userId, {
 *   title: 'My First Post',
 *   body: 'Hello Hive!',
 *   tags: ['skateboarding', 'introduceyourself']
 * });
 * // Posts automatically, no Keychain popup needed
 *
 * @example
 * // For user with Keychain only:
 * const result = await postToHive(supabase, userId, { ... });
 * if (result.requires_keychain) {
 *   // Frontend should handle Keychain signing
 *   // window.hive_keychain.requestBroadcast(...)
 * }
 */
export async function postToHive(
  supabase: SupabaseClient,
  userId: string,
  content: PostContent
): Promise<PostResult> {
  // 1. Determine posting method
  const method = await getPostingMethod(userId);

  // 2. Generate permlink
  const permlink = generatePermlink(content.title || 'post');

  // 3. Build metadata
  const metadata = {
    tags: content.tags || [],
    app: 'skatehive/1.0',
    ...content.json_metadata,
  };

  // 4. Handle based on method
  if (method.type === 'hive_account') {
    // User has encrypted posting key - post directly!
    try {
      const postingKey = await getDecryptedKey(supabase, userId);

      if (!postingKey) {
        return {
          success: false,
          method: 'hive_account',
          author: method.username,
          permlink,
          error: 'Posting key not found',
        };
      }

      // Build comment operation
      const operation: Operation = [
        'comment',
        {
          parent_author: content.parent_author || '',
          parent_permlink: content.parent_permlink || 'hive-173115', // Skatehive community
          author: method.username,
          permlink,
          title: content.title || '',
          body: content.body,
          json_metadata: JSON.stringify(metadata),
        },
      ];

      // Sign and broadcast
      const privateKey = PrivateKey.fromString(postingKey);
      const result = await client.broadcast.sendOperations([operation], privateKey);

      return {
        success: true,
        method: 'hive_account',
        author: method.username,
        permlink,
        transaction_id: result.id,
      };
    } catch (error: any) {
      return {
        success: false,
        method: 'hive_account',
        author: method.username,
        permlink,
        error: error.message || 'Failed to broadcast',
      };
    }
  } else if (method.type === 'keychain_signing') {
    // User has Hive account but no stored key - need Keychain
    // Return unsigned operation for frontend to sign
    return {
      success: false,
      method: 'keychain_signing',
      author: method.username,
      permlink,
      requires_keychain: true,
      error: 'Keychain signing required (handle on frontend)',
    };
  } else {
    // Lite account - needs soft post (handled elsewhere)
    return {
      success: false,
      method: 'soft_post',
      author: 'skateuser',
      permlink,
      error: 'Soft post required (use soft post system)',
    };
  }
}

/**
 * Generates a URL-safe permlink from a title
 * Ensures the final permlink is always <= 255 characters
 */
function generatePermlink(title: string): string {
  // Generate random suffix first (6 characters)
  const random = Math.random().toString(36).substring(2, 8);

  // Calculate max slug length accounting for dash and random suffix
  const maxSlugLength = 255 - (random.length + 1);

  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, maxSlugLength);

  return slug ? `${slug}-${random}` : `post-${random}`;
}

/**
 * Example: Post a comment/reply
 */
export async function postComment(
  supabase: SupabaseClient,
  userId: string,
  parentAuthor: string,
  parentPermlink: string,
  body: string
): Promise<PostResult> {
  return postToHive(supabase, userId, {
    parent_author: parentAuthor,
    parent_permlink: parentPermlink,
    body,
  });
}

/**
 * Example: Post a new article
 */
export async function postArticle(
  supabase: SupabaseClient,
  userId: string,
  title: string,
  body: string,
  tags: string[]
): Promise<PostResult> {
  return postToHive(supabase, userId, {
    title,
    body,
    tags,
  });
}
