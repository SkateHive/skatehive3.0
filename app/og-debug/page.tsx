"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Input,
  Button,
  Image,
  Grid,
  Badge,
  Divider,
  Code,
  Spinner,
  IconButton,
  Wrap,
  WrapItem,
} from "@chakra-ui/react";
import { FaSync, FaExternalLinkAlt, FaCopy, FaCheck } from "react-icons/fa";

const PROD_URL = "https://skatehive.app";
const LOCAL_URL = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

// Pages to test — grouped by category
const TEST_PAGES = [
  // Bounties (POIDH)
  { label: "Bounty (Base)", path: "/bounties/poidh/8453/1091" },
  { label: "Bounty (Arb)", path: "/bounties/poidh/42161/232" },
  // Posts
  { label: "Post", path: "/post/skaters/is-it-possible-to-make-a-living-off-skateboarding-ft-william-damascena-and-leo-spanghero" },
  // Profiles
  { label: "Profile", path: "/user/xvlad" },
  { label: "Profile 2", path: "/user/web3pleb" },
  // Coins
  { label: "Coin", path: "/coin/0xfe10d3ce1b0f090935670368ec6de00d8d965523" },
  // Static pages
  { label: "Homepage", path: "/" },
  { label: "Bounties Hub", path: "/bounties" },
  { label: "Leaderboard", path: "/leaderboard" },
  { label: "Auction", path: "/auction" },
  // Additional pages
  { label: "Map", path: "/map" },
  { label: "Tricks", path: "/tricks" },
  { label: "Games", path: "/games" },
  { label: "Magazine", path: "/blog" },
];

interface ParsedMeta {
  title: string;
  description: string;
  ogImage: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  twitterCard: string;
  twitterImage: string;
  fcFrame: string;
  fcFrameImage: string;
  fcFramePostUrl: string;
  allTags: Record<string, string>;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseMeta(html: string): ParsedMeta {
  const get = (pattern: RegExp): string => {
    const m = html.match(pattern);
    return m ? decodeHtmlEntities(m[1]) : "";
  };

  const allTags: Record<string, string> = {};

  // OG tags
  const ogRegex = /property="og:([^"]+)"\s+content="([^"]*)"/g;
  let match;
  while ((match = ogRegex.exec(html)) !== null) {
    allTags[`og:${match[1]}`] = decodeHtmlEntities(match[2]);
  }

  // Twitter tags
  const twRegex = /name="twitter:([^"]+)"\s+content="([^"]*)"/g;
  while ((match = twRegex.exec(html)) !== null) {
    allTags[`twitter:${match[1]}`] = decodeHtmlEntities(match[2]);
  }

  // FC tags
  const fcRegex = /(?:property|name)="(fc:[^"]+)"\s+content="([^"]*)"/g;
  while ((match = fcRegex.exec(html)) !== null) {
    allTags[match[1]] = decodeHtmlEntities(match[2]);
  }

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/);

  return {
    title: titleMatch?.[1] || "",
    description: get(/name="description"\s+content="([^"]*)"/),
    ogImage: allTags["og:image"] || "",
    ogTitle: allTags["og:title"] || "",
    ogDescription: allTags["og:description"] || "",
    ogUrl: allTags["og:url"] || "",
    twitterCard: allTags["twitter:card"] || "",
    twitterImage: allTags["twitter:image"] || "",
    fcFrame: allTags["fc:frame"] || "",
    fcFrameImage: allTags["fc:frame:image"] || "",
    fcFramePostUrl: allTags["fc:frame:post_url"] || "",
    allTags,
  };
}

