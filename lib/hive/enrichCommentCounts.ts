/**
 * Enrich posts with correct comment counts
 * 
 * Bridge API `get_ranked_posts` returns incorrect `children` counts (always 0).
 * This function fetches correct counts from `condenser_api.get_content` as fallback.
 */

import HiveClient from "./hiveclient";
import { Discussion } from "@hiveio/dhive";

export async function enrichCommentCounts(posts: Discussion[]): Promise<Discussion[]> {
  // Process in batches to avoid overwhelming the API
  const BATCH_SIZE = 10;
  const enrichedPosts: Discussion[] = [];

  for (let i = 0; i < posts.length; i += BATCH_SIZE) {
    const batch = posts.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (post) => {
      try {
        // Use condenser_api.get_content to get accurate children count
        const content = await HiveClient.call('condenser_api', 'get_content', [
          post.author,
          post.permlink
        ]);

        // Update children count if we got valid data
        if (content && typeof content.children === 'number') {
          return {
            ...post,
            children: content.children
          };
        }
      } catch (error) {
        // Fallback: keep original (potentially wrong) count
        console.warn(`Failed to fetch comment count for ${post.author}/${post.permlink}:`, error);
      }

      return post;
    });

    const enrichedBatch = await Promise.all(batchPromises);
    enrichedPosts.push(...enrichedBatch);
  }

  return enrichedPosts;
}

/**
 * Enrich single post with correct comment count
 */
export async function enrichSingleCommentCount(post: Discussion): Promise<Discussion> {
  try {
    const content = await HiveClient.call('condenser_api', 'get_content', [
      post.author,
      post.permlink
    ]);

    if (content && typeof content.children === 'number') {
      return {
        ...post,
        children: content.children
      };
    }
  } catch (error) {
    console.warn(`Failed to fetch comment count for ${post.author}/${post.permlink}:`, error);
  }

  return post;
}
