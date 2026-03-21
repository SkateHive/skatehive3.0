"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { findPosts } from "@/lib/hive/client-functions";
import { useProfileDebug } from "@/lib/utils/profileDebug";

export default function useProfilePosts(username: string, enabled: boolean = true) {
    const debug = useProfileDebug("useProfilePosts");
    const [posts, setPosts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const isFetching = useRef(false);
    const hasFetchedInitial = useRef(false);
    const params = useRef([
        username,
        "",
        new Date().toISOString().split(".")[0],
        20, // Bridge API max limit
    ]);

    const fetchPosts = useCallback(async () => {
        if (isFetching.current || !username) return;
        isFetching.current = true;
        debug.fetch("fetching posts", { username, hasFetchedInitial: hasFetchedInitial.current });
        try {
            const newPosts = await findPosts("author_before_date", params.current);
            if (newPosts && newPosts.length > 0) {
                setPosts((prevPosts) => [...prevPosts, ...newPosts]);
                params.current = [
                    username,
                    newPosts[newPosts.length - 1].permlink,
                    newPosts[newPosts.length - 1].created,
                    20, // Bridge API max limit
                ];
            }
            setIsLoading(false);
            isFetching.current = false;
            hasFetchedInitial.current = true;
        } catch (err) {
            setIsLoading(false);
            isFetching.current = false;
        }
    }, [username]);

    // Reset posts when username changes
    useEffect(() => {
        if (!username) {
            setPosts([]);
            setIsLoading(false);
            hasFetchedInitial.current = false;
            return;
        }
        setPosts([]);
        setIsLoading(true);
        hasFetchedInitial.current = false;
        params.current = [username, "", new Date().toISOString().split(".")[0], 20];
        // Only fetch immediately if enabled
        if (enabled) {
            fetchPosts();
        }
    }, [username, fetchPosts]);

    // Fetch when enabled becomes true (tab switch) if we haven't fetched yet
    useEffect(() => {
        if (enabled && username && !hasFetchedInitial.current && !isFetching.current) {
            fetchPosts();
        }
    }, [enabled, username, fetchPosts]);

    return { posts, fetchPosts, isLoading };
}
