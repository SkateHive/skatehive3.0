"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "@/lib/i18n/hooks";
import {
  Box,
  VStack,
  HStack,
  Text,
  Image,
  Link,
  Spinner,
  Center,
  Avatar,
  Icon,
  Flex,
  Button,
} from "@chakra-ui/react";
import {
  FaHeart,
  FaRetweet,
  FaComment,
  FaExternalLinkAlt,
  FaRegHeart,
} from "react-icons/fa";
import { SiFarcaster } from "react-icons/si";

interface FarcasterCast {
  hash: string;
  text: string;
  timestamp: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
  embeds?: Array<{
    url?: string;
    metadata?: {
      image?: { url: string };
      html?: { ogImage?: Array<{ url: string }> };
      _status?: string;
    };
  }>;
  reactions?: {
    likes_count: number;
    recasts_count: number;
  };
  replies?: {
    count: number;
  };
  thread_hash?: string;
  parent_hash?: string | null;
}

interface FarcasterCastsViewProps {
  fid: number;
  username?: string;
}

// ─── Time formatting ─────────────────────────────────────

function formatCastTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;

  const date = new Date(timestamp);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

// ─── Single Cast ─────────────────────────────────────────

function CastItem({ cast }: { cast: FarcasterCast }) {
  const likes = cast.reactions?.likes_count || 0;
  const recasts = cast.reactions?.recasts_count || 0;
  const replies = cast.replies?.count || 0;
  const warpcastUrl = `https://warpcast.com/${cast.author.username}/${cast.hash.slice(0, 10)}`;

  // Extract images from embeds
  const images: string[] = [];
  const links: { url: string; label: string }[] = [];

  if (cast.embeds) {
    for (const embed of cast.embeds) {
      const imgUrl = embed.metadata?.image?.url
        || embed.metadata?.html?.ogImage?.[0]?.url;
      const rawUrl = embed.url || "";

      if (imgUrl) {
        images.push(imgUrl);
      } else if (
        rawUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i) ||
        rawUrl.includes("imagedelivery.net") ||
        rawUrl.includes("i.imgur.com") ||
        rawUrl.includes("res.cloudinary.com")
      ) {
        images.push(rawUrl);
      } else if (rawUrl && !rawUrl.includes("warpcast.com")) {
        // Clean URL for display
        try {
          const u = new URL(rawUrl);
          links.push({ url: rawUrl, label: `${u.hostname}${u.pathname.length > 1 ? u.pathname.slice(0, 30) : ""}` });
        } catch {
          links.push({ url: rawUrl, label: rawUrl.slice(0, 40) });
        }
      }
    }
  }

  // Parse text for mentions and links
  const renderText = (text: string) => {
    // Split by URLs and @mentions
    const parts = text.split(/(https?:\/\/\S+|@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith("http")) {
        return (
          <Link key={i} href={part} isExternal color="primary" wordBreak="break-all"
            _hover={{ textDecoration: "underline" }}>
            {part.length > 50 ? part.slice(0, 50) + "..." : part}
          </Link>
        );
      }
      if (part.startsWith("@")) {
        return (
          <Link key={i} href={`https://warpcast.com/${part.slice(1)}`} isExternal
            color="primary" _hover={{ textDecoration: "underline" }}>
            {part}
          </Link>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <Link href={warpcastUrl} isExternal _hover={{ textDecoration: "none" }} display="block">
      <HStack
        align="start"
        spacing={3}
        px={4}
        py={3}
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
        _hover={{ bg: "whiteAlpha.50" }}
        transition="background 0.15s"
        cursor="pointer"
      >
        {/* Avatar */}
        <Link href={`https://warpcast.com/${cast.author.username}`} isExternal
          onClick={(e) => e.stopPropagation()} flexShrink={0}>
          <Avatar
            src={cast.author.pfp_url}
            name={cast.author.display_name}
            size="md"
            borderRadius="full"
          />
        </Link>

        {/* Content */}
        <Box flex={1} minW={0}>
          {/* Header: name · @username · time */}
          <HStack spacing={1} mb={0.5} flexWrap="wrap">
            <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color="text" noOfLines={1}>
              {cast.author.display_name}
            </Text>
            <Text fontFamily="mono" fontSize="xs" color="gray.500">
              @{cast.author.username}
            </Text>
            <Text fontFamily="mono" fontSize="xs" color="gray.600">·</Text>
            <Text fontFamily="mono" fontSize="xs" color="gray.500">
              {formatCastTime(cast.timestamp)}
            </Text>
          </HStack>

          {/* Body */}
          {cast.text && (
            <Text fontFamily="mono" fontSize="sm" color="text" whiteSpace="pre-wrap"
              lineHeight="1.5" mb={2} wordBreak="break-word">
              {renderText(cast.text)}
            </Text>
          )}

          {/* Images */}
          {images.length > 0 && (
            <Box mb={2} borderRadius="md" overflow="hidden" border="1px solid" borderColor="whiteAlpha.100"
              onClick={(e) => e.stopPropagation()}>
              {images.length === 1 ? (
                <Image src={images[0]} alt="" maxH="350px" w="100%" objectFit="cover"
                  fallback={<Box h="100px" bg="whiteAlpha.50" />} />
              ) : (
                <Flex gap={0.5} flexWrap="wrap">
                  {images.slice(0, 4).map((img, i) => (
                    <Image key={i} src={img} alt="" h="180px" flex="1 1 45%" minW="45%"
                      objectFit="cover" fallback={<Box h="180px" flex="1 1 45%" bg="whiteAlpha.50" />} />
                  ))}
                </Flex>
              )}
            </Box>
          )}

          {/* Link previews */}
          {links.length > 0 && (
            <VStack spacing={1} align="stretch" mb={2}>
              {links.map((link, i) => (
                <Link key={i} href={link.url} isExternal onClick={(e) => e.stopPropagation()}
                  _hover={{ textDecoration: "none" }}>
                  <HStack spacing={2} px={3} py={2} border="1px solid" borderColor="whiteAlpha.100"
                    borderRadius="md" _hover={{ borderColor: "primary", bg: "whiteAlpha.50" }}
                    transition="all 0.15s">
                    <Icon as={FaExternalLinkAlt} boxSize={3} color="gray.500" />
                    <Text fontFamily="mono" fontSize="2xs" color="gray.400" noOfLines={1}>
                      {link.label}
                    </Text>
                  </HStack>
                </Link>
              ))}
            </VStack>
          )}

          {/* Action bar */}
          <HStack spacing={6} mt={1}>
            <HStack spacing={1.5} color="gray.500" _hover={{ color: "blue.400" }} transition="color 0.15s">
              <Icon as={FaComment} boxSize={3.5} />
              {replies > 0 && <Text fontFamily="mono" fontSize="2xs">{replies}</Text>}
            </HStack>
            <HStack spacing={1.5} color="gray.500" _hover={{ color: "green.400" }} transition="color 0.15s">
              <Icon as={FaRetweet} boxSize={3.5} />
              {recasts > 0 && <Text fontFamily="mono" fontSize="2xs">{recasts}</Text>}
            </HStack>
            <HStack spacing={1.5} color="gray.500" _hover={{ color: "red.400" }} transition="color 0.15s">
              <Icon as={FaRegHeart} boxSize={3.5} />
              {likes > 0 && <Text fontFamily="mono" fontSize="2xs">{likes}</Text>}
            </HStack>
            <HStack spacing={1} color="gray.600" _hover={{ color: "primary" }} transition="color 0.15s"
              onClick={(e) => e.stopPropagation()} ml="auto">
              <Icon as={SiFarcaster} boxSize={3} />
            </HStack>
          </HStack>
        </Box>
      </HStack>
    </Link>
  );
}

// ─── Main Component ──────────────────────────────────────

export default function FarcasterCastsView({ fid, username }: FarcasterCastsViewProps) {
  const t = useTranslations("profile");
  const [casts, setCasts] = useState<FarcasterCast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(15);

  const fetchCasts = useCallback(async () => {
    if (!fid || fid === 0) {
      setIsLoading(false);
      setError("No Farcaster profile found");
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/farcaster/casts?fid=${fid}&limit=${limit}`);
      if (!response.ok) throw new Error(`Failed to fetch casts: ${response.statusText}`);
      const data = await response.json();
      setCasts(data.casts || []);
    } catch (err) {
      console.error("Error fetching Farcaster casts:", err);
      setError(err instanceof Error ? err.message : "Failed to load casts");
    } finally {
      setIsLoading(false);
    }
  }, [fid, limit]);

  useEffect(() => { fetchCasts(); }, [fetchCasts]);

  if (isLoading) {
    return (
      <Center minH="300px">
        <VStack spacing={3}>
          <Spinner size="lg" color="primary" />
          <Text color="gray.500" fontFamily="mono" fontSize="xs">{t("loadingCasts")}</Text>
        </VStack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center minH="200px">
        <Text color="gray.500" fontFamily="mono" fontSize="xs">{error}</Text>
      </Center>
    );
  }

  if (casts.length === 0) {
    return (
      <Center minH="200px">
        <VStack spacing={2}>
          <Icon as={SiFarcaster} boxSize={6} color="gray.600" />
          <Text color="gray.500" fontFamily="mono" fontSize="xs">{t("noCastsFound")}</Text>
        </VStack>
      </Center>
    );
  }

  return (
    <Box border="1px solid" borderColor="whiteAlpha.100" borderRadius="md" overflow="hidden">
      {/* Cast feed */}
      <VStack spacing={0} align="stretch">
        {casts.map((cast) => (
          <CastItem key={cast.hash} cast={cast} />
        ))}
      </VStack>

      {/* Load more */}
      {casts.length >= limit && (
        <Center py={4} borderTop="1px solid" borderColor="whiteAlpha.100">
          <Button size="xs" fontFamily="mono" fontSize="2xs" variant="ghost"
            color="gray.500" onClick={() => setLimit((l) => l + 15)}
            _hover={{ color: "primary" }}>
            load more
          </Button>
        </Center>
      )}
    </Box>
  );
}
