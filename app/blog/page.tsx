"use client";
import {
  Box,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { Discussion } from "@hiveio/dhive";
import { findPosts } from "@/lib/hive/client-functions";
import { filterAutoComments } from "@/lib/utils/postUtils";
import { getHiveTagForQuery } from "@/lib/hive/tag-utils";
import TopBar from "@/components/blog/TopBar";
import PostInfiniteScroll from "@/components/blog/PostInfiniteScroll";
import { useSearchParams, useRouter } from "next/navigation";
import JoinSkatehiveBanner from "@/components/blog/JoinSkatehiveBanner";
import PostGrid from "@/components/blog/PostGrid";
import MagazineModal from "@/components/shared/MagazineModal";
import ErrorBoundary from "@/components/shared/ErrorBoundary";
import { useTranslations } from "@/contexts/LocaleContext";
import {
  BLOG_CONFIG,
  VALID_QUERIES,
  VALID_VIEW_MODES,
  type QueryType,
  type ViewMode,
} from "@/config/blog.config";
import { HIVE_CONFIG } from "@/config/app.config";
import { fetchHighestPaidPosts, convertToDiscussionFormat } from "@/services/skatehiveApiService";
import { filterSoftDeletedPosts } from "@/lib/utils/softDelete";

function BlogContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const initialView = searchParams?.get("view");
  const initialQuery = searchParams?.get("query");

  const [viewMode, setViewMode] = useState<ViewMode>(
    VALID_VIEW_MODES.includes(initialView as ViewMode)
      ? (initialView as ViewMode)
      : "grid"
  );
  const [query, setQuery] = useState<QueryType>(
    VALID_QUERIES.includes(initialQuery as QueryType)
      ? (initialQuery as QueryType)
      : "created"
  );
  const [allPosts, setAllPosts] = useState<Discussion[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const hasMoreRef = useRef(true);
  const isFetching = useRef(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const setHasMoreState = useCallback((value: boolean) => {
    hasMoreRef.current = value;
    setHasMore(value);
  }, []);
  const seenPosts = useRef<Set<string>>(new Set());
  const prefetchBatch = useRef<{
    posts: Discussion[];
    lastPost?: Discussion;
    batchHasMore: boolean;
  } | null>(null);
  const prefetching = useRef(false);
  const [isGoatLoading, setIsGoatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const tag = getHiveTagForQuery(query);
  const FETCH_LIMIT = Math.min(
    BLOG_CONFIG.BRIDGE_API_MAX_LIMIT,
    BLOG_CONFIG.POSTS_PER_PAGE * 2
  );
  const MAX_EMPTY_BATCHES = 2;

  const params = useRef([
    {
      tag: tag,
      limit: FETCH_LIMIT,
      start_author: "",
      start_permlink: "",
    },
  ]);

  const fetchGoatPosts = useCallback(async () => {
    setIsGoatLoading(true);
    setIsInitialLoading(true);
    setAllPosts([]);
    setError(null);

    try {
      // Use the Skatehive API to get all-time highest paid posts (GOAT)
      const response = await fetchHighestPaidPosts({
        page: 1,
        limit: BLOG_CONFIG.POSTS_PER_PAGE,
        days: null, // All time = GOAT
      });

      // Convert API response to Discussion format for compatibility
      const posts = response.posts.map(post =>
        convertToDiscussionFormat(post) as unknown as Discussion
      );
      const visiblePosts = await filterSoftDeletedPosts(posts);
      setAllPosts(visiblePosts);
      setHasMoreState(false); // GOAT posts don't paginate infinitely
    } catch (error) {
      console.error("Failed to fetch GOAT posts:", error);
      setError(t('blog.failedToLoadGoat'));
    } finally {
      setIsGoatLoading(false);
      setIsInitialLoading(false);
    }
  }, [t, setHasMoreState]);

  // Fetch highest paid posts from recent period (e.g., last 30 days)
  const fetchHighestPaidPostsRecent = useCallback(async () => {
    setIsGoatLoading(true);
    setIsInitialLoading(true);
    setAllPosts([]);
    setError(null);

    try {
      // Use the Skatehive API to get highest paid posts from last 30 days
      const response = await fetchHighestPaidPosts({
        page: 1,
        limit: BLOG_CONFIG.POSTS_PER_PAGE,
        days: 30, // Last 30 days
      });

      // Convert API response to Discussion format for compatibility
      const posts = response.posts.map(post =>
        convertToDiscussionFormat(post) as unknown as Discussion
      );
      const visiblePosts = await filterSoftDeletedPosts(posts);
      setAllPosts(visiblePosts);
      setHasMoreState(false); // Don't paginate infinitely
    } catch (error) {
      console.error("Failed to fetch highest paid posts:", error);
      setError(t('blog.failedToLoad'));
    } finally {
      setIsGoatLoading(false);
      setIsInitialLoading(false);
    }
  }, [t, setHasMoreState]);

  const fetchBatch = useCallback(async () => {
    const posts = await findPosts(query, params.current);
    const filteredPosts = filterAutoComments(posts);

    const limit = params.current[0]?.limit || FETCH_LIMIT;
    const batchHasMore = posts.length >= limit;
    const lastPost = posts[posts.length - 1];

    return { posts: filteredPosts, lastPost, batchHasMore };
  }, [query, FETCH_LIMIT]);

  const appendBatch = useCallback(
    (
      posts: Discussion[],
      lastPost: Discussion | undefined,
      batchHasMore: boolean
    ) => {
      const nextCanPrefetch = batchHasMore && Boolean(lastPost);

      // Filter out already seen posts to avoid bloating state
      const freshPosts = (posts || []).filter((post) => {
        const key = `${post.author}/${post.permlink}`;
        if (seenPosts.current.has(key)) return false;
        seenPosts.current.add(key);
        return true;
      });

      if (freshPosts.length > 0) {
        setAllPosts((prevPosts) => [...prevPosts, ...freshPosts]);
      }

      setHasMoreState(nextCanPrefetch);

      if (nextCanPrefetch && lastPost) {
        params.current = [
          {
            tag: tag,
            limit: params.current[0]?.limit || FETCH_LIMIT,
            start_author: lastPost.author,
            start_permlink: lastPost.permlink,
          },
        ];
      }

      return { nextCanPrefetch, didAppend: freshPosts.length > 0 };
    },
    [tag, FETCH_LIMIT, setHasMoreState]
  );

  const startPrefetch = useCallback(
    async (canPrefetch: boolean) => {
      if (!canPrefetch || prefetching.current) return;
      prefetching.current = true;
      try {
        const batch = await fetchBatch();
        prefetchBatch.current = batch;
      } catch (error) {
        console.error("Failed to prefetch posts:", error);
      } finally {
        prefetching.current = false;
      }
    },
    [fetchBatch]
  );

  const fetchPosts = useCallback(async () => {
    if (query === "goat") {
      fetchGoatPosts();
      return;
    }
    if (query === "highest_paid") {
      fetchHighestPaidPostsRecent();
      return;
    }
    if (!hasMoreRef.current) return;
    if (isFetching.current) return; // Prevent multiple fetches
    if (!tag) {
      setError(t('blog.cannotFetchMissingTag'));
      return;
    }

    isFetching.current = true;
    setError(null);

    try {
      let attempts = 0;
      let didAppend = false;
      let nextCanPrefetch = false;

      while (!didAppend && attempts <= MAX_EMPTY_BATCHES) {
        const batch =
          prefetchBatch.current && !prefetching.current
            ? prefetchBatch.current
            : await fetchBatch();

        prefetchBatch.current = null;

        const appendResult = appendBatch(
          batch.posts,
          batch.lastPost,
          batch.batchHasMore
        );

        didAppend = appendResult.didAppend;
        nextCanPrefetch = appendResult.nextCanPrefetch;

        if (!nextCanPrefetch) break;
        attempts += 1;
      }

      startPrefetch(Boolean(nextCanPrefetch));
    } catch (error) {
      console.error("Failed to fetch posts:", error);
      setError(t('blog.failedToLoad'));
    } finally {
      isFetching.current = false;
      setIsInitialLoading(false);
    }
  }, [
    query,
    tag,
    fetchGoatPosts,
    fetchHighestPaidPostsRecent,
    fetchBatch,
    appendBatch,
    startPrefetch,
    MAX_EMPTY_BATCHES,
    t,
  ]);

  useEffect(() => {
    // Clean up posts and reset state when query changes
    setAllPosts([]);
    setHasMoreState(true);
    seenPosts.current = new Set();
    prefetchBatch.current = null;
    prefetching.current = false;
    setError(null);
    isFetching.current = false;
    setIsInitialLoading(true);
    params.current = [
      {
        tag: tag,
        limit: FETCH_LIMIT,
        start_author: "",
        start_permlink: "",
      },
    ];
    if (query === "goat") {
      fetchGoatPosts();
    } else if (query === "highest_paid") {
      fetchHighestPaidPostsRecent();
    } else {
      fetchPosts();
    }
  }, [fetchPosts, fetchGoatPosts, fetchHighestPaidPostsRecent, query, tag, FETCH_LIMIT, setHasMoreState]);

  // Detect mobile and force grid view
  useEffect(() => {
    function handleResize() {
      if (typeof window !== "undefined") {
        if (window.innerWidth < 768) {
          setViewMode("grid");
        }
      }
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Modal logic for magazine view
  const isMagazineOpen = viewMode === "magazine";
  const closeMagazine = () => {
    // Simple state change - just close the magazine
    setViewMode("grid");
  };
  // Magazine props (same as /magazine/page.tsx)
  const magazineTag = [{ tag: HIVE_CONFIG.COMMUNITY_TAG, limit: 20 }]; // Bridge API max limit is 20
  const magazineQuery = "created"; // Use trending for blog magazine view

  return (
    <>
      {/* Magazine Modal */}
      {isMagazineOpen && (
        <MagazineModal
          isOpen={isMagazineOpen}
          onClose={closeMagazine}
          magazineTag={magazineTag}
          magazineQuery={magazineQuery}
        />
      )}
      {/* Main Blog Content */}
      <Box
        id="scrollableDiv"
        maxW="container.lg"
        mx="auto"
        maxH="100vh"
        overflowY="auto"
        p={0}
        sx={{
          "&::-webkit-scrollbar": { display: "none" },
          scrollbarWidth: "none",
        }}
      >
        <JoinSkatehiveBanner />
        {error && (
          <Alert status="error" mb={4} borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>{t('blog.errorTitle')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Box>
          </Alert>
        )}
        <TopBar
          viewMode={viewMode}
          setViewMode={(mode) => {
            if (typeof window !== "undefined" && window.innerWidth < 768) {
              setViewMode("grid");
              const params = new URLSearchParams(window.location.search);
              params.set("view", "grid");
              router.replace(`/blog?${params.toString()}`);
            } else {
              setViewMode(mode);
              const params = new URLSearchParams(window.location.search);
              params.set("view", mode);
              router.replace(`/blog?${params.toString()}`);
            }
          }}
          setQuery={setQuery}
          onQueryChange={(newQuery: QueryType) => {
            setQuery(newQuery);
            const params = new URLSearchParams(window.location.search);
            params.set("query", newQuery);
            router.replace(`/blog?${params.toString()}`);
          }}
        />
        {isGoatLoading && (query === "goat" || query === "highest_paid") && (
          <Box textAlign="center" color="primary" py={4} fontWeight="bold">
            {query === "goat" ? t('blog.scanningGoat') : t('blog.loading')}
          </Box>
        )}
        {query === "goat" || query === "highest_paid" ? (
          <PostGrid posts={allPosts} columns={3} />
        ) : (
          <PostInfiniteScroll
            allPosts={allPosts}
            fetchPosts={fetchPosts}
            viewMode={viewMode}
            context="blog"
            hasMore={hasMore}
            isLoading={isInitialLoading}
          />
        )}
      </Box>
    </>
  );
}

export default function Blog() {
  const t = useTranslations();
  return (
    <ErrorBoundary>
      <Suspense
        fallback={
          <Box
            maxW="container.lg"
            mx="auto"
            maxH="100vh"
            overflowY="auto"
            p={0}
            sx={{
              "&::-webkit-scrollbar": { display: "none" },
              scrollbarWidth: "none",
            }}
          >
            <JoinSkatehiveBanner />
            <Box textAlign="center" color="primary" py={4} fontWeight="bold">
              {t('blog.loading')}
            </Box>
          </Box>
        }
      >
        <BlogContent />
      </Suspense>
    </ErrorBoundary>
  );
}
