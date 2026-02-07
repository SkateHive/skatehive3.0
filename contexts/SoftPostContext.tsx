"use client";

import React, { useMemo } from "react";
import { Discussion } from "@hiveio/dhive";
import {
  useSoftPostOverlays,
  SoftPostOverlay,
  SoftPostContext,
} from "@/hooks/useSoftPostOverlay";
import { extractSafeUser } from "@/lib/userbase/safeUserMetadata";

// Re-export for convenience
export { SoftPostContext };

export function useSoftPostContext() {
  const context = React.useContext(SoftPostContext);
  return context ?? { getPost: () => null };
}

interface SoftPostProviderProps {
  posts: Array<{ author: string; permlink: string; json_metadata?: string }> | Discussion[];
  children: React.ReactNode;
}

/**
 * Provider that fetches soft post overlays for a list of posts in a single batch request.
 * Use this at the list level (SnapList, PostList, etc.) to avoid N+1 API calls.
 *
 * @example
 * <SoftPostProvider posts={comments}>
 *   {comments.map(c => <Snap key={c.permlink} discussion={c} />)}
 * </SoftPostProvider>
 */
export function SoftPostProvider({ posts, children }: SoftPostProviderProps) {
  // Normalize posts to the format expected by useSoftPostOverlays
  const normalizedPosts = useMemo(() => {
    return posts
      .map((p) => ({
        author: "author" in p ? p.author : "",
        permlink: "permlink" in p ? p.permlink : "",
        safe_user:
          "json_metadata" in p
            ? extractSafeUser(p.json_metadata)
            : null,
      }))
      .filter((p) => p.author && p.permlink);
  }, [posts]);

  // Fetch all soft post overlays in a single batch
  const overlays = useSoftPostOverlays(normalizedPosts);

  // Create lookup function
  const getPost = useMemo(() => {
    return (author: string, permlink: string): SoftPostOverlay | null => {
      if (!author || !permlink) return null;
      const key = `${author.trim()}/${permlink.trim()}`;
      return overlays[key] ?? null;
    };
  }, [overlays]);

  const value = useMemo(() => ({ getPost }), [getPost]);

  return (
    <SoftPostContext.Provider value={value}>
      {children}
    </SoftPostContext.Provider>
  );
}

export default SoftPostProvider;
