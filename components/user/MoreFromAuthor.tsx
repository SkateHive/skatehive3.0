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

interface MoreFromAuthorProps {
  author: string;
  limit?: number;
}

export default function MoreFromAuthor({ author, limit = 6 }: MoreFromAuthorProps) {
  const [posts, setPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuthorPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [author]);

  const loadAuthorPosts = async () => {
    if (!author) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const result = await HiveClient.database.getDiscussions("blog", {
        tag: author,
        limit,
      });

      if (result && result.length > 0) {
        setPosts(result);
      }
    } catch (error) {
      console.error("Error loading author posts:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Box py={6}>
        <Center>
          <Spinner size="md" color="primary" />
        </Center>
      </Box>
    );
  }

  if (posts.length === 0) {
    return null;
  }

  return (
    <Box py={6}>
      <Heading as="h2" fontSize="xl" mb={4} color="primary">
        More from @{author}
      </Heading>
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} spacing={4}>
        {posts.map((post) => {
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
                    alt={post.title || "Post"}
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
                      {new Date(post.created + "Z").toLocaleDateString()}
                    </Text>
                    <Badge colorScheme="green" fontSize="xs">
                      {post.children} comments
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
