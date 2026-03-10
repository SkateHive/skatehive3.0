"use client";
import {
  Box,
  Divider,
  Flex,
  SimpleGrid,
  Skeleton,
  SkeletonCircle,
  Spinner,
} from "@chakra-ui/react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Discussion } from "@hiveio/dhive";
import { findPosts } from "@/lib/hive/client-functions";
import PostGrid from "@/components/blog/PostGrid";
import { filterAutoComments } from "@/lib/utils/postUtils";
import { CommunityTotalPayout } from "../shared";
import { getHiveTagForQuery } from "@/lib/hive/tag-utils";

export default function RightSideBar() {
  const [allPosts, setAllPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollTargetId = "sidebarScrollableDiv";
  const sidebarRef = useRef<HTMLDivElement>(null); // Reference for the sidebar
  const isFetching = useRef(false);
  const seenPosts = useRef<Set<string>>(new Set());
  const prefillInProgress = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const QUERY = "created";
  const tag = getHiveTagForQuery(QUERY);

  const params = useRef([
    {
      tag: tag,
      limit: 8,
      start_author: "",
      start_permlink: "",
    },
  ]);

  const fetchPosts = useCallback(async () => {
    if (isFetching.current || !hasMore) return; // Prevent multiple fetches
    isFetching.current = true;
    setIsLoading(true); // Set loading state
    try {
      const posts: Discussion[] = await findPosts(QUERY, params.current);
      const filteredPosts = filterAutoComments(posts);

      // Filter out duplicates to avoid runaway list growth
      const freshPosts = filteredPosts.filter((post) => {
        const key = `${post.author}/${post.permlink}`;
        if (seenPosts.current.has(key)) return false;
        seenPosts.current.add(key);
        return true;
      });

      if (freshPosts.length === 0) {
        setHasMore(false);
        return;
      }

      setAllPosts((prevPosts) => [...prevPosts, ...freshPosts]);
      const lastPost = freshPosts[freshPosts.length - 1];
      if (lastPost) {
        params.current = [
          {
            tag: tag,
            limit: 8,
            start_author: lastPost.author,
            start_permlink: lastPost.permlink,
          },
        ];
      } else {
        setHasMore(false);
      }
      if (posts.length < (params.current[0]?.limit || 8)) {
        setHasMore(false);
      }
    } catch (error) {
      // Error fetching leaderboard data
    } finally {
      isFetching.current = false;
      setIsLoading(false); // Reset loading state
    }
  }, [tag, hasMore]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const prefillIfNeeded = useCallback(async () => {
    if (prefillInProgress.current || !hasMore) return;
    const sidebar = sidebarRef.current;
    if (!sidebar) return;

    prefillInProgress.current = true;
    try {
      let iterations = 0;
      const maxIterations = 4; // Avoid runaway loops
      while (iterations < maxIterations) {
        const needsMore =
          sidebar.scrollHeight <= sidebar.clientHeight * 1.5 + 200;
        if (!needsMore || !hasMore) break;
        if (isFetching.current) {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        await fetchPosts();
        iterations += 1;
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      prefillInProgress.current = false;
    }
  }, [fetchPosts, hasMore]);

  useEffect(() => {
    prefillIfNeeded();
  }, [prefillIfNeeded, allPosts]);

  useEffect(() => {
    // Aggressive prefill on mount to ensure content is visible without user scroll
    prefillIfNeeded();
  }, [prefillIfNeeded]);

  useEffect(() => {
    if (!hasMore) return;
    const sidebar = sidebarRef.current;
    const sentinel = sentinelRef.current;
    if (!sidebar || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLoading) {
            fetchPosts();
          }
        });
      },
      { root: sidebar, rootMargin: "400px 0px", threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchPosts, hasMore, isLoading]);

  return (
    <Box
      as="aside"
      w={{ base: "100%", md: "400px" }}
      h="100vh"
      overflowY="auto"
      pr={4}
      pt={2}
      position={"sticky"}
      top={0}
      ref={sidebarRef}
      id={scrollTargetId}
      sx={{
        "&::-webkit-scrollbar": {
          display: "none",
        },
        scrollbarWidth: "none",
      }}
    >
      <CommunityTotalPayout />
      <Divider my={2} borderColor="muted" />
      {allPosts.length > 0 ? (
        <PostGrid posts={allPosts} columns={1} />
      ) : isLoading ? (
        <SimpleGrid columns={1} spacing={4} mt={2}>
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <Box
                key={i}
                borderRadius="base"
                overflow="hidden"
                p={4}
                bg="muted"
              >
                <Flex alignItems="center" mb={4}>
                  <SkeletonCircle size="10" mr={3} startColor="muted" endColor="primary" />
                  <Skeleton height="20px" width="100px" startColor="muted" endColor="primary" />
                </Flex>
                <Skeleton height="160px" width="100%" mb={4} startColor="muted" endColor="primary" />
                <Skeleton height="16px" width="80%" mb={2} startColor="muted" endColor="primary" />
                <Skeleton height="16px" width="60%" startColor="muted" endColor="primary" />
              </Box>
            ))}
        </SimpleGrid>
      ) : null}
      <Box ref={sentinelRef} h="1px" />
      {isLoading && allPosts.length > 0 && (
        <Flex align="center" justify="center" py={4}>
          <Spinner size="sm" color="primary" />
        </Flex>
      )}
    </Box>
  );
}
