"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  HStack,
  Button,
} from "@chakra-ui/react";
import { FaSearch, FaMapMarkerAlt, FaGlobe, FaTh } from "react-icons/fa";
import HiveClient from "@/lib/hive/hiveclient";
import NextLink from "next/link";
import HubNavigation from "@/components/shared/HubNavigation";

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

// Country → flag emoji
const COUNTRY_FLAGS: Record<string, string> = {
  "Brazil": "🇧🇷", "USA": "🇺🇸", "United States": "🇺🇸", "US": "🇺🇸",
  "United Kingdom": "🇬🇧", "UK": "🇬🇧", "Germany": "🇩🇪", "France": "🇫🇷",
  "Spain": "🇪🇸", "Portugal": "🇵🇹", "Italy": "🇮🇹", "Netherlands": "🇳🇱",
  "Australia": "🇦🇺", "Canada": "🇨🇦", "Japan": "🇯🇵", "Mexico": "🇲🇽",
  "Argentina": "🇦🇷", "Colombia": "🇨🇴", "Chile": "🇨🇱", "Peru": "🇵🇪",
  "Venezuela": "🇻🇪", "Ecuador": "🇪🇨", "Bolivia": "🇧🇴", "Uruguay": "🇺🇾",
  "Sweden": "🇸🇪", "Norway": "🇳🇴", "Denmark": "🇩🇰", "Finland": "🇫🇮",
  "Poland": "🇵🇱", "Russia": "🇷🇺", "Ukraine": "🇺🇦", "Czech Republic": "🇨🇿",
  "Austria": "🇦🇹", "Switzerland": "🇨🇭", "Belgium": "🇧🇪", "Greece": "🇬🇷",
  "Turkey": "🇹🇷", "Israel": "🇮🇱", "South Africa": "🇿🇦", "Nigeria": "🇳🇬",
  "Kenya": "🇰🇪", "Egypt": "🇪🇬", "Indonesia": "🇮🇩", "Philippines": "🇵🇭",
  "Thailand": "🇹🇭", "Vietnam": "🇻🇳", "India": "🇮🇳", "Pakistan": "🇵🇰",
  "China": "🇨🇳", "South Korea": "🇰🇷", "Taiwan": "🇹🇼", "New Zealand": "🇳🇿",
  "Costa Rica": "🇨🇷", "Panama": "🇵🇦", "Guatemala": "🇬🇹", "Honduras": "🇭🇳",
  "El Salvador": "🇸🇻", "Nicaragua": "🇳🇮", "Cuba": "🇨🇺", "Puerto Rico": "🇵🇷",
  "Dominican Republic": "🇩🇴", "Jamaica": "🇯🇲", "Trinidad": "🇹🇹",
};

function getFlag(country?: string) {
  if (!country) return "🌍";
  return COUNTRY_FLAGS[country.trim()] || "🌍";
}

function parseProfile(acc: any): SkaterProfile | null {
  let profile: any = {};
  try {
    const meta = JSON.parse(acc.posting_json_metadata || "{}");
    profile = meta.profile || {};
    if (!profile.name && !profile.location) {
      const meta2 = JSON.parse(acc.json_metadata || "{}");
      profile = { ...meta2.profile, ...profile };
    }
  } catch {
    // ignore
  }

  const location = (profile.location || "").trim();
  const parts = location.split(",").map((s: string) => s.trim());
  const city = parts.length > 1 ? parts[0] : "";
  const country = parts.length > 1 ? parts[parts.length - 1] : parts[0] || "";

  return {
    username: acc.name,
    name: profile.name || acc.name,
    location,
    country,
    city,
    about: profile.about || "",
    avatar:
      profile.profile_image ||
      `https://images.ecency.com/webp/u/${acc.name}/avatar/small`,
    postCount: acc.post_count || 0,
  };
}

// Batch-fetch accounts — one call per batch of up to 15 usernames
async function fetchAccountsBatched(usernames: string[]): Promise<SkaterProfile[]> {
  const BATCH = 15;
  const batches: string[][] = [];
  for (let i = 0; i < usernames.length; i += BATCH) {
    batches.push(usernames.slice(i, i + BATCH));
  }

  const results = await Promise.allSettled(
    batches.map((batch) => HiveClient.database.call("get_accounts", [batch]))
  );

  const profiles: SkaterProfile[] = [];
  for (const res of results) {
    if (res.status !== "fulfilled" || !Array.isArray(res.value)) continue;
    for (const acc of res.value) {
      const p = parseProfile(acc);
      if (p) profiles.push(p);
    }
  }
  return profiles;
}

