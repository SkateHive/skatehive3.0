// lib/hive/server-actions.ts
'use server';
import { PrivateKey, Operation } from '@hiveio/dhive';
import HiveClient from "./hiveclient";
import { HIVE_CONFIG } from '@/config/app.config';
import { Buffer } from 'buffer';
import { isServerSideAdmin, logAdminAuditEvent } from '@/lib/server/adminUtils';
// Centralized app author with fallback for consistency across all functions
const APP_AUTHOR = HIVE_CONFIG.APP_ACCOUNT || 'skatedev';
// Image signing server action
// Image signing server action - improved with better error handling
export async function signImageHash(hash: string): Promise<{ success: boolean; signature?: string; error?: string }> {
    try {
        const wif = process.env.HIVE_POSTING_KEY;
        if (!wif) {
            return {
                success: false,
                error: "HIVE_POSTING_KEY is not set in the environment"
            };
        }
        const key = PrivateKey.fromString(wif);
        const hashBuffer = Buffer.from(hash, "hex");  // Convert the hex string back to a buffer
        const signature = key.sign(hashBuffer);
        return {
            success: true,
            signature: signature.toString()
        };
    } catch (error) {
        console.error("Error in signImageHash:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error signing image hash"
        };
    }
}
// Import client functions that we need for server-side operations
// Note: This is a workaround since getLastSnapsContainer is in client-functions
// In a real app, you might want to extract this to a shared utilities file
async function getLastSnapsContainer() {
  const author = HIVE_CONFIG.THREADS.AUTHOR;
  const beforeDate = new Date().toISOString().split('.')[0];
  const permlink = '';
  const limit = 1;
  const result = await HiveClient.database.call('get_discussions_by_author_before_date',
    [author, permlink, beforeDate, limit]);
  return {
    author,
    permlink: result[0].permlink
  };
}
/**
 * Create a post on Hive using the app account posting key
 * @param title Post title
 * @param body Post body content
 * @param tags Array of tags
 * @param images Array of image URLs
 * @param ethereumAddress The Ethereum address of the coin creator
 * @param coinAddress The Zora coin address if available
 * @returns Promise with success status and post details
 */
