"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  Heading,
  SimpleGrid,
  Link as ChakraLink,
  Image,
  Text,
  Badge,
  Flex,
  Spinner,
  Center,
} from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import HiveClient from "@/lib/hive/hiveclient";
import { extractImageUrls } from "@/lib/utils/extractImageUrls";
import NextLink from "next/link";
import { trackInternalLinkClick } from "@/lib/analytics/events";
import { usePathname } from "next/navigation";
import { HIVE_CONFIG } from "@/config/app.config";

// Parse the tag list out of a Hive post's json_metadata, which can arrive
// as an object, JSON string, or double-encoded JSON string.
function parsePostTags(jsonMetadata: unknown): string[] {
  if (!jsonMetadata) return [];
  try {
    let meta: any = jsonMetadata;
    if (typeof meta === "string") meta = JSON.parse(meta);
    if (typeof meta === "string") meta = JSON.parse(meta);
    if (Array.isArray(meta?.tags)) {
      return meta.tags.filter(
        (t: any) => typeof t === "string" && t.length > 1,
      );
    }
  } catch {
    // ignore
  }
  return [];
}

interface RelatedPostsProps {
  currentAuthor: string;
  currentPermlink: string;
  tags: string[];
  limit?: number;
}

export default function RelatedPosts({
  currentAuthor,
  currentPermlink,
  tags,
  limit = 4,
}: RelatedPostsProps) {
  const [posts, setPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  const handleLinkClick = (targetAuthor: string, targetPermlink: string, position: number) => {
    trackInternalLinkClick({
      linkType: 'related_post',
      sourceUrl: pathname || '',
      targetUrl: `/post/${targetAuthor}/${targetPermlink}`,
      position,
    });
  };

  useEffect(() => {
    loadRelatedPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tags]);

  const loadRelatedPosts = async () => {
    setIsLoading(true);
    try {
      // Pull trending posts from the Skatehive community only — the
      // previous `getDiscussions({ tag: <topic> })` returned posts from
      // anywhere on Hive that shared a tag like "travel", which surfaced
      // unrelated content.
      const skatehivePosts: Discussion[] = await HiveClient.call(
        "bridge",
        "get_ranked_posts",
        {
          sort: "trending",
          tag: HIVE_CONFIG.COMMUNITY_TAG,
          limit: 20,
          observer: "",
        },
      );

      if (!skatehivePosts || skatehivePosts.length === 0) {
        setPosts([]);
        return;
      }

      // Generic tags shouldn't drive "relatedness" — every Skatehive post
      // has them, so they'd score equal weight on everything.
      const GENERIC_TAGS = new Set([
        "skatehive",
        "skateboarding",
        "skate",
        HIVE_CONFIG.COMMUNITY_TAG,
      ]);
      const currentTopicTags = new Set(
        tags
          .map((t) => t.toLowerCase())
          .filter((t) => !GENERIC_TAGS.has(t)),
      );

      // Score each Skatehive post by how many of the current post's
      // topic tags it shares; trending order is the tiebreaker.
      const ranked = skatehivePosts
        .filter(
          (p) =>
            !(p.author === currentAuthor && p.permlink === currentPermlink),
        )
        .map((p, idx) => {
          const postTags = parsePostTags(p.json_metadata);
          const overlap = postTags.reduce(
            (n, t) =>
              currentTopicTags.has(t.toLowerCase()) && !GENERIC_TAGS.has(t.toLowerCase())
                ? n + 1
                : n,
            0,
          );
          return { post: p, overlap, idx };
        })
        .sort((a, b) => b.overlap - a.overlap || a.idx - b.idx)
        .slice(0, limit)
        .map(({ post }) => post);

      setPosts(ranked);
    } catch (error) {
      console.error("Error loading related posts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Box py={8}>
        <Center>
          <Spinner size="lg" color="primary" />
        </Center>
      </Box>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  return (
    <Box py={8} borderTop="1px solid" borderColor="whiteAlpha.200" mt={10}>
      <Heading as="h2" fontSize="2xl" mb={6} color="primary">
        Related Posts
      </Heading>
      <SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={4}>
        {posts.map((post, index) => {
          const images = extractImageUrls(post.body);
          const thumbnail = images[0] || "/ogimage.png";
          const cleanAuthor = post.author.startsWith("@")
            ? post.author.slice(1)
            : post.author;

          return (
            <ChakraLink
              as={NextLink}
              key={`${post.author}/${post.permlink}`}
              href={`/post/${cleanAuthor}/${post.permlink}`}
              onClick={() => handleLinkClick(cleanAuthor, post.permlink, index + 1)}
              _hover={{ textDecoration: "none" }}
                display="block"
                bg="rgba(20,20,20,0.4)"
                border="1px solid"
                borderColor="whiteAlpha.200"
                borderRadius="md"
                overflow="hidden"
                transition="all 0.3s"
                _groupHover={{
                  borderColor: "primary",
                  transform: "translateY(-2px)",
                  boxShadow: "0 0 15px rgba(138, 255, 0, 0.2)",
                }}
                role="group"
              >
                <Box
                  position="relative"
                  paddingBottom="56.25%"
                  bg="gray.900"
                  overflow="hidden"
                >
                  <Image
                    src={thumbnail}
                    alt={post.title || "Related post"}
                    position="absolute"
                    top={0}
                    left={0}
                    w="100%"
                    h="100%"
                    objectFit="cover"
                    transition="transform 0.3s"
                    _groupHover={{ transform: "scale(1.05)" }}
                  />
                </Box>
                <Box p={3}>
                  <Text
                    fontSize="sm"
                    fontWeight="bold"
                    color="white"
                    mb={1}
                    noOfLines={2}
                    _groupHover={{ color: "primary" }}
                  >
                    {post.title || "Untitled"}
                  </Text>
                  <Flex justify="space-between" align="center" mt={2}>
                    <Text fontSize="xs" color="gray.500">
                      @{cleanAuthor}
                    </Text>
                    <Badge colorScheme="green" fontSize="xs">
                      {post.children}
                    </Badge>
                  </Flex>
                </Box>
              </ChakraLink>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
