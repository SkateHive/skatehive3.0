"use client";

import { useState } from "react";
import {
  Box,
  Container,
  Heading,
  VStack,
  HStack,
  Select,
  Text,
  Grid,
  Badge,
  Divider,
  Button,
  useToast,
  Input,
  FormControl,
  FormLabel,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Code,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
} from "@chakra-ui/react";
import OGPreviewCard from "@/components/OGPreviewCard";

// Define all pages with their metadata status
const PAGES = [
  // Static pages
  {
    path: "/",
    type: "Homepage",
    hasCustomMetadata: true,
    hasFarcasterFrame: true,
    example: "/",
  },
  {
    path: "/blog",
    type: "Blog Feed",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/blog",
  },
  {
    path: "/map",
    type: "Map",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/map",
  },
  {
    path: "/leaderboard",
    type: "Leaderboard",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/leaderboard",
  },
  {
    path: "/dao",
    type: "DAO",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/dao",
  },
  {
    path: "/bounties",
    type: "Bounties",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/bounties",
  },
  {
    path: "/tricks",
    type: "Tricks List",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/tricks",
  },
  {
    path: "/tricks/[trick]",
    type: "Trick Page",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/tricks/tre-flip",
  },
  {
    path: "/magazine",
    type: "Magazine",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/magazine",
  },
  {
    path: "/auction",
    type: "Auction List",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/auction",
  },
  {
    path: "/auction/[tokenId]",
    type: "Auction Detail",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/auction/1",
  },
  {
    path: "/coin/[address]",
    type: "Coin Page",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/coin/0x1234",
  },

  // Dynamic pages with custom metadata
  {
    path: "/post/[author]/[permlink]",
    type: "Post Detail",
    hasCustomMetadata: true,
    hasFarcasterFrame: true,
    example: "/post/xvlad/re-leothreads-39iukb",
  },
  {
    path: "/user/[username]",
    type: "User Profile",
    hasCustomMetadata: true,
    hasFarcasterFrame: false,
    example: "/user/xvlad",
  },
  {
    path: "/user/[username]/snap/[permlink]",
    type: "User Snap",
    hasCustomMetadata: true,
    hasFarcasterFrame: false,
    example: "/user/xvlad/snap/re-skatehive-smvsq9",
  },

  // App pages (no OG metadata needed)
  {
    path: "/settings",
    type: "Settings",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/settings",
    appOnly: true,
  },
  {
    path: "/wallet",
    type: "Wallet",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/wallet",
    appOnly: true,
  },
  {
    path: "/compose",
    type: "Compose",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/compose",
    appOnly: true,
  },
  {
    path: "/notifications",
    type: "Notifications",
    hasCustomMetadata: false,
    hasFarcasterFrame: false,
    example: "/notifications",
    appOnly: true,
  },
];

const BASE_URL = "https://skatehive.app";

// Known users for quick testing
const KNOWN_USERS = [
  "xvlad",
  "web3pleb",
  "davideownzall",
  "knowhow92",
  "gabrielcarreiro",
  "homelesscrewmx",
];

// Known posts for quick testing
const KNOWN_POSTS = [
  { author: "xvlad", permlink: "re-leothreads-39iukb" },
  { author: "web3pleb", permlink: "skatehive-mobile-app" },
  { author: "davideownzall", permlink: "skating-in-malta" },
];

