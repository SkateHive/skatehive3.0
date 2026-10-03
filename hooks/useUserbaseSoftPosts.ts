"use client";

import { useEffect, useMemo, useState } from "react";
import { Discussion } from "@hiveio/dhive";

interface SoftPostRow {
  id: string;
  author: string;
  permlink: string;
  title: string | null;
  type: string | null;
  status: string;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

function mapSoftPostToDiscussion(row: SoftPostRow): Discussion {
  const metadata = row.metadata || {};
  const onchain = metadata.onchain || metadata.json_metadata || {};
  const body = metadata.body || "";
  const created = row.created_at || "";

  return {
    author: row.author,
    permlink: row.permlink,
    title: row.title || "",
    body,
    created,
    last_update: created,
    json_metadata: JSON.stringify(onchain),
    parent_author: metadata.parent_author || "",
    parent_permlink: metadata.parent_permlink || "",
    active_votes: [],
    pending_payout_value: "0.000 HBD",
    total_payout_value: "0.000 HBD",
    curator_payout_value: "0.000 HBD",
    __softType: row.type,
  } as unknown as Discussion;
}

export default function useUserbaseSoftPosts(userId?: string | null) {
  const [posts, setPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const queryString = useMemo(() => {
    if (!userId) return "";
    const params = new URLSearchParams();
    params.set("user_id", userId);
    params.set("limit", "100");
    return params.toString();
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    if (!queryString) {
      setPosts([]);
      setIsLoading(false);
      return;
    }

    const loadPosts = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/userbase/soft-posts/by-user?${queryString}`,
          { cache: "no-store", signal: AbortSignal.timeout(12000) }
        );
        if (!mounted) return;
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Failed to load posts");
        }
        const items = Array.isArray(data?.items) ? data.items : [];
        setPosts(items.map(mapSoftPostToDiscussion));
      } catch (error) {
        if (mounted) {
          setPosts([]);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      mounted = false;
    };
  }, [queryString]);

  return { posts, isLoading };
}