// Single card preview that shows the actual OG image + metadata
function MetaPreviewCard({
  url,
  autoLoad = false,
  rewriteBase,
}: {
  url: string;
  autoLoad?: boolean;
  rewriteBase?: string; // e.g. "http://localhost:3000" — rewrites production URLs in OG images
}) {
  const [meta, setMeta] = useState<ParsedMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const rewriteUrl = useCallback((imgUrl: string) => {
    if (!rewriteBase || !imgUrl) return imgUrl;
    // Rewrite https://skatehive.app/api/og/... to localhost/api/og/...
    return imgUrl.replace(/https?:\/\/(www\.)?skatehive\.app/g, rewriteBase);
  }, [rewriteBase]);

  const fetchMeta = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const proxyUrl = `/api/og-debug?url=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      const html = await res.text();
      const parsed = parseMeta(html);
      // Rewrite image URLs if needed
      if (rewriteBase) {
        parsed.ogImage = rewriteUrl(parsed.ogImage);
        parsed.twitterImage = rewriteUrl(parsed.twitterImage);
        parsed.fcFrameImage = rewriteUrl(parsed.fcFrameImage);
        // Rewrite fc:frame JSON imageUrl
        if (parsed.fcFrame) {
          parsed.fcFrame = parsed.fcFrame.replace(/https?:\/\/(www\.)?skatehive\.app/g, rewriteBase);
        }
      }
      setMeta(parsed);
    } catch (err: any) {
      setError(err.message || "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [url, rewriteBase, rewriteUrl]);

  useEffect(() => {
    if (autoLoad) fetchMeta();
  }, [autoLoad, fetchMeta]);

  const hasFarcaster = !!meta?.fcFrame;
  const fcData = hasFarcaster ? (() => {
    try { return JSON.parse(meta!.fcFrame); } catch { return null; }
  })() : null;

  const copyUrl = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box
      border="1px solid"
      borderColor="border"
      bg="rgba(0,0,0,0.3)"
      overflow="hidden"
    >
      {/* Header */}
      <HStack
        px={3}
        py={2}
        bg="rgba(0,0,0,0.5)"
        justify="space-between"
        borderBottom="1px solid"
        borderColor="border"
      >
        <Text
          fontSize="xs"
          fontFamily="mono"
          color="dim"
          noOfLines={1}
          flex={1}
        >
          {(() => { try { return new URL(url).pathname; } catch { return url; } })()}
        </Text>
        <HStack spacing={1}>
          <IconButton
            icon={copied ? <FaCheck /> : <FaCopy />}
            size="xs"
            aria-label="Copy URL"
            variant="ghost"
            color={copied ? "success" : "dim"}
            onClick={copyUrl}
          />
          <IconButton
            icon={<FaExternalLinkAlt />}
            size="xs"
            aria-label="Open"
            variant="ghost"
            color="dim"
            as="a"
            href={url}
            target="_blank"
          />
          <IconButton
            icon={<FaSync />}
            size="xs"
            aria-label="Refresh"
            variant="ghost"
            color="dim"
            onClick={fetchMeta}
            isLoading={loading}
          />
        </HStack>
      </HStack>

      {!meta && !loading && !error && (
        <Box p={6} textAlign="center">
          <Button
            size="sm"
            onClick={fetchMeta}
            fontFamily="mono"
            fontSize="xs"
            borderRadius="none"
            border="1px solid"
            borderColor="primary"
            color="primary"
            bg="transparent"
            _hover={{ bg: "rgba(167,255,0,0.1)" }}
          >
            LOAD PREVIEW
          </Button>
        </Box>
      )}

      {loading && (
        <Box p={6} textAlign="center">
          <Spinner size="sm" color="primary" />
        </Box>
      )}

      {error && (
        <Box p={3}>
          <Text fontSize="xs" fontFamily="mono" color="error">
            {error}
          </Text>
        </Box>
      )}

      {meta && (
        <VStack spacing={0} align="stretch">
          {/* OG Image */}
          {meta.ogImage && (
            <Box position="relative">
              <Image
                src={meta.ogImage}
                alt={meta.ogTitle}
                w="100%"
                maxH="300px"
                objectFit="contain"
                bg="black"
              />
              {/* Badges overlay */}
              <HStack position="absolute" top={2} right={2} spacing={1}>
                {hasFarcaster && (
                  <Badge
                    bg="purple.600"
                    color="white"
                    fontSize="2xs"
                    fontFamily="mono"
                  >
                    FC FRAME
                  </Badge>
                )}
                <Badge
                  bg={meta.twitterCard ? "blue.600" : "red.600"}
                  color="white"
                  fontSize="2xs"
                  fontFamily="mono"
                >
                  {meta.twitterCard || "NO TWITTER"}
                </Badge>
              </HStack>
            </Box>
          )}

          {/* Title + Description */}
          <Box px={3} py={2} borderTop="1px solid" borderColor="border">
            <Text
              fontSize="sm"
              fontFamily="mono"
              fontWeight="bold"
              color="text"
              noOfLines={2}
            >
              {meta.ogTitle || meta.title || "No title"}
            </Text>
            <Text fontSize="xs" fontFamily="mono" color="dim" noOfLines={2} mt={1}>
              {meta.ogDescription || meta.description || "No description"}
            </Text>
          </Box>

          {/* Farcaster Frame preview */}
          {fcData && (
            <Box
              px={3}
              py={2}
              borderTop="1px solid"
              borderColor="purple.800"
              bg="rgba(128,0,255,0.05)"
            >
              <Text fontSize="2xs" fontFamily="mono" color="purple.300" fontWeight="bold" mb={1}>
                FARCASTER FRAME
              </Text>
              <HStack spacing={2}>
                <Box
                  flex={1}
                  border="1px solid"
                  borderColor="purple.600"
                  bg="purple.900"
                  px={3}
                  py={1.5}
                  textAlign="center"
                >
                  <Text fontSize="xs" fontFamily="mono" color="purple.200" fontWeight="bold">
                    {fcData.button?.title || "Open"}
                  </Text>
                </Box>
              </HStack>
              <Text fontSize="2xs" fontFamily="mono" color="purple.400" mt={1}>
                action: {fcData.button?.action?.type || "none"} → {(() => { try { return new URL(fcData.button?.action?.url || "").pathname; } catch { return fcData.button?.action?.url || ""; } })() || ""}
              </Text>
            </Box>
          )}

          {/* Toggle raw */}
          <Box px={3} py={1} borderTop="1px solid" borderColor="border">
            <Button
              size="xs"
              variant="ghost"
              color="dim"
              fontFamily="mono"
              fontSize="2xs"
              onClick={() => setShowRaw(!showRaw)}
              w="100%"
            >
              {showRaw ? "HIDE" : "SHOW"} RAW TAGS ({Object.keys(meta.allTags).length})
            </Button>
          </Box>

          {showRaw && (
            <Box px={3} pb={3} maxH="200px" overflowY="auto">
              <Code
                display="block"
                whiteSpace="pre-wrap"
                bg="transparent"
                fontSize="2xs"
                fontFamily="mono"
                color="dim"
                p={0}
              >
                {Object.entries(meta.allTags)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")}
              </Code>
            </Box>
          )}
        </VStack>
      )}
    </Box>
  );
}

export default function OGDebugPage() {
  const [customUrl, setCustomUrl] = useState("");
  const [customCards, setCustomCards] = useState<string[]>([]);
  const [loadAll, setLoadAll] = useState(false);
  const [useLocal, setUseLocal] = useState(true);

  const BASE_URL = useLocal ? LOCAL_URL : PROD_URL;

  const addCustomUrl = () => {
    if (!customUrl.trim()) return;
    const url = customUrl.startsWith("http")
      ? customUrl
      : `${BASE_URL}${customUrl.startsWith("/") ? customUrl : `/${customUrl}`}`;
    setCustomCards((prev) => [url, ...prev]);
    setCustomUrl("");
  };

  return (
    <Container maxW="container.xl" py={6}>
      <VStack spacing={6} align="stretch">
        {/* Header */}
        <HStack justify="space-between" align="center">
          <VStack align="start" spacing={0}>
            <Text fontSize="lg" fontFamily="mono" fontWeight="900" color="primary">
              OG DEBUG
            </Text>
            <Text fontSize="xs" fontFamily="mono" color="dim">
              Preview OG images, metadata & Farcaster frames
            </Text>
          </VStack>
          <HStack spacing={2}>
            <Button
              size="sm"
              fontFamily="mono"
              fontSize="xs"
              borderRadius="none"
              border="1px solid"
              borderColor={useLocal ? "#27c93f" : "dim"}
              color={useLocal ? "#27c93f" : "dim"}
              bg={useLocal ? "rgba(39,201,63,0.1)" : "transparent"}
              onClick={() => setUseLocal(!useLocal)}
              _hover={{ bg: "rgba(167,255,0,0.1)" }}
            >
              {useLocal ? "LOCAL" : "PROD"}
            </Button>
            <Button
              size="sm"
              fontFamily="mono"
              fontSize="xs"
              borderRadius="none"
              border="1px solid"
              borderColor={loadAll ? "error" : "primary"}
              color={loadAll ? "error" : "primary"}
              bg="transparent"
              onClick={() => setLoadAll(!loadAll)}
              _hover={{ bg: "rgba(167,255,0,0.1)" }}
            >
              {loadAll ? "LOADING ALL..." : "LOAD ALL"}
            </Button>
          </HStack>
        </HStack>

        {/* Custom URL input */}
        <HStack>
          <Input
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomUrl()}
            placeholder="/bounties/poidh/8453/1091 or full URL"
            fontFamily="mono"
            fontSize="sm"
            borderRadius="none"
            border="1px solid"
            borderColor="border"
            bg="background"
            color="text"
            _placeholder={{ color: "dim" }}
            _focus={{ borderColor: "primary", boxShadow: "none" }}
          />
          <Button
            onClick={addCustomUrl}
            fontFamily="mono"
            fontSize="xs"
            fontWeight="bold"
            borderRadius="none"
            bg="primary"
            color="background"
            _hover={{ bg: "accent" }}
            px={6}
          >
            ADD
          </Button>
        </HStack>

        {/* Quick buttons */}
        <Box>
          <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mb={2}>
            QUICK ADD
          </Text>
          <Wrap spacing={1}>
            {TEST_PAGES.map((p) => (
              <WrapItem key={p.path}>
                <Button
                  size="xs"
                  fontFamily="mono"
                  fontSize="2xs"
                  borderRadius="none"
                  border="1px solid"
                  borderColor="border"
                  bg="transparent"
                  color="dim"
                  _hover={{ borderColor: "primary", color: "primary" }}
                  onClick={() =>
                    setCustomCards((prev) =>
                      prev.includes(`${BASE_URL}${p.path}`)
                        ? prev
                        : [`${BASE_URL}${p.path}`, ...prev]
                    )
                  }
                >
                  {p.label}
                </Button>
              </WrapItem>
            ))}
          </Wrap>
        </Box>

        <Divider borderColor="border" />

        {/* Custom cards first */}
        {customCards.length > 0 && (
          <>
            <Text fontSize="2xs" fontFamily="mono" color="primary" fontWeight="bold">
              CUSTOM ({customCards.length})
            </Text>
            <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
              {customCards.map((url) => (
                <MetaPreviewCard key={url} url={url} autoLoad rewriteBase={useLocal ? LOCAL_URL : undefined} />
              ))}
            </Grid>
            <Divider borderColor="border" />
          </>
        )}

        {/* All test pages */}
        <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">
          ALL PAGES ({TEST_PAGES.length})
        </Text>
        <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
          {TEST_PAGES.map((p) => (
            <MetaPreviewCard
              key={p.path}
              url={`${BASE_URL}${p.path}`}
              autoLoad={loadAll}
              rewriteBase={useLocal ? LOCAL_URL : undefined}
            />
          ))}
        </Grid>
      </VStack>
    </Container>
  );
}
