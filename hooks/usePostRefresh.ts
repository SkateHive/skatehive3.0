/**
 * Hook to refresh post data (votes, comments) using dhive
 * 
 * Bridge API (first load) → dhive refresh (real-time)
 * 
 * Automatically refreshes active_votes and children count every N seconds
 */

import { useState, useEffect, useCallback } from 'react';
import { Discussion } from '@hiveio/dhive';
import HiveClient from '@/lib/hive/hiveclient';

interface UsePostRefreshOptions {
  enabled?: boolean;
  intervalMs?: number; // Default: 30 seconds
}

export function usePostRefresh(
  post: Discussion,
  options: UsePostRefreshOptions = {}
) {
  const { enabled = true, intervalMs = 30000 } = options;
  
  const [refreshedVotes, setRefreshedVotes] = useState(post.active_votes || []);
  const [refreshedChildren, setRefreshedChildren] = useState(post.children || 0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    
    setIsRefreshing(true);
    try {
      const content = await HiveClient.call('condenser_api', 'get_content', [
        post.author,
        post.permlink
      ]);

      if (content) {
        if (content.active_votes && Array.isArray(content.active_votes)) {
          setRefreshedVotes(content.active_votes);
        }
        
        if (typeof content.children === 'number') {
          setRefreshedChildren(content.children);
        }
      }
    } catch (error) {
      console.warn(`Failed to refresh ${post.author}/${post.permlink}:`, error);
    } finally {
      setIsRefreshing(false);
    }
  }, [post.author, post.permlink, enabled]);

  useEffect(() => {
    if (!enabled) return;

    // Refresh immediately on mount
    refresh();

    // Set up interval for periodic refresh
    const interval = setInterval(refresh, intervalMs);

    return () => clearInterval(interval);
  }, [refresh, enabled, intervalMs]);

  return {
    activeVotes: refreshedVotes,
    children: refreshedChildren,
    isRefreshing,
    refresh
  };
}
