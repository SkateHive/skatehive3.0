/**
 * Enrich posts with correct comment counts and active votes
 * 
 * Bridge API `get_ranked_posts` returns:
 * - Incorrect `children` counts (always 0)
 * - Sometimes incomplete `active_votes` array
 * 
 * This function fetches correct data from `condenser_api.get_content` as fallback.
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
        // Use condenser_api.get_content to get accurate data
        const content = await HiveClient.call('condenser_api', 'get_content', [
          post.author,
          post.permlink
        ]);

        // Update children count and active_votes if we got valid data
        if (content) {
          const enriched: any = { ...post };
          
          if (typeof content.children === 'number') {
            enriched.children = content.children;
          }
          
          // Update active_votes if condenser has more complete data
          if (content.active_votes && Array.isArray(content.active_votes)) {
            // Only update if condenser has more votes than Bridge
            if (content.active_votes.length > (post.active_votes?.length || 0)) {
              enriched.active_votes = content.active_votes;
            }
          }
          
          return enriched;
        }
      } catch (error) {
        // Fallback: keep original data
        console.warn(`Failed to enrich ${post.author}/${post.permlink}:`, error);
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
