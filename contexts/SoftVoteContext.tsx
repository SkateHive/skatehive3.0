"use client";

import React, { useMemo } from "react";
import { Discussion } from "@hiveio/dhive";
import {
  useSoftVoteOverlays,
  SoftVoteOverlay,
  SoftVoteContext,
} from "@/hooks/useSoftVoteOverlay";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

// Re-export for convenience
export { SoftVoteContext };

export function useSoftVoteContext() {
  const context = React.useContext(SoftVoteContext);
  return context ?? { getVote: () => null };
}

interface SoftVoteProviderProps {
  posts: Array<{ author: string; permlink: string }> | Discussion[];
  children: React.ReactNode;
}

/**
 * Provider that fetches soft votes for a list of posts in a single batch request.
 * Use this at the list level (SnapList, PostList, etc.) to avoid N+1 API calls.
 *
 * @example
 * <SoftVoteProvider posts={comments}>
 *   {comments.map(c => <Snap key={c.permlink} discussion={c} />)}
 * </SoftVoteProvider>
 */
export function SoftVoteProvider({ posts, children }: SoftVoteProviderProps) {
  const { user } = useUserbaseAuth();
  const userId = user?.id || null;

  // Normalize posts to {author, permlink} format
  const normalizedPosts = useMemo(() => {
    return posts
      .map((p) => ({
        author: "author" in p ? p.author : "",
        permlink: "permlink" in p ? p.permlink : "",
      }))
      .filter((p) => p.author && p.permlink);
  }, [posts]);

  // Fetch all soft votes in a single batch
  const overlays = useSoftVoteOverlays(normalizedPosts);

  // Create lookup function
  const getVote = useMemo(() => {
    return (author: string, permlink: string): SoftVoteOverlay | null => {
      if (!userId || !author || !permlink) return null;
      const key = `${userId}:${author}/${permlink}`;
      return overlays[key] ?? null;
    };
  }, [overlays, userId]);

  const value = useMemo(() => ({ getVote }), [getVote]);

  return (
    <SoftVoteContext.Provider value={value}>
      {children}
    </SoftVoteContext.Provider>
  );
}

export default SoftVoteProvider;
