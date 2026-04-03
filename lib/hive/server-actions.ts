// lib/hive/server-actions.ts
'use server';
import { PrivateKey, Operation } from '@hiveio/dhive';
import HiveClient from "./hiveclient";
import { HIVE_CONFIG } from '@/config/app.config';
import { Buffer } from 'buffer';
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
  // Backwards-compatible wrapper that uses the generic editor under the hood
  try {
    return await editPostAsSkatedev({
      author,
      permlink,
      bodyAppend: `\n\n---\n\n🎯 **Zora Coin Created!**\n\n[Trade this coin on Zora ↗](${coinUrl})\n\n*This coin was created automatically when this post was shared. The creator can be tipped via Ethereum at the coin address above.*`,
      metadataUpdates: {
        zora_coin_address: coinAddress,
        zora_coin_url: coinUrl,
        coin_created: true,
      }
    });
  } catch (error) {
    console.error('❌ Failed to update post with coin info (wrapper):', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Edit a post as the app account (skatedev)
 * Supports editing title, body (replace or append), tags and arbitrary metadata
 */
export async function editPostAsSkatedev({
  author,
  permlink,
  title,
  body,
  bodyAppend,
  tags,
  metadataUpdates,
}: {
  author: string;
  permlink: string;
  title?: string;
  body?: string; // replace body
  bodyAppend?: string; // append to existing body
  tags?: string[]; // full tags array to set
  metadataUpdates?: Record<string, any>;
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
    let jsonMetadata: Record<string, any> = {};
    try {
      jsonMetadata = JSON.parse(content.json_metadata || '{}');
    } catch {
      jsonMetadata = {};
    }
    // Build updated fields
    const updatedTitle = typeof title === 'string' ? title : content.title;
    let updatedBody = typeof body === 'string' ? body : content.body;
    if (bodyAppend && bodyAppend.trim()) {
      updatedBody = `${updatedBody}\n\n${bodyAppend}`;
    }
    // Update tags if provided
    if (Array.isArray(tags)) {
      jsonMetadata.tags = tags;
    }
    // Merge metadata updates
    if (metadataUpdates && typeof metadataUpdates === 'object') {
      jsonMetadata = {
        ...jsonMetadata,
        ...metadataUpdates,
      };
    }
    // Maintain a simple edit history in metadata
    const editHistory = Array.isArray(jsonMetadata.edit_history) ? jsonMetadata.edit_history : [];
    editHistory.push({
      edited_at: new Date().toISOString(),
      editor: APP_AUTHOR,
      changes: {
        titleChanged: typeof title === 'string' && title !== content.title,
        bodyChanged: typeof body === 'string' || (bodyAppend && bodyAppend.trim()),
        tagsChanged: Array.isArray(tags),
        metadataKeys: metadataUpdates ? Object.keys(metadataUpdates) : [],
      }
    });
    jsonMetadata.edit_history = editHistory;
    // Create the edit operation
    const operation: Operation = [
      'comment',
      {
        parent_author: content.parent_author,
        parent_permlink: content.parent_permlink,
        author,
        permlink,
        title: updatedTitle,
        body: updatedBody,
        json_metadata: JSON.stringify(jsonMetadata),
      }
    ];
    // Broadcast the operation
    const privateKey = PrivateKey.fromString(postingKey);
    await HiveClient.broadcast.sendOperations([operation], privateKey);
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to edit post as app account:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// New: delete post as app account
export async function deletePostAsSkatedev({
  author,
  permlink,
}: {
  author: string;
  permlink: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const postingKey = process.env.HIVE_POSTING_KEY;
    if (!postingKey) {
      throw new Error('HIVE_POSTING_KEY is not set in the environment');
    }
    if (author !== APP_AUTHOR) {
      throw new Error(`Can only delete posts created by the ${HIVE_CONFIG.APP_ACCOUNT} account`);
    }
    // Verify the post exists and is authored by the app account
    const content = await HiveClient.database.call('get_content', [author, permlink]);
    if (!content || !content.author) {
      throw new Error('Post not found');
    }

    // Build delete operation
    const operation: Operation = [
      'delete_comment',
      {
        author,
        permlink,
      }
    ];

    const privateKey = PrivateKey.fromString(postingKey);
    await HiveClient.broadcast.sendOperations([operation], privateKey);

    // Audit log - simple console log (server-side logs should be captured by host)
    console.info(`🗑️ Deleted post as ${APP_AUTHOR}: ${author}/${permlink} at ${new Date().toISOString()}`);

    return { success: true };
  } catch (error) {
    console.error('❌ Failed to delete post as skatedev:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
