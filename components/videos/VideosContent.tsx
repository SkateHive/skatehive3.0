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
  Icon,
} from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import HiveClient from "@/lib/hive/hiveclient";
import { extractImageUrls } from "@/lib/utils/extractImageUrls";
import NextLink from "next/link";
import HubNavigation from "@/components/shared/HubNavigation";
import { FaYoutube, FaVideo } from "react-icons/fa";
import { SiIpfs } from "react-icons/si";
import { trackLandingPageVisit } from "@/lib/analytics/events";

export default function VideosContent() {
  const [posts, setPosts] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const POSTS_PER_PAGE = 12;

  // Track landing page visit on mount
  useEffect(() => {
    trackLandingPageVisit({ page: 'videos' });
  }, []);

  useEffect(() => {
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const loadPosts = async () => {
    setIsLoading(true);
    try {
      // Fetch from hive-173115 community (sorted by created)
      const result = await HiveClient.call("bridge", "get_ranked_posts", {
        sort: "created",
        tag: "hive-173115",
        limit: POSTS_PER_PAGE + 10, // fetch extra to filter for videos
        start_author: page > 0 ? posts[posts.length - 1]?.author : undefined,
        start_permlink: page > 0 ? posts[posts.length - 1]?.permlink : undefined,
      });

      if (result && result.length > 0) {
        // Filter only posts that have video content
        const videoPosts = (page > 0 ? result.slice(1) : result).filter((p: Discussion) =>
          hasVideoContent(p.body)
        );

        if (videoPosts.length > 0) {
          setPosts((prev) => [...prev, ...videoPosts.slice(0, POSTS_PER_PAGE)]);
          setHasMore(result.length === POSTS_PER_PAGE + 10);
        } else {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error("Error loading video posts:", error);
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

  // Helper: detect if post body contains video content
  const hasVideoContent = (body: string): boolean => {
    if (!body) return false;
    // YouTube
    if (/youtu\.?be/i.test(body)) return true;
    // 3Speak
    if (/3speak\.tv/i.test(body)) return true;
    // IPFS video (rough heuristic — links to IPFS gateways with video-like paths)
    if (/ipfs\.(skatehive\.app|io|pinata\.cloud).*\/(video|mp4|webm|mov)/i.test(body)) return true;
    // iframe with src containing video platforms
    if (/<iframe[^>]*src=["']https?:\/\/(www\.)?(youtube|3speak)/i.test(body)) return true;
    return false;
  };

  // Helper: extract video platform icon
  const getVideoPlatform = (body: string): "youtube" | "3speak" | "ipfs" | "other" => {
    if (/youtu\.?be/i.test(body)) return "youtube";
    if (/3speak\.tv/i.test(body)) return "3speak";
    if (/ipfs\./i.test(body)) return "ipfs";
    return "other";
  };

  return (
    <Box minH="100vh" py={8}>
      <Container maxW="container.xl">
        {/* Hub Navigation */}
        <HubNavigation />

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
            Skate Videos
          </Heading>
          <Text fontSize={{ base: "md", md: "lg" }} color="gray.400" maxW="2xl">
            Watch skateboarding videos from the Skatehive community — street skating clips,
            park sessions, full edits, and raw footage from skaters worldwide.
          </Text>
          <Badge colorScheme="green" fontSize="sm" px={3} py={1}>
            3Speak • YouTube • IPFS
          </Badge>
        </VStack>

        {/* SEO Content */}
        <Box
          mb={8}
          p={6}
          bg="rgba(20,20,20,0.4)"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="lg"
        >
          <Heading as="h2" fontSize="xl" mb={3} color="primary">
            Skateboarding Videos from the Community
          </Heading>
          <Text fontSize="sm" color="gray.300" mb={2}>
            Discover skateboarding videos posted by real skaters from around the world.
            From raw street skating clips to polished full edits — all hosted on decentralized
            platforms like 3Speak, IPFS, and YouTube.
          </Text>
          <Text fontSize="sm" color="gray.300">
            Upload your own videos to Skatehive and share your skating with the global community.
            Every video you watch supports the skater who posted it through blockchain-based rewards.
          </Text>
        </Box>

        {/* Videos Grid */}
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6} mb={8}>
          {posts.map((post) => {
            const images = extractImageUrls(post.body);
            const thumbnail = images[0] || "/ogimage.png";
            const cleanAuthor = post.author.startsWith("@")
              ? post.author.slice(1)
              : post.author;
            const platform = getVideoPlatform(post.body);

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
                      alt={post.title || "Skate video"}
                      position="absolute"
                      top={0}
                      left={0}
                      w="100%"
                      h="100%"
                      objectFit="cover"
                      transition="transform 0.3s"
                      _groupHover={{ transform: "scale(1.05)" }}
                    />
                    {/* Platform badge */}
                    <Badge
                      position="absolute"
                      top={2}
                      right={2}
                      colorScheme={
                        platform === "youtube"
                          ? "red"
                          : platform === "3speak"
                          ? "purple"
                          : "blue"
                      }
                      fontSize="xs"
                      px={2}
                      py={1}
                      display="flex"
                      alignItems="center"
                      gap={1}
                    >
                      <Icon
                        as={
                          platform === "youtube"
                            ? FaYoutube
                            : platform === "ipfs"
                            ? SiIpfs
                            : FaVideo
                        }
                        boxSize={3}
                      />
                      {platform === "youtube"
                        ? "YT"
                        : platform === "3speak"
                        ? "3Speak"
                        : "IPFS"}
                    </Badge>
                    {/* Play button overlay */}
                    <Flex
                      position="absolute"
                      top="50%"
                      left="50%"
                      transform="translate(-50%, -50%)"
                      bg="rgba(0,0,0,0.7)"
                      borderRadius="full"
                      p={3}
                      transition="all 0.3s"
                      _groupHover={{ bg: "primary", transform: "translate(-50%, -50%) scale(1.1)" }}
                    >
                      <Icon as={FaVideo} boxSize={6} color="white" _groupHover={{ color: "background" }} />
                    </Flex>
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
              Load More Videos
            </Button>
          </Center>
        )}

        {/* No More Posts */}
        {!isLoading && !hasMore && posts.length > 0 && (
          <Center>
            <Text color="gray.500" fontSize="sm">
              End of videos list
            </Text>
          </Center>
        )}

        {/* No Posts Found */}
        {!isLoading && posts.length === 0 && (
          <Center py={20}>
            <VStack spacing={4}>
              <Text color="gray.500" fontSize="lg">
                No skate videos found yet.
              </Text>
              <Text color="gray.600" fontSize="sm">
                Be the first to share a video!
              </Text>
            </VStack>
          </Center>
        )}
      </Container>
    </Box>
  );
}
