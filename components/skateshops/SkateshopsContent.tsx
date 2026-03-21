"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Heading,
  Text,
  SimpleGrid,
  Spinner,
  Center,
  Button,
  VStack,
  Badge,
  Image,
  Link as ChakraLink,
  Flex,
} from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import HiveClient from "@/lib/hive/hiveclient";
import { extractImageUrls } from "@/lib/utils/extractImageUrls";
import NextLink from "next/link";
import { trackLandingPageVisit } from "@/lib/analytics/events";

export default function SkateshopsContent() {
  const [posts, setPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const POSTS_PER_PAGE = 12;

  // Track landing page visit on mount
  useEffect(() => {
    trackLandingPageVisit({ page: 'skateshops' });
  }, []);

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      const result = await HiveClient.database.getDiscussions("created", {
        tag: "skateshop",
        limit: POSTS_PER_PAGE,
        start_author: page > 0 ? posts[posts.length - 1]?.author : undefined,
        start_permlink: page > 0 ? posts[posts.length - 1]?.permlink : undefined,
      });

      if (result && result.length > 0) {
        // Filter duplicates (first item in pagination is the last from previous page)
        const newPosts = page > 0 ? result.slice(1) : result;
        setPosts((prev) => [...prev, ...newPosts]);
        setHasMore(result.length === POSTS_PER_PAGE);
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading skateshop posts:", error);
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMore = () => {
    if (!isLoading && hasMore) {
      setPage((p) => p + 1);
    }
  };

  return (
    <Box minH="100vh" py={8}>
      <Container maxW="container.xl">
        {/* Hero Section */}
        <VStack spacing={4} mb={10} textAlign="center">
          <Heading
            as="h1"
            className="fretqwik-title"
            fontSize={{ base: "4xl", md: "6xl" }}
            fontWeight="extrabold"
            color="primary"
            letterSpacing="wider"
          >
            Skate Shops Directory
          </Heading>
          <Text fontSize={{ base: "md", md: "lg" }} color="gray.400" maxW="2xl">
            Discover skateboard shops from around the world. From Bless Skate Shop in Brazil to your local spot —
            support the shops that keep skateboarding alive.
          </Text>
          <Badge colorScheme="green" fontSize="sm" px={3} py={1}>
            Community Submitted
          </Badge>
        </VStack>

        {/* SEO Content — visible, not hidden */}
        <Box
          mb={8}
          p={6}
          bg="rgba(20,20,20,0.4)"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="lg"
        >
          <Heading as="h2" fontSize="xl" mb={3} color="primary">
            Support Your Local Skate Shop
          </Heading>
          <Text fontSize="sm" color="gray.300" mb={2}>
            Skateboard shops are the heart of every skate scene. Whether you&apos;re looking for the perfect deck, wheels,
            trucks, or just want to connect with your local community — your skate shop is where it all happens.
          </Text>
          <Text fontSize="sm" color="gray.300">
            Browse shops shared by the Skatehive community, from iconic spots like <strong>Bless Skate Shop</strong> to
            hidden gems in your city. Find gear, watch videos, and support the businesses that support skateboarding.
          </Text>
        </Box>

        {/* Posts Grid */}
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6} mb={8}>
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
                  bg="rgba(20,20,20,0.6)"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="lg"
                  overflow="hidden"
                  transition="all 0.3s"
                  _groupHover={{
                    borderColor: "primary",
                    transform: "translateY(-4px)",
                    boxShadow: "0 0 20px rgba(138, 255, 0, 0.3)",
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
                      alt={post.title || "Skate shop post"}
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
                  <Box p={4}>
                    <Heading
                      as="h3"
                      fontSize="md"
                      fontWeight="bold"
                      color="white"
                      mb={2}
                      noOfLines={2}
                      _groupHover={{ color: "primary" }}
                    >
                      {post.title || "Untitled"}
                    </Heading>
                    <Flex justify="space-between" align="center">
                      <Text fontSize="xs" color="gray.500">
                        by @{cleanAuthor}
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

        {/* Loading State */}
        {isLoading && (
          <Center py={10}>
            <Spinner size="xl" color="primary" />
          </Center>
        )}

        {/* Load More Button */}
        {!isLoading && hasMore && (
          <Center>
            <Button
              onClick={loadMore}
              colorScheme="green"
              size="lg"
              variant="outline"
              borderColor="primary"
              color="primary"
              _hover={{ bg: "primary", color: "background" }}
            >
              Load More Shops
            </Button>
          </Center>
        )}

        {/* No More Posts */}
        {!isLoading && !hasMore && posts.length > 0 && (
          <Center>
            <Text color="gray.500" fontSize="sm">
              End of skate shops list
            </Text>
          </Center>
        )}

        {/* No Posts Found */}
        {!isLoading && posts.length === 0 && (
          <Center py={20}>
            <VStack spacing={4}>
              <Text color="gray.500" fontSize="lg">
                No skate shops found yet.
              </Text>
              <Text color="gray.600" fontSize="sm">
                Be the first to share your local shop!
              </Text>
            </VStack>
          </Center>
        )}
      </Container>
    </Box>
  );
}
