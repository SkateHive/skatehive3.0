"use client";

import { Box, Heading, Text } from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import PostGrid from "@/components/blog/PostGrid";
import Link from "next/link";

interface TagPageClientProps {
  tag: string;
  initialPosts: any[];
}

function formatTagTitle(tag: string): string {
  return tag
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TagPageClient({
  tag,
  initialPosts,
}: TagPageClientProps) {
  const posts = initialPosts as unknown as Discussion[];

  return (
    <Box
      maxW="container.lg"
      mx="auto"
      maxH="100vh"
      overflowY="auto"
      p={4}
      sx={{
        "&::-webkit-scrollbar": { display: "none" },
        scrollbarWidth: "none",
      }}
    >
      <Box mb={4}>
        <Text fontSize="sm" color="gray.500">
          <Link href="/blog" style={{ color: "#a7ff00" }}>
            Blog
          </Link>
          {" / "}
          Tags
          {" / "}
        </Text>
        <Heading as="h1" size="lg" color="white" mt={1}>
          #{tag}
        </Heading>
        <Text color="gray.400" fontSize="sm" mt={1}>
          {posts.length} post{posts.length !== 1 ? "s" : ""} tagged with &quot;{tag}&quot;
        </Text>
      </Box>
      {posts.length > 0 ? (
        <PostGrid posts={posts} columns={3} />
      ) : (
        <Box textAlign="center" py={10}>
          <Text color="gray.400">
            No posts found with tag &quot;{tag}&quot;
          </Text>
        </Box>
      )}
    </Box>
  );
}
