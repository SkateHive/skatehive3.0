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
 * Create a snap comment on Hive using the app account posting key
 * @param body Comment body content
 * @param tags Array of tags
 * @param images Array of image URLs
 * @param ethereumAddress The Ethereum address of the creator
 * @returns Promise with success status and comment details
 */
export async function createSnapAsSkatedev({
  body,
  tags = [],
  images = [],
  ethereumAddress,
}: {
  body: string;
  tags?: string[];
  images?: string[];
  ethereumAddress: string;
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
        ...tags
      ],
      images,
      creator_ethereum_address: ethereumAddress,
      created_via: 'ethereum_wallet',
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