export default function SkatersContent() {
  const [skaters, setSkaters] = useState<SkaterProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "map">("map");

  useEffect(() => {
    loadSkaters();
  }, []);

  const loadSkaters = async () => {
    setIsLoading(true);
    try {
      // Pull from two sources in parallel for maximum coverage
      const [subscribersRaw, postsRaw] = await Promise.allSettled([
        HiveClient.call("bridge", "list_subscribers", {
          community: "hive-173115",
          limit: 100,
        }),
        HiveClient.call("bridge", "get_ranked_posts", {
          sort: "created",
          tag: "hive-173115",
          limit: 100,
        }),
      ]);

      const usernameSet = new Set<string>();

      if (subscribersRaw.status === "fulfilled" && Array.isArray(subscribersRaw.value)) {
        for (const sub of subscribersRaw.value) {
          // list_subscribers returns [account, role, label, created]
          const name = Array.isArray(sub) ? sub[0] : sub.account;
          if (name) usernameSet.add(name);
        }
      }

      if (postsRaw.status === "fulfilled" && Array.isArray(postsRaw.value)) {
        for (const post of postsRaw.value) {
          if (post?.author) usernameSet.add(post.author);
        }
      }

      const usernames = Array.from(usernameSet).slice(0, 150);
      const profiles = await fetchAccountsBatched(usernames);

      // Sort by location presence first, then by post count
      profiles.sort((a, b) => {
        if (a.location && !b.location) return -1;
        if (!a.location && b.location) return 1;
        return (b.postCount || 0) - (a.postCount || 0);
      });

      setSkaters(profiles);
    } catch (error) {
      console.error("Error loading skaters:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtered list
  const filteredSkaters = useMemo(() => {
    let list = skaters;
    if (searchTerm) {
      const t = searchTerm.toLowerCase();
      list = list.filter(
        (s) =>
          s.username.toLowerCase().includes(t) ||
          s.name?.toLowerCase().includes(t) ||
          s.location?.toLowerCase().includes(t) ||
          s.country?.toLowerCase().includes(t) ||
          s.city?.toLowerCase().includes(t)
      );
    }
    if (selectedCountry) {
      list = list.filter((s) => s.country === selectedCountry);
    }
    return list;
  }, [skaters, searchTerm, selectedCountry]);

  // Skaters grouped by country (only those with location)
  const byCountry = useMemo(() => {
    const map = new Map<string, SkaterProfile[]>();
    for (const s of filteredSkaters) {
      if (!s.location) continue;
      const key = s.country || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    // Sort countries by number of skaters desc
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filteredSkaters]);

  const skatersWithLocation = useMemo(() => skaters.filter((s) => s.location), [skaters]);
  const countries = useMemo(
    () =>
      Array.from(new Set(skatersWithLocation.map((s) => s.country).filter(Boolean))).sort(),
    [skatersWithLocation]
  );

  return (
    <Box minH="100vh" py={8}>
      <Container maxW="container.xl">
        <HubNavigation />

        {/* Hero */}
        <VStack spacing={4} mb={8} textAlign="center">
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
          <HStack spacing={3} flexWrap="wrap" justify="center">
            <Badge colorScheme="green" fontSize="sm" px={3} py={1}>
              {skaters.length} Active Skaters
            </Badge>
            <Badge colorScheme="blue" fontSize="sm" px={3} py={1}>
              {skatersWithLocation.length} with location
            </Badge>
            <Badge colorScheme="purple" fontSize="sm" px={3} py={1}>
              {countries.length} countries
            </Badge>
          </HStack>
        </VStack>

        {/* Search + Filters */}
        <Flex gap={4} mb={6} flexWrap="wrap" align="center">
          <InputGroup maxW={{ base: "100%", md: "360px" }}>
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

          {/* View toggle */}
          <HStack spacing={2}>
            <Button
              size="sm"
              leftIcon={<FaGlobe />}
              variant={viewMode === "map" ? "solid" : "outline"}
              colorScheme="green"
              onClick={() => setViewMode("map")}
            >
              By Location
            </Button>
            <Button
              size="sm"
              leftIcon={<FaTh />}
              variant={viewMode === "grid" ? "solid" : "outline"}
              colorScheme="green"
              onClick={() => setViewMode("grid")}
            >
              All Skaters
            </Button>
          </HStack>

          {/* Country filter pills */}
          <Flex gap={2} flexWrap="wrap" align="center">
            <Text fontSize="sm" color="gray.500">Country:</Text>
            <Badge
              cursor="pointer"
              colorScheme={selectedCountry === null ? "green" : "gray"}
              onClick={() => setSelectedCountry(null)}
              fontSize="xs" px={3} py={1}
            >
              ALL
            </Badge>
            {countries.slice(0, 10).map((country) => (
              <Badge
                key={country}
                cursor="pointer"
                colorScheme={selectedCountry === country ? "green" : "gray"}
                onClick={() => setSelectedCountry(selectedCountry === country ? null : (country || null))}
                fontSize="xs" px={3} py={1}
              >
                {getFlag(country)} {country}
              </Badge>
            ))}
          </Flex>
        </Flex>

        {/* Content */}
        {isLoading ? (
          <Center py={20}>
            <VStack spacing={4}>
              <Spinner size="xl" color="primary" />
              <Text color="gray.500" fontSize="sm">Loading skaters from Hive blockchain...</Text>
            </VStack>
          </Center>
        ) : viewMode === "map" ? (
          /* ── BY LOCATION VIEW ── */
          byCountry.length === 0 ? (
            <Center py={20}>
              <VStack spacing={2}>
                <Text color="gray.500">No skaters with location found.</Text>
                <Text color="gray.600" fontSize="sm">Try switching to &quot;All Skaters&quot; view.</Text>
              </VStack>
            </Center>
          ) : (
            <VStack spacing={8} align="stretch">
              {byCountry.map(([country, countrySkaters]) => (
                <Box key={country}>
                  {/* Country header */}
                  <Flex
                    align="center"
                    gap={3}
                    mb={4}
                    pb={2}
                    borderBottom="1px solid"
                    borderColor="whiteAlpha.200"
                  >
                    <Text fontSize="2xl">{getFlag(country)}</Text>
                    <Heading fontSize="xl" color="primary">
                      {country}
                    </Heading>
                    <Badge colorScheme="green" fontSize="xs">
                      {countrySkaters.length} skater{countrySkaters.length !== 1 ? "s" : ""}
                    </Badge>
                  </Flex>

                  <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing={4}>
                    {countrySkaters.map((skater) => (
                      <SkaterCard key={skater.username} skater={skater} />
                    ))}
                  </SimpleGrid>
                </Box>
              ))}

              {/* Skaters without location */}
              {!selectedCountry && !searchTerm && (() => {
                const noLocation = filteredSkaters.filter((s) => !s.location);
                if (noLocation.length === 0) return null;
                return (
                  <Box>
                    <Flex align="center" gap={3} mb={4} pb={2} borderBottom="1px solid" borderColor="whiteAlpha.200">
                      <Text fontSize="2xl">🌍</Text>
                      <Heading fontSize="xl" color="gray.500">Location Unknown</Heading>
                      <Badge colorScheme="gray" fontSize="xs">{noLocation.length}</Badge>
                    </Flex>
                    <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing={4}>
                      {noLocation.slice(0, 20).map((skater) => (
                        <SkaterCard key={skater.username} skater={skater} />
                      ))}
                    </SimpleGrid>
                  </Box>
                );
              })()}
            </VStack>
          )
        ) : (
          /* ── GRID VIEW ── */
          filteredSkaters.length === 0 ? (
            <Center py={20}>
              <VStack spacing={4}>
                <Text color="gray.500" fontSize="lg">No skaters found.</Text>
                <Text color="gray.600" fontSize="sm">Try adjusting your search or filters.</Text>
              </VStack>
            </Center>
          ) : (
            <SimpleGrid columns={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing={4} mb={8}>
              {filteredSkaters.map((skater) => (
                <SkaterCard key={skater.username} skater={skater} />
              ))}
            </SimpleGrid>
          )
        )}
      </Container>
    </Box>
  );
}

// ── Skater Card ──────────────────────────────────────────────────────────────

function SkaterCard({ skater }: { skater: SkaterProfile }) {
  return (
    <NextLink href={`/user/${skater.username}`} passHref legacyBehavior>
      <ChakraLink
        _hover={{ textDecoration: "none" }}
        display="block"
        bg="rgba(20,20,20,0.6)"
        border="1px solid"
        borderColor="whiteAlpha.200"
        borderRadius="lg"
        p={3}
        transition="all 0.2s"
        _groupHover={{
          borderColor: "primary",
          transform: "translateY(-3px)",
          boxShadow: "0 0 16px rgba(138,255,0,0.25)",
        }}
        role="group"
      >
        <VStack spacing={2} align="center" textAlign="center">
          <Avatar src={skater.avatar} name={skater.name} size="md" />
          <Box>
            <Text
              fontWeight="bold"
              color="white"
              fontSize="sm"
              noOfLines={1}
              _groupHover={{ color: "primary" }}
            >
              {skater.name}
            </Text>
            <Text fontSize="xs" color="gray.500" noOfLines={1}>
              @{skater.username}
            </Text>
          </Box>

          {skater.location ? (
            <Flex align="center" gap={1}>
              <FaMapMarkerAlt color="#8AFF00" size={10} />
              <Text fontSize="xs" color="gray.400" noOfLines={1}>
                {skater.city ? `${skater.city}, ${skater.country}` : skater.location}
              </Text>
            </Flex>
          ) : (
            <Text fontSize="xs" color="gray.600">no location</Text>
          )}

          <Badge colorScheme="green" fontSize="xs" variant="subtle">
            {skater.postCount} posts
          </Badge>
        </VStack>
      </ChakraLink>
    </NextLink>
  );
}
