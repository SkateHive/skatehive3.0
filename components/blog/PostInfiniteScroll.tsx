"use client";
import {
  Box,
  Button,
  Skeleton,
  SimpleGrid,
  Flex,
  SkeletonCircle,
  Text,
} from "@chakra-ui/react";
import InfiniteScroll from "react-infinite-scroll-component";
import PostGrid from "@/components/blog/PostGrid";
import { Discussion } from "@hiveio/dhive";
import { useTranslations } from "@/lib/i18n/hooks";

/**
 * PostsInfiniteScroll Props
 *
 * Note: `hasMore` must be explicitly managed by the parent and passed in.
 * The component does NOT assume a default value to avoid accidental infinite loading.
 */
interface PostsInfiniteScrollProps {
  allPosts: Discussion[];
  fetchPosts: () => Promise<void>;
  /** Whether there are more items to load. Parent MUST manage this. */
  hasMore: boolean;
  isLoading?: boolean;
  /** Set when the feed failed to load. Shown instead of an endless skeleton. */
  error?: string | null;
  onRetry?: () => void;
  viewMode: "grid" | "list" | "magazine";
  context?: "blog" | "profile" | "rightsidebar";
  hideAuthorInfo?: boolean;
  scrollableTargetId?: string;
  scrollThreshold?: number | string;
}

export default function PostsInfiniteScroll({
  allPosts,
  fetchPosts,
  viewMode,
  context = "blog",
  hideAuthorInfo = false,
  hasMore,
  isLoading = false,
  error = null,
  onRetry,
  scrollableTargetId = "scrollableDiv",
  scrollThreshold = "200px",
}: PostsInfiniteScrollProps) {
  const t = useTranslations("common");
  // Determine columns based on context and viewMode
  const columns =
    viewMode === "grid" || viewMode === "magazine"
      ? context === "rightsidebar"
        ? 1
        : context === "profile"
        ? 2
        : 3
      : 1;

  // Safety: ensure hasMore is a boolean; default to false at runtime to avoid accidental infinite loads
  const safeHasMore = typeof hasMore === "boolean" ? hasMore : false;

  const skeletonGrid = (
    <SimpleGrid columns={{ base: 1, md: columns }} spacing={4}>
      {Array(6)
        .fill(0)
        .map((_, i) => (
          <Box key={i} borderRadius="base" overflow="hidden" p={4} bg="muted">
            {/* Header: avatar + author */}
            <Flex alignItems="center" mb={4}>
              <SkeletonCircle
                size="10"
                mr={3}
                startColor="muted"
                endColor="primary"
              />
              <Skeleton
                height="20px"
                width="100px"
                startColor="muted"
                endColor="primary"
              />
            </Flex>
            {/* Main image/media */}
            <Skeleton
              height="200px"
              width="100%"
              mb={4}
              startColor="muted"
              endColor="primary"
            />
            {/* Title */}
            <Skeleton
              height="20px"
              width="80%"
              mb={2}
              startColor="muted"
              endColor="primary"
            />
            {/* Summary */}
            <Skeleton
              height="20px"
              width="60%"
              startColor="muted"
              endColor="primary"
            />
          </Box>
        ))}
    </SimpleGrid>
  );

  // Zero posts must not fall through to InfiniteScroll. With hasMore left
  // true, its loader is this same skeleton and it never goes away, because
  // dataLength stays 0.
  if (allPosts.length === 0) {
    if (isLoading) return skeletonGrid;
    return (
      <Box py={10} px={4} textAlign="center">
        <Text color="text" mb={error ? 4 : 0}>
          {error ? t("postsLoadError") : t("noPosts")}
        </Text>
        {error && onRetry && (
          <Button
            size="sm"
            variant="outline"
            borderColor="primary"
            color="primary"
            onClick={onRetry}
          >
            {t("tryAgain")}
          </Button>
        )}
      </Box>
    );
  }

  return (
    <InfiniteScroll
      dataLength={allPosts.length}
      next={fetchPosts}
      hasMore={safeHasMore}
      scrollThreshold={scrollThreshold}
      loader={skeletonGrid}
      scrollableTarget={scrollableTargetId}
    >
      {allPosts && (
        <PostGrid
          posts={allPosts ?? []}
          columns={columns}
          listView={viewMode === "list"}
          hideAuthorInfo={hideAuthorInfo}
        />
      )}
    </InfiniteScroll>
  );
}
