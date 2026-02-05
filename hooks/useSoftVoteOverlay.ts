"use client";

import { useContext, useEffect, useMemo, useState, createContext } from "react";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

export interface SoftVoteOverlay {
  author: string;
  permlink: string;
  weight: number;
  status: "queued" | "broadcasted" | "failed" | string;
  updated_at?: string | null;
}

const overlayCache = new Map<string, SoftVoteOverlay | null>();
const inflight = new Map<string, Promise<void>>();

// Context for batch-provided soft votes (set by SoftVoteProvider)
interface SoftVoteContextValue {
  getVote: (author: string, permlink: string) => SoftVoteOverlay | null;
}

export const SoftVoteContext = createContext<SoftVoteContextValue | null>(null);

function getKey(userId: string, author?: string | null, permlink?: string | null) {
  if (!author || !permlink) return null;
  return `${userId}:${author}/${permlink}`;
}

async function fetchVotes(
  posts: Array<{ author: string; permlink: string }>
) {
  const response = await fetch("/api/userbase/soft-votes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ posts }),
  });
  if (!response.ok) {
    throw new Error("Failed to load soft votes");
  }
  const data = await response.json();
  return Array.isArray(data?.items) ? data.items : [];
}

export function useSoftVoteOverlays(
  posts: Array<{ author: string; permlink: string }>
) {
  const { user } = useUserbaseAuth();
  const userId = user?.id || null;

  const signature = useMemo(() => {
    if (!userId) return "";
    const list = posts
      .filter((post) => post.author && post.permlink)
      .map((post) => `${post.author}/${post.permlink}`);
    const unique = Array.from(new Set(list));
    unique.sort();
    return `${userId}:${unique.join("|")}`;
  }, [posts, userId]);

  const keys = useMemo(() => {
    if (!signature) return [];
    const [, list] = signature.split(":");
    if (!list) return [];
    return list.split("|").map((key) => `${userId}:${key}`);
  }, [signature, userId]);

  const [overlays, setOverlays] = useState<Record<string, SoftVoteOverlay>>({});

  useEffect(() => {
    let mounted = true;
    if (!userId) {
      if (mounted) {
        setOverlays({});
      }
      return;
    }
    if (keys.length === 0) {
      if (mounted) {
        setOverlays({});
      }
      return;
    }

    const cached: Record<string, SoftVoteOverlay> = {};
    const missing: Array<{ author: string; permlink: string }> = [];

    keys.forEach((key) => {
      const cachedValue = overlayCache.get(key);
      if (cachedValue) {
        cached[key] = cachedValue;
        return;
      }
      if (cachedValue === null) {
        return;
      }
      const [, rest] = key.split(":");
      const [author, permlink] = rest.split("/", 2);
      missing.push({ author, permlink });
    });

    if (mounted) {
      setOverlays(cached);
    }

    if (missing.length === 0) {
      return;
    }

    const batchKey = `${userId}:${missing
      .map((post) => `${post.author}/${post.permlink}`)
      .join("|")}`;

    if (inflight.has(batchKey)) {
      inflight.get(batchKey)!.finally(() => {
        if (!mounted) return;
        const next: Record<string, SoftVoteOverlay> = {};
        keys.forEach((key) => {
          const cachedValue = overlayCache.get(key);
          if (cachedValue) {
            next[key] = cachedValue;
          }
        });
        setOverlays(next);
      });
      return;
    }

    const request = fetchVotes(missing)
      .then((items: SoftVoteOverlay[]) => {
        if (!mounted) return;
        const found = new Set<string>();
        items.forEach((item) => {
          const key = getKey(userId, item.author, item.permlink);
          if (!key) return;
          overlayCache.set(key, item);
          found.add(key);
        });
        missing.forEach((post) => {
          const key = getKey(userId, post.author, post.permlink);
          if (key && !found.has(key)) {
            overlayCache.set(key, null);
          }
        });
      })
      .catch((error) => {
        console.error("Failed to fetch soft votes:", error);
      })
      .finally(() => {
        inflight.delete(batchKey);
        if (!mounted) return;
        const next: Record<string, SoftVoteOverlay> = {};
        keys.forEach((key) => {
          const cachedValue = overlayCache.get(key);
          if (cachedValue) {
            next[key] = cachedValue;
          }
        });
        setOverlays(next);
      });

    inflight.set(batchKey, request);

    return () => {
      mounted = false;
    };
  }, [signature, userId, keys]);

  return overlays;
}

/**
 * Hook to get soft vote overlay for a single post.
 * 
 * If used within a SoftVoteProvider, it will use the batch-fetched data
 * (no additional API call). Otherwise, it will fetch individually.
 * 
 * For best performance, wrap your list component with SoftVoteProvider.
 */
export default function useSoftVoteOverlay(author?: string, permlink?: string) {
  const { user } = useUserbaseAuth();
  const context = useContext(SoftVoteContext);

  // If we have a SoftVoteProvider context, use it (batch fetch already done)
  if (context && author && permlink) {
    return context.getVote(author, permlink);
  }

  // Fallback: fetch individually (this causes N+1 problem, avoid if possible)
  const overlays = useSoftVoteOverlays(
    author && permlink ? [{ author, permlink }] : []
  );
  if (!user) return null;
  const key = getKey(user.id, author, permlink);
  return key ? overlays[key] ?? null : null;
}