export async function createPostAsSkatedev({
  title,
  body,
  tags = [],
  images = [],
  ethereumAddress,
  coinAddress,
}: {
  title: string;
  body: string;
  tags?: string[];
  images?: string[];
  ethereumAddress: string;
  coinAddress?: string;
}): Promise<{ success: boolean; author: string; permlink: string; error?: string }> {
  try {
    const postingKey = process.env.HIVE_POSTING_KEY;
    const author = APP_AUTHOR;
    if (!postingKey) {
      throw new Error("HIVE_POSTING_KEY is not set in the environment");
    }
    // Generate permlink based on title and timestamp
    const timestamp = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const titleSlug = title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
    const permlink = `${titleSlug}-${timestamp}`;
    // Prepare metadata
    const jsonMetadata = {
      app: "Skatehive App 3.0",
      tags: [
        HIVE_CONFIG.COMMUNITY_TAG,
        'skatehive',
        'ethereum',
        'coin-creation',
        ...tags
      ],
      images,
      creator_ethereum_address: ethereumAddress,
      ...(coinAddress && { zora_coin_address: coinAddress }),
      created_via: 'ethereum_wallet'
    };
    // Create the comment operation
    const operation: Operation = [
      'comment',
      {
        parent_author: '',
        parent_permlink: HIVE_CONFIG.COMMUNITY_TAG,
        author,
        permlink,
        title,
        body,
        json_metadata: JSON.stringify(jsonMetadata),
      }
    ];
    // Broadcast the operation
    const privateKey = PrivateKey.fromString(postingKey);
    await HiveClient.broadcast.sendOperations([operation], privateKey);
    return {
      success: true,
      author,
      permlink
    };
  } catch (error) {
     console.error(`❌ Failed to create post as ${HIVE_CONFIG.APP_ACCOUNT}:`, error);
    return {
      success: false,
      author: '',
      permlink: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
/**
 * Create a snap comment on Hive using the app account posting key
 * @param body Comment body content
 * @param tags Array of tags
 * @param images Array of image URLs
 * @param ethereumAddress The Ethereum address of the coin creator
 * @param coinAddress The Zora coin address if available
 * @param coinUrl The Zora coin URL if available
 * @returns Promise with success status and comment details
 */
export async function createSnapAsSkatedev({
  body,
  tags = [],
  images = [],
  ethereumAddress,
  coinAddress,
  coinUrl,
}: {
  body: string;
  tags?: string[];
  images?: string[];
  ethereumAddress: string;
  coinAddress?: string;
  coinUrl?: string;
}): Promise<{ success: boolean; author: string; permlink: string; error?: string }> {
  try {
    const postingKey = process.env.HIVE_POSTING_KEY;
    const author = APP_AUTHOR;
    if (!postingKey) {
      throw new Error("HIVE_POSTING_KEY is not set in the environment");
    }
    // Get the latest snaps container for parent
    let parentAuthor = HIVE_CONFIG.THREADS.AUTHOR;
    let parentPermlink = HIVE_CONFIG.THREADS.PERMLINK;
    
    try {
      const lastSnapsContainer = await getLastSnapsContainer();
      parentPermlink = lastSnapsContainer.permlink;
    } catch (error) {
      console.warn("Failed to get last snaps container, using default");
    }
    // Generate permlink based on timestamp
    const timestamp = new Date().toISOString().replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const permlink = `snap-${timestamp}`;
    // Prepare metadata
    const jsonMetadata = {
      app: "Skatehive App 3.0",
      tags: [
        HIVE_CONFIG.COMMUNITY_TAG,
        HIVE_CONFIG.THREADS.PERMLINK,
        HIVE_CONFIG.SEARCH_TAG,
        'ethereum',
        'coin-creation',
        ...tags
      ],
      images,
      creator_ethereum_address: ethereumAddress,
      ...(coinAddress && { zora_coin_address: coinAddress }),
      ...(coinUrl && { zora_coin_url: coinUrl }),
      created_via: 'ethereum_wallet',
      snap_type: 'coin_creation'
    };
    // Create the comment operation (snap comment)
    const operation: Operation = [
      'comment',
      {
        parent_author: parentAuthor,
        parent_permlink: parentPermlink,
        author,
        permlink,
        title: '', // Snaps don't have titles
        body,
        json_metadata: JSON.stringify(jsonMetadata),
      }
    ];
    // Broadcast the operation
    const privateKey = PrivateKey.fromString(postingKey);
    await HiveClient.broadcast.sendOperations([operation], privateKey);
    return {
      success: true,
      author,
      permlink
    };
  } catch (error) {
    console.error(`❌ Failed to create snap as ${HIVE_CONFIG.APP_ACCOUNT}:`, error);
    return {
      success: false,
      author: '',
      permlink: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
/**
 * Update an existing Hive post to add Zora coin information
 * @param author Original post author
 * @param permlink Original post permlink
 * @param coinAddress Zora coin address to add
 * @param coinUrl Zora coin URL to add to body
 * @returns Promise with success status
 */
export async function updatePostWithCoinInfo({
  author,
  permlink,
  coinAddress,
  coinUrl,
}: {
  author: string;
  permlink: string;
  coinAddress: string;
  coinUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const postingKey = process.env.HIVE_POSTING_KEY;
    if (!postingKey) {
      throw new Error("HIVE_POSTING_KEY is not set in the environment");
    }
    // Only allow updating posts by app account
    if (author !== APP_AUTHOR) {
      throw new Error(`Can only update posts created by ${HIVE_CONFIG.APP_ACCOUNT} account`);
    }
    // Get the current post
    const content = await HiveClient.database.call('get_content', [author, permlink]);
    if (!content || !content.author) {
      throw new Error("Post not found");
    }
    // Parse existing metadata
    let jsonMetadata;
    try {
      jsonMetadata = JSON.parse(content.json_metadata || '{}');
    } catch {
      jsonMetadata = {};
    }
    // Add coin information
    jsonMetadata.zora_coin_address = coinAddress;
    jsonMetadata.coin_created = true;
    // Update body with coin information
    const updatedBody = `${content.body}\n\n---\n\n🎯 **Zora Coin Created!**\n\n[Trade this coin on Zora ↗](${coinUrl})\n\n*This coin was created automatically when this post was shared. The creator can be tipped via Ethereum at the coin address above.*`;
    // Create the edit operation
    const operation: Operation = [
      'comment',
      {
        parent_author: content.parent_author,
        parent_permlink: content.parent_permlink,
        author,
        permlink,
        title: content.title,
        body: updatedBody,
        json_metadata: JSON.stringify(jsonMetadata),
      }
    ];
    // Broadcast the operation
    const privateKey = PrivateKey.fromString(postingKey);
    await HiveClient.broadcast.sendOperations([operation], privateKey);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to update post with coin info:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function deletePostAsSkatedev({
  adminUsername,
  author,
  permlink,
}: {
  adminUsername: string;
  author: string;
  permlink: string;
}): Promise<{ success: boolean; error?: string }> {
  const normalizedAdmin = (adminUsername || '').trim().toLowerCase();
  const normalizedAuthor = (author || '').trim().toLowerCase();
  const normalizedPermlink = (permlink || '').trim();
  const normalizedAppAuthor = APP_AUTHOR.toLowerCase();

  const auditBase = {
    adminUsername: normalizedAdmin || 'anonymous',
    targetAuthor: normalizedAuthor || 'unknown',
    targetPermlink: normalizedPermlink || 'unknown',
  };

  try {
    if (!normalizedAdmin || !isServerSideAdmin(normalizedAdmin)) {
      logAdminAuditEvent('delete_post_as_skatedev', {
        ...auditBase,
        success: false,
        reason: 'unauthorized_admin',
      });
      return {
        success: false,
        error: 'Unauthorized: admin privileges required',
      };
    }

    if (!normalizedAuthor || normalizedAuthor !== normalizedAppAuthor) {
      logAdminAuditEvent('delete_post_as_skatedev', {
        ...auditBase,
        success: false,
        reason: 'author_not_allowed',
      });
      return {
        success: false,
        error: `Only ${APP_AUTHOR} posts can be deleted`,
      };
    }

    if (!normalizedPermlink) {
      logAdminAuditEvent('delete_post_as_skatedev', {
        ...auditBase,
        success: false,
        reason: 'missing_permlink',
      });
      return {
        success: false,
        error: 'Permlink is required',
      };
    }

    const postingKey = process.env.HIVE_POSTING_KEY;
    if (!postingKey) {
      logAdminAuditEvent('delete_post_as_skatedev', {
        ...auditBase,
        success: false,
        reason: 'missing_posting_key',
      });
      return {
        success: false,
        error: 'HIVE_POSTING_KEY is not set in the environment',
      };
    }

    const content = await HiveClient.database.call('get_content', [APP_AUTHOR, normalizedPermlink]);
    if (!content || !content.author) {
      logAdminAuditEvent('delete_post_as_skatedev', {
        ...auditBase,
        success: false,
        reason: 'post_not_found',
      });
      return {
        success: false,
        error: 'Post not found',
      };
    }

    if (String(content.author).toLowerCase() !== normalizedAppAuthor) {
      logAdminAuditEvent('delete_post_as_skatedev', {
        ...auditBase,
        success: false,
        reason: 'content_author_not_allowed',
        chainAuthor: content.author,
      });
      return {
        success: false,
        error: `Only ${APP_AUTHOR} posts can be deleted`,
      };
    }

    const operation: Operation = [
      'delete_comment',
      {
        author: APP_AUTHOR,
        permlink: normalizedPermlink,
      },
    ];

    const privateKey = PrivateKey.fromString(postingKey);
    await HiveClient.broadcast.sendOperations([operation], privateKey);

    logAdminAuditEvent('delete_post_as_skatedev', {
      ...auditBase,
      success: true,
    });

    return { success: true };
  } catch (error) {
    logAdminAuditEvent('delete_post_as_skatedev', {
      ...auditBase,
      success: false,
      reason: 'broadcast_error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