export default function OGDebugPage() {
  const [selectedPage, setSelectedPage] = useState(PAGES[0]);
  const [customUrl, setCustomUrl] = useState("");
  const [testUsername, setTestUsername] = useState("xvlad");
  const toast = useToast();

  // Simulated metadata (in production, this would fetch from the actual page)
  const getMetadata = (page: typeof PAGES[0]) => {
    const isCustom = page.hasCustomMetadata;

    // Default metadata
    let metadata = {
      title: "Skatehive - The Infinity Skateboard Magazine",
      description:
        "Post skate videos, find skate spots on the map, earn crypto rewards, and connect with skaters worldwide. The decentralized skate community.",
      image: `${BASE_URL}/ogimage.png`,
      url: `${BASE_URL}${page.example}`,
      type: "website",
      twitterCard: "summary_large_image",
      fcFrame: page.hasFarcasterFrame
        ? {
            version: "next",
            imageUrl: `${BASE_URL}/ogimage.png`,
            button: {
              title: "Open",
              action: {
                type: "launch_frame",
                name: "Skatehive",
                url: `${BASE_URL}${page.example}`,
              },
            },
          }
        : undefined,
    };

    // Custom metadata for specific pages (using real examples)
    if (isCustom) {
      if (page.path.includes("/post/")) {
        // Extract author/permlink from example
        const parts = page.example.split("/");
        const author = parts[2];
        const permlink = parts[3];
        metadata = {
          ...metadata,
          title: `Post by @${author} | Skatehive`,
          description:
            "Real skate content from the Hive blockchain. Check out this post from our community!",
          image: `${BASE_URL}/api/og/post/${author}/${permlink}`,
          type: "article",
        };
      } else if (page.path.includes("/user/[username]")) {
        const username = page.example.split("/")[2];
        metadata = {
          ...metadata,
          title: `@${username} | Skatehive`,
          description: `Check out @${username}&apos;s profile on Skatehive - posts, snaps, and skate activity.`,
          image: `${BASE_URL}/api/og/profile/${username}`,
          type: "profile",
        };
      } else if (page.path.includes("/snap/")) {
        const parts = page.example.split("/");
        const username = parts[2];
        const permlink = parts[4];
        metadata = {
          ...metadata,
          title: `Snap by @${username} | Skatehive`,
          description: "Quick skate moment captured and shared on-chain!",
          image: `${BASE_URL}/api/og/profile/${username}`,
        };
      }
    }

    return metadata;
  };

  const metadata = getMetadata(selectedPage);

  // Stats
  const totalPages = PAGES.length;
  const withCustomMetadata = PAGES.filter((p) => p.hasCustomMetadata).length;
  const withFarcasterFrame = PAGES.filter((p) => p.hasFarcasterFrame).length;
  const appOnlyPages = PAGES.filter((p) => p.appOnly).length;

  const fetchRealMetadata = async (url: string) => {
    try {
      const response = await fetch(url);
      const html = await response.text();

      // Extract OG tags
      const ogTags: Record<string, string> = {};
      const ogRegex = /<meta\s+property="og:([^"]+)"\s+content="([^"]*)"/g;
      let match;
      while ((match = ogRegex.exec(html)) !== null) {
        ogTags[match[1]] = match[2];
      }

      // Extract Twitter tags
      const twitterTags: Record<string, string> = {};
      const twitterRegex = /<meta\s+name="twitter:([^"]+)"\s+content="([^"]*)"/g;
      while ((match = twitterRegex.exec(html)) !== null) {
        twitterTags[match[1]] = match[2];
      }

      // Extract Farcaster Frame tags
      const fcTags: Record<string, string> = {};
      const fcRegex = /<meta\s+(?:property|name)="fc:frame(?::([^"]+))?"\s+content="([^"]*)"/g;
      while ((match = fcRegex.exec(html)) !== null) {
        const key = match[1] || "version";
        fcTags[key] = match[2];
      }

      toast({
        title: "✅ Real Metadata Retrieved",
        description: `OG: ${Object.keys(ogTags).length} | Twitter: ${Object.keys(twitterTags).length} | FC: ${Object.keys(fcTags).length}`,
        status: "success",
        duration: 4000,
      });

      console.group("📊 Real Metadata from:", url);
      console.log("Open Graph:", ogTags);
      console.log("Twitter Card:", twitterTags);
      console.log("Farcaster Frame:", fcTags);
      console.groupEnd();

      return { ogTags, twitterTags, fcTags };
    } catch (error) {
      toast({
        title: "❌ Error",
        description: "Failed to fetch URL. Check console for details.",
        status: "error",
        duration: 3000,
      });
      console.error("Fetch error:", error);
      return null;
    }
  };

  return (
    <Container maxW="container.xl" py={8}>
      <VStack spacing={8} align="stretch">
        {/* Header */}
        <Box>
          <Heading size="2xl" mb={2}>
            🔍 OG Metadata Debug Tool
          </Heading>
          <Text color="gray.400">
            Test and preview Open Graph metadata for all pages. Check Farcaster Frame compatibility.
          </Text>
        </Box>

        {/* Stats */}
        <Grid templateColumns="repeat(4, 1fr)" gap={4}>
          <Box p={4} borderWidth="1px" borderRadius="lg" bg="gray.800">
            <Text fontSize="2xl" fontWeight="bold">
              {totalPages}
            </Text>
            <Text fontSize="sm" color="gray.400">
              Total Pages
            </Text>
          </Box>
          <Box p={4} borderWidth="1px" borderRadius="lg" bg="green.900">
            <Text fontSize="2xl" fontWeight="bold">
              {withCustomMetadata}
            </Text>
            <Text fontSize="sm" color="gray.400">
              Custom Metadata
            </Text>
          </Box>
          <Box p={4} borderWidth="1px" borderRadius="lg" bg="purple.900">
            <Text fontSize="2xl" fontWeight="bold">
              {withFarcasterFrame}
            </Text>
            <Text fontSize="sm" color="gray.400">
              Farcaster Frames
            </Text>
          </Box>
          <Box p={4} borderWidth="1px" borderRadius="lg" bg="blue.900">
            <Text fontSize="2xl" fontWeight="bold">
              {appOnlyPages}
            </Text>
            <Text fontSize="sm" color="gray.400">
              App-Only (No OG)
            </Text>
          </Box>
        </Grid>

        <Divider />

        {/* Quick Test Section */}
        <Box p={4} borderWidth="1px" borderRadius="lg" bg="purple.900">
          <Heading size="sm" mb={3}>
            ⚡ Quick Test - Real Data
          </Heading>
          <VStack align="stretch" spacing={3}>
            <Box>
              <Text fontSize="sm" mb={2} color="gray.300">
                Test User Profiles:
              </Text>
              <HStack wrap="wrap" spacing={2}>
                {KNOWN_USERS.map((username) => (
                  <Button
                    key={username}
                    size="sm"
                    colorScheme="purple"
                    variant="outline"
                    onClick={() => {
                      const profilePage = PAGES.find((p) => p.path === "/user/[username]");
                      if (profilePage) {
                        const updatedPage = {
                          ...profilePage,
                          example: `/user/${username}`,
                        };
                        setSelectedPage(updatedPage);
                        toast({
                          title: `Testing @${username}`,
                          status: "info",
                          duration: 2000,
                        });
                      }
                    }}
                  >
                    @{username}
                  </Button>
                ))}
              </HStack>
            </Box>
            <Box>
              <Text fontSize="sm" mb={2} color="gray.300">
                Test Posts:
              </Text>
              <VStack align="stretch" spacing={2}>
                {KNOWN_POSTS.map((post) => (
                  <Button
                    key={`${post.author}-${post.permlink}`}
                    size="sm"
                    colorScheme="green"
                    variant="outline"
                    onClick={() => {
                      const postPage = PAGES.find((p) => p.path === "/post/[author]/[permlink]");
                      if (postPage) {
                        const updatedPage = {
                          ...postPage,
                          example: `/post/${post.author}/${post.permlink}`,
                        };
                        setSelectedPage(updatedPage);
                        toast({
                          title: `Testing post by @${post.author}`,
                          status: "info",
                          duration: 2000,
                        });
                      }
                    }}
                  >
                    @{post.author}/{post.permlink.substring(0, 20)}...
                  </Button>
                ))}
              </VStack>
            </Box>
          </VStack>
        </Box>

        <Divider />

        {/* Page Selector */}
        <VStack align="stretch" spacing={4}>
          <FormControl>
            <FormLabel>Select Page to Preview</FormLabel>
            <Select
              value={selectedPage.path}
              onChange={(e) => {
                const page = PAGES.find((p) => p.path === e.target.value);
                if (page) setSelectedPage(page);
              }}
            >
              {PAGES.map((page) => (
                <option key={page.path} value={page.path}>
                  {page.type} - {page.path}
                  {page.hasCustomMetadata ? " ✅" : " ⚠️"}
                  {page.hasFarcasterFrame ? " 🟣" : ""}
                </option>
              ))}
            </Select>
          </FormControl>

          {/* Page Info */}
          <HStack>
            <Badge colorScheme={selectedPage.hasCustomMetadata ? "green" : "yellow"}>
              {selectedPage.hasCustomMetadata ? "Custom Metadata" : "Default Metadata"}
            </Badge>
            <Badge colorScheme={selectedPage.hasFarcasterFrame ? "purple" : "gray"}>
              {selectedPage.hasFarcasterFrame ? "Farcaster Frame Ready" : "No Frame"}
            </Badge>
            {selectedPage.appOnly && <Badge colorScheme="blue">App Only</Badge>}
          </HStack>

          <HStack justify="space-between" align="center">
            <Text fontSize="sm" color="gray.400">
              Example URL: <Code>{BASE_URL + selectedPage.example}</Code>
            </Text>
            <Button
              size="sm"
              colorScheme="blue"
              onClick={() => fetchRealMetadata(BASE_URL + selectedPage.example)}
            >
              🔍 Fetch Real Metadata
            </Button>
          </HStack>
        </VStack>

        <Divider />

        {/* Farcaster Miniapp Readiness Check */}
        <Alert
          status={selectedPage.hasFarcasterFrame ? "success" : "warning"}
          borderRadius="lg"
        >
          <AlertIcon />
          <Box>
            <AlertTitle>Farcaster Miniapp Sharing</AlertTitle>
            <AlertDescription>
              {selectedPage.hasFarcasterFrame ? (
                <>
                  ✅ This page has Farcaster Frame metadata and is ready for miniapp sharing.
                  Users can share and interact with this content directly in Farcaster feeds.
                </>
              ) : (
                <>
                  ⚠️ This page does not have Farcaster Frame metadata. While it can be shared,
                  it will appear as a basic link preview without interactive frame features.
                </>
              )}
            </AlertDescription>
          </Box>
        </Alert>

        {/* Previews */}
        <Tabs variant="enclosed" colorScheme="purple">
          <TabList>
            <Tab>Telegram</Tab>
            <Tab>Discord</Tab>
            <Tab>Twitter</Tab>
            <Tab>Farcaster</Tab>
          </TabList>

          <TabPanels>
            <TabPanel>
              <OGPreviewCard
                metadata={metadata}
                platform="telegram"
                pageType={selectedPage.type}
                hasCustomMetadata={selectedPage.hasCustomMetadata}
              />
            </TabPanel>
            <TabPanel>
              <OGPreviewCard
                metadata={metadata}
                platform="discord"
                pageType={selectedPage.type}
                hasCustomMetadata={selectedPage.hasCustomMetadata}
              />
            </TabPanel>
            <TabPanel>
              <OGPreviewCard
                metadata={metadata}
                platform="twitter"
                pageType={selectedPage.type}
                hasCustomMetadata={selectedPage.hasCustomMetadata}
              />
            </TabPanel>
            <TabPanel>
              <OGPreviewCard
                metadata={metadata}
                platform="farcaster"
                pageType={selectedPage.type}
                hasCustomMetadata={selectedPage.hasCustomMetadata}
              />
            </TabPanel>
          </TabPanels>
        </Tabs>

        <Divider />

        {/* URL Tester */}
        <Box>
          <Heading size="md" mb={4}>
            🧪 Test Custom URL
          </Heading>
          <HStack>
            <Input
              placeholder="https://skatehive.app/user/xvlad"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
            <Button colorScheme="purple" onClick={() => fetchRealMetadata(customUrl)}>
              Fetch Metadata
            </Button>
          </HStack>
          <Text fontSize="xs" color="gray.500" mt={2}>
            Paste any SkateHive URL to extract real OG metadata. Check browser console for full output.
          </Text>
          <HStack mt={2} spacing={2}>
            <Text fontSize="xs" color="gray.600">
              Quick fill:
            </Text>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setCustomUrl("https://skatehive.app/user/xvlad")}
            >
              Profile
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setCustomUrl("https://skatehive.app/blog")}
            >
              Blog
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setCustomUrl("https://skatehive.app/map")}
            >
              Map
            </Button>
          </HStack>
        </Box>

        {/* Missing Metadata List */}
        <Box>
          <Heading size="md" mb={4}>
            ⚠️ Pages Missing Custom Metadata
          </Heading>
          <VStack align="stretch" spacing={2}>
            {PAGES.filter((p) => !p.hasCustomMetadata && !p.appOnly).map((page) => (
              <HStack
                key={page.path}
                p={3}
                borderWidth="1px"
                borderRadius="md"
                bg="yellow.900"
                opacity={0.8}
              >
                <Text flex={1}>{page.type}</Text>
                <Code fontSize="xs">{page.path}</Code>
              </HStack>
            ))}
          </VStack>
        </Box>

        {/* Farcaster Frame Status */}
        <Box>
          <Heading size="md" mb={4}>
            🟣 Farcaster Frame Implementation Status
          </Heading>
          <VStack align="stretch" spacing={2}>
            <Text fontSize="sm" color="gray.400" mb={2}>
              Pages with Farcaster Frame support for miniapp sharing:
            </Text>
            {PAGES.filter((p) => p.hasFarcasterFrame).map((page) => (
              <HStack
                key={page.path}
                p={3}
                borderWidth="1px"
                borderRadius="md"
                bg="purple.900"
              >
                <Text flex={1}>✅ {page.type}</Text>
                <Code fontSize="xs">{page.path}</Code>
              </HStack>
            ))}
            <Text fontSize="sm" color="gray.500" mt={4}>
              Recommended additions: /blog, /user/[username]/snap/[permlink], /tricks/[trick]
            </Text>
          </VStack>
        </Box>
      </VStack>
    </Container>
  );
}
