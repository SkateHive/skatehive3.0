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
import { extractImageUrls } from "@/lib/utils/extractImages";
import NextLink from "next/link";
import { trackInternalLinkClick } from "@/lib/analytics/events";
import { usePathname } from "next/navigation";

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
    if (!tags || tags.length === 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Pick the most specific tag (usually first non-generic tag)
      const primaryTag =
        tags.find((t) => !["skateboarding", "hive-173115", "skatehive"].includes(t.toLowerCase())) ||
        tags[0];

      const result = await HiveClient.database.getDiscussions("created", {
        tag: primaryTag,
        limit: limit + 5, // fetch extra to filter out current post
      });

      if (result && result.length > 0) {
        // Filter out current post and take only `limit` items
        const filtered = result
          .filter(
            (p) =>
              !(p.author === currentAuthor && p.permlink === currentPermlink)
          )
          .slice(0, limit);
        setPosts(filtered);
      }
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
            <NextLink
              key={`${post.author}/${post.permlink}`}
              href={`/post/${cleanAuthor}/${post.permlink}`}
              passHref
              legacyBehavior
            >
              <ChakraLink
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
            </NextLink>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
