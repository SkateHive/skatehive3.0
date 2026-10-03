"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { findPosts } from "@/lib/hive/client-functions";
import { filterAutoComments } from "@/lib/utils/postUtils";
import { useProfileDebug } from "@/lib/utils/profileDebug";

// Bridge `get_account_posts` rejects limits above 20.
const PAGE_SIZE = 20;
// A page can be entirely moderation-filtered. Walk a few of those before
// giving up so the grid does not sit on a skeleton with hasMore still true.
const MAX_FILTERED_PAGES = 5;

export default function useProfilePosts(username: string, enabled: boolean = true) {
    const debug = useProfileDebug("useProfilePosts");
    const [posts, setPosts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const isFetching = useRef(false);
    const hasFetchedInitial = useRef(false);
    const seenKeys = useRef<Set<string>>(new Set());
    const params = useRef([
        username,
        "",
        new Date().toISOString().split(".")[0],
        PAGE_SIZE,
    ]);

    const fetchPosts = useCallback(async () => {
        if (isFetching.current || !username) return;
        isFetching.current = true;
        setIsLoading(true);
        setError(null);
        debug.fetch("fetching posts", { username, hasFetchedInitial: hasFetchedInitial.current });
        try {
            let more = false;
            for (let pageIndex = 0; pageIndex < MAX_FILTERED_PAGES; pageIndex++) {
                const rawPosts = await findPosts("author_before_date", params.current);
                const page = Array.isArray(rawPosts) ? rawPosts : [];
                if (page.length === 0) {
                    more = false;
                    break;
                }
                // Pagination cursor needs the last RAW item (admin-downvoted
                // posts must still advance the cursor or we'd loop forever
                // on a flagged tail). Filter only before storing for render.
                const last = page[page.length - 1];
                params.current = [username, last.permlink, last.created, PAGE_SIZE];
                const fresh = filterAutoComments(page).filter((post) => {
                    const key = `${post.author}/${post.permlink}`;
                    if (seenKeys.current.has(key)) return false;
                    seenKeys.current.add(key);
                    return true;
                });
                if (fresh.length > 0) {
                    setPosts((prevPosts) => [...prevPosts, ...fresh]);
                    more = page.length >= PAGE_SIZE;
                    break;
                }
                if (page.length < PAGE_SIZE) {
                    more = false;
                    break;
                }
            }
            setHasMore(more);
            hasFetchedInitial.current = true;
        } catch (err) {
            console.error("Failed to load profile posts", err);
            setError("load_failed");
            setHasMore(false);
            hasFetchedInitial.current = true;
        } finally {
            isFetching.current = false;
            setIsLoading(false);
        }
    }, [username]);

    // Reset posts when username changes
    useEffect(() => {
        if (!username) {
            setPosts([]);
            setIsLoading(false);
            setHasMore(false);
            setError(null);
            hasFetchedInitial.current = false;
            seenKeys.current = new Set();
            return;
        }
        setPosts([]);
        setError(null);
        setHasMore(false);
        hasFetchedInitial.current = false;
        seenKeys.current = new Set();
        params.current = [username, "", new Date().toISOString().split(".")[0], PAGE_SIZE];
        // Only fetch immediately if enabled. When the tab is not active yet,
        // leave loading false so an empty grid does not spin forever.
        if (enabled) {
            setIsLoading(true);
            fetchPosts();
        } else {
            setIsLoading(false);
        }
    }, [username, fetchPosts]);

    // Fetch when enabled becomes true (tab switch) if we haven't fetched yet
    useEffect(() => {
        if (enabled && username && !hasFetchedInitial.current && !isFetching.current) {
            fetchPosts();
        }
    }, [enabled, username, fetchPosts]);

    return { posts, fetchPosts, isLoading, hasMore, error };
}
