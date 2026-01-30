"use client";
import { useState, useEffect } from "react";
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
} from "@chakra-ui/react";

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
      image?: {
        url: string;
      };
    };
  }>;
  reactions?: {
    likes_count: number;
    recasts_count: number;
  };
}

interface FarcasterCastsViewProps {
  fid: number;
  username?: string;
}

export default function FarcasterCastsView({
  fid,
  username,
}: FarcasterCastsViewProps) {
  const [casts, setCasts] = useState<FarcasterCast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCasts() {
      if (!fid || fid === 0) {
        setIsLoading(false);
        setError("No Farcaster profile found");
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/farcaster/casts?fid=${fid}&limit=10` // Reduced to 10 to save API quota
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch casts: ${response.statusText}`);
        }

        const data = await response.json();
        setCasts(data.casts || []);
      } catch (err) {
        console.error("Error fetching Farcaster casts:", err);
        setError(err instanceof Error ? err.message : "Failed to load casts");
      } finally {
        setIsLoading(false);
      }
    }

    fetchCasts();
  }, [fid]);

  if (isLoading) {
    return (
      <Center minH="400px">
        <VStack spacing={4}>
          <Spinner size="xl" color="primary" thickness="3px" />
          <Text color="dim" fontFamily="mono" fontSize="sm">
            LOADING_CASTS...
          </Text>
        </VStack>
      </Center>
    );
  }

  if (error) {
    return (
      <Center minH="400px">
        <Box
          p={6}
          border="1px solid"
          borderColor="error"
          borderRadius="none"
          bg="muted"
        >
          <Text color="error" fontFamily="mono" fontSize="sm">
            ERROR: {error}
          </Text>
        </Box>
      </Center>
    );
  }

  if (casts.length === 0) {
    return (
      <Center minH="400px">
        <Box
          p={6}
          border="1px solid"
          borderColor="dim"
          borderRadius="none"
          bg="muted"
        >
          <Text color="dim" fontFamily="mono" fontSize="sm">
            NO_CASTS_FOUND
          </Text>
        </Box>
      </Center>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {casts.map((cast) => (
        <Box
          key={cast.hash}
          p={4}
          border="1px solid"
          borderColor="dim"
          bg="muted"
          _hover={{
            borderColor: "primary",
            boxShadow: "0 0 10px rgba(168, 255, 96, 0.2)",
          }}
          transition="all 0.2s"
        >
          {/* Cast Header */}
          <HStack spacing={3} mb={3}>
            <Avatar
              src={cast.author.pfp_url}
              name={cast.author.display_name}
              size="sm"
              borderRadius="none"
            />
            <VStack align="start" spacing={0} flex={1}>
              <Text
                color="text"
                fontWeight="bold"
                fontSize="sm"
                fontFamily="mono"
              >
                {cast.author.display_name}
              </Text>
              <Text color="dim" fontSize="xs" fontFamily="mono">
                @{cast.author.username}
              </Text>
            </VStack>
            <Text color="dim" fontSize="xs" fontFamily="mono">
              {new Date(cast.timestamp).toLocaleDateString()}
            </Text>
          </HStack>

          {/* Cast Text */}
          <Text
            color="text"
            fontSize="sm"
            fontFamily="mono"
            whiteSpace="pre-wrap"
            mb={3}
          >
            {cast.text}
          </Text>

          {/* Cast Embeds/Images */}
          {cast.embeds && cast.embeds.length > 0 && (
            <VStack spacing={2} align="stretch" mb={3}>
              {cast.embeds.map((embed, idx) => {
                // Try multiple sources for image URL
                const imageUrl = embed.metadata?.image?.url || embed.url;

                // Check if it's an image URL (by extension or content type)
                const isImageUrl = imageUrl && (
                  imageUrl.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ||
                  imageUrl.includes('/image/') ||
                  embed.metadata?.image
                );

                if (isImageUrl && imageUrl) {
                  return (
                    <Image
                      key={idx}
                      src={imageUrl}
                      alt="Cast embed"
                      maxH="400px"
                      objectFit="cover"
                      borderRadius="none"
                      border="1px solid"
                      borderColor="dim"
                      fallback={
                        <Box
                          p={2}
                          border="1px solid"
                          borderColor="dim"
                          borderRadius="none"
                        >
                          <Text color="dim" fontSize="xs" fontFamily="mono">
                            Failed to load image
                          </Text>
                        </Box>
                      }
                    />
                  );
                }

                // Show URL link for non-image embeds
                if (embed.url) {
                  return (
                    <Link
                      key={idx}
                      href={embed.url}
                      isExternal
                      color="primary"
                      fontSize="xs"
                      fontFamily="mono"
                      _hover={{ textDecoration: "underline" }}
                      noOfLines={1}
                    >
                      🔗 {embed.url}
                    </Link>
                  );
                }
                return null;
              })}
            </VStack>
          )}

          {/* Cast Stats */}
          {cast.reactions && (
            <HStack spacing={4} fontSize="xs" fontFamily="mono" color="dim">
              <Text>
                ❤️ {cast.reactions.likes_count || 0}
              </Text>
              <Text>
                🔄 {cast.reactions.recasts_count || 0}
              </Text>
              <Link
                href={`https://warpcast.com/${cast.author.username}/${cast.hash.slice(0, 10)}`}
                isExternal
                color="primary"
                _hover={{ textDecoration: "underline" }}
              >
                VIEW_ON_WARPCAST →
              </Link>
            </HStack>
          )}
        </Box>
      ))}
    </VStack>
  );
}
