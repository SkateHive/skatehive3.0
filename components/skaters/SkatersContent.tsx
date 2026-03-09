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
  VStack,
  Avatar,
  Link as ChakraLink,
  Flex,
  Badge,
  Input,
  InputGroup,
  InputLeftElement,
} from "@chakra-ui/react";
import { FaSearch, FaMapMarkerAlt } from "react-icons/fa";
import HiveClient from "@/lib/hive/hiveclient";
import NextLink from "next/link";
import HubNavigation from "@/components/shared/HubNavigation";
import { trackLandingPageVisit } from "@/lib/analytics/events";

type SkaterProfile = {
  username: string;
  name?: string;
  location?: string;
  country?: string;
  city?: string;
  about?: string;
  avatar?: string;
  postCount?: number;
};

export default function SkatersContent() {
  const [skaters, setSkaters] = useState<SkaterProfile[]>([]);
  const [filteredSkaters, setFilteredSkaters] = useState<SkaterProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  // Track landing page visit on mount
  useEffect(() => {
    trackLandingPageVisit({ page: 'map' }); // using 'map' as fallback since 'skaters' not in type yet
  }, []);

  useEffect(() => {
    loadSkaters();
  }, []);

  useEffect(() => {
    filterSkaters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedCountry, skaters]);

  const loadSkaters = async () => {
    setIsLoading(true);
    try {
      // Fetch active users from hive-173115 community
      const posts = await HiveClient.call("bridge", "get_ranked_posts", {
        sort: "created",
        tag: "hive-173115",
        limit: 100,
      });

      if (!posts || posts.length === 0) {
        setIsLoading(false);
        return;
      }

      // Extract unique authors
      const authorMap = new Map<string, SkaterProfile>();
      for (const post of posts) {
        if (!post?.author || authorMap.has(post.author)) continue;

        // Try to get profile info
        try {
          const account = await HiveClient.database.call("get_accounts", [[post.author]]);
          if (!account || account.length === 0) continue;

          const acc = account[0];
          let profile: any = {};
          try {
            const metadata = JSON.parse(acc.posting_json_metadata || "{}");
            profile = metadata.profile || {};
          } catch {
            // Skip invalid JSON
          }

          const location = profile.location || "";
          const parts = location.split(",").map((s: string) => s.trim());
          const city = parts.length > 1 ? parts[0] : "";
          const country = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";

          authorMap.set(post.author, {
            username: post.author,
            name: profile.name || post.author,
            location,
            country,
            city,
            about: profile.about || "",
            avatar: profile.profile_image || `https://images.ecency.com/webp/u/${post.author}/avatar/small`,
            postCount: acc.post_count || 0,
          });

          // Limit to 50 skaters for performance
          if (authorMap.size >= 50) break;
        } catch (err) {
          console.warn(`Failed to load profile for ${post.author}:`, err);
        }
      }

      const skatersArray = Array.from(authorMap.values())
        .filter((s) => s.location) // only those with location set
        .sort((a, b) => (b.postCount || 0) - (a.postCount || 0)); // sort by activity

      setSkaters(skatersArray);
      setFilteredSkaters(skatersArray);
    } catch (error) {
      console.error("Error loading skaters:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterSkaters = () => {
    let filtered = skaters;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.username.toLowerCase().includes(term) ||
          s.name?.toLowerCase().includes(term) ||
          s.location?.toLowerCase().includes(term) ||
          s.country?.toLowerCase().includes(term) ||
          s.city?.toLowerCase().includes(term)
      );
    }

    if (selectedCountry) {
      filtered = filtered.filter((s) => s.country === selectedCountry);
    }

    setFilteredSkaters(filtered);
  };

  // Get unique countries for filtering
  const countries = Array.from(new Set(skaters.map((s) => s.country).filter(Boolean))).sort();

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
            Skateboarders Directory
          </Heading>
          <Text fontSize={{ base: "md", md: "lg" }} color="gray.400" maxW="2xl">
            Discover skateboarders from around the world. Browse by country and city,
            connect with the global skate community.
          </Text>
          <Badge colorScheme="green" fontSize="sm" px={3} py={1}>
            {skaters.length} Active Skaters
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
            Find Skateboarders Worldwide
          </Heading>
          <Text fontSize="sm" color="gray.300" mb={2}>
            Connect with skateboarders from every corner of the globe. From Brazilian skateboarders
            in São Paulo and Rio de Janeiro to street skaters in Los Angeles, New York, and Tokyo —
            the Skatehive community spans the world.
          </Text>
          <Text fontSize="sm" color="gray.300">
            Browse profiles by country and city, discover local skate scenes, and connect with
            skaters who share your passion. Every skater on Skatehive is part of the decentralized
            skate movement.
          </Text>
        </Box>

        {/* Search & Filters */}
        <Flex gap={4} mb={8} flexWrap="wrap">
          <InputGroup maxW={{ base: "100%", md: "400px" }}>
            <InputLeftElement pointerEvents="none">
              <FaSearch color="gray" />
            </InputLeftElement>
            <Input
              placeholder="Search by name, location, country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              bg="rgba(0,0,0,0.3)"
              border="1px solid"
              borderColor="whiteAlpha.300"
              _focus={{ borderColor: "primary" }}
            />
          </InputGroup>

          {/* Country filter pills */}
          <Flex gap={2} flexWrap="wrap" align="center">
            <Text fontSize="sm" color="gray.500">
              Filter by country:
            </Text>
            <Badge
              cursor="pointer"
              colorScheme={selectedCountry === null ? "green" : "gray"}
              onClick={() => setSelectedCountry(null)}
              fontSize="xs"
              px={3}
              py={1}
            >
              All
            </Badge>
            {countries.slice(0, 8).map((country) => (
              <Badge
                key={country}
                cursor="pointer"
                colorScheme={selectedCountry === country ? "green" : "gray"}
                onClick={() => setSelectedCountry(selectedCountry === country ? null : country)}
                fontSize="xs"
                px={3}
                py={1}
              >
                {country}
              </Badge>
            ))}
          </Flex>
        </Flex>

        {/* Skaters Grid */}
        {isLoading ? (
          <Center py={20}>
            <Spinner size="xl" color="primary" />
          </Center>
        ) : filteredSkaters.length === 0 ? (
          <Center py={20}>
            <VStack spacing={4}>
              <Text color="gray.500" fontSize="lg">
                No skaters found.
              </Text>
              <Text color="gray.600" fontSize="sm">
                Try adjusting your search or filters.
              </Text>
            </VStack>
          </Center>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6} mb={8}>
            {filteredSkaters.map((skater) => (
              <NextLink
                key={skater.username}
                href={`/user/${skater.username}`}
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
                  p={4}
                  transition="all 0.3s"
                  _groupHover={{
                    borderColor: "primary",
                    transform: "translateY(-4px)",
                    boxShadow: "0 0 20px rgba(138, 255, 0, 0.3)",
                  }}
                  role="group"
                >
                  <Flex align="center" mb={3}>
                    <Avatar src={skater.avatar} name={skater.name} size="md" mr={3} />
                    <Box flex={1}>
                      <Text
                        fontWeight="bold"
                        color="white"
                        fontSize="md"
                        _groupHover={{ color: "primary" }}
                      >
                        {skater.name}
                      </Text>
                      <Text fontSize="xs" color="gray.500">
                        @{skater.username}
                      </Text>
                    </Box>
                  </Flex>

                  {skater.location && (
                    <Flex align="center" gap={2} mb={2}>
                      <FaMapMarkerAlt color="#8AFF00" size={12} />
                      <Text fontSize="sm" color="gray.400">
                        {skater.location}
                      </Text>
                    </Flex>
                  )}

                  {skater.about && (
                    <Text fontSize="xs" color="gray.500" noOfLines={2} mb={2}>
                      {skater.about}
                    </Text>
                  )}

                  <Badge colorScheme="green" fontSize="xs">
                    {skater.postCount} posts
                  </Badge>
                </ChakraLink>
              </NextLink>
            ))}
          </SimpleGrid>
        )}
      </Container>
    </Box>
  );
}
