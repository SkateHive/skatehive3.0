import React, { useState, useEffect } from "react";
import {
  Box,
  Image,
  Text,
  Link,
  VStack,
  HStack,
  Skeleton,
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  url: string;
  siteName?: string;
}

interface OpenGraphPreviewProps {
  url: string;
}

const OpenGraphPreview: React.FC<OpenGraphPreviewProps> = ({ url }) => {
  // All hooks must be called before any early returns
  const [ogData, setOgData] = useState<OpenGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Skip OpenGraph preview for coin URLs, Snapshot URLs, game URLs, and Google Maps links since they're handled by specific components
  const shouldSkip =
    url.includes("skatehive.app/coin") ||
    url.includes("zora.co/coin") ||
    url.includes("snapshot.org") ||
    url.includes("snapshot.box") ||
    url.includes("demo.snapshot.org") ||
    url.includes("skatehive.app/games") ||
    url.includes("maps.google.com") ||
    url.includes("www.google.com/maps") ||
    url.includes("goo.gl/maps") ||
    url.includes("maps.app.goo.gl");

  useEffect(() => {
    // Don't fetch if we should skip this URL
    if (shouldSkip) {
      setLoading(false);
      return;
    }

    const fetchOpenGraphData = async () => {
      try {
        setLoading(true);
        setError(false);

        // Use a service to fetch OpenGraph data
        // For now, we'll create a simple fallback with domain extraction
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace("www.", "");

        // Try to fetch from our API endpoint (you'll need to create this)
        try {
          const response = await fetch(
            `/api/opengraph?url=${encodeURIComponent(url)}`
          );
          if (response.ok) {
            const data = await response.json();
            setOgData(data);
          } else {
            throw new Error("API failed");
          }
        } catch (apiError) {
          // Fallback to basic URL data
          setOgData({
            title: domain,
            description: url,
            url: url,
            siteName: domain,
          });
        }
      } catch (err) {
        setError(true);
        console.error("Error fetching OpenGraph data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchOpenGraphData();
  }, [url, shouldSkip]);

  // Early return after all hooks have been called
  if (shouldSkip) {
    return null;
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={2} mb={2}>
        <Box
          border="1px solid"
          borderColor="gray.200"
          borderRadius="none"
          overflow="hidden"
          width="400px"
          minW="300px"
          maxW="400px"
          bg={"background"}
        >
          <Skeleton height="200px" />
          <Box p={3}>
            <Skeleton height="20px" mb={2} />
            <Skeleton height="16px" width="80%" />
          </Box>
        </Box>
      </Box>
    );
  }

  if (error || !ogData) {
    return null;
  }

  return (
    <Box display="flex" justifyContent="center" mt={2} mb={2}>
      <Link href={url} isExternal _hover={{ textDecoration: "none" }}>
        <Box
          border="1px solid"
          borderColor="gray.200"
          borderRadius="none"
          overflow="hidden"
          width="400px"
          minW="400px"
          maxW="400px"
          height="280px"
          cursor="pointer"
          bg="background"
          transition="all 0.2s"
          display="flex"
          flexDirection="column"
          _hover={{
            borderColor: "primary",
            transform: "translateY(-2px)",
            boxShadow: "md",
          }}
        >
          <Box
            width="100%"
            height="200px"
            minH="200px"
            maxH="200px"
            overflow="hidden"
            flex="0 0 200px"
          >
            <Image
              src={ogData.image || "/opengraph-image.png"}
              alt={ogData.title || "Preview"}
              width="100%"
              height="100%"
              objectFit="cover"
              fallback={
                <Box
                  width="100%"
                  height="200px"
                  bg="gray.100"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  backgroundImage="linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)"
                  backgroundSize="20px 20px"
                  backgroundPosition="0 0, 0 10px, 10px -10px, -10px 0px"
                >
                  <VStack spacing={2}>
                    <ExternalLinkIcon color="gray.400" boxSize={6} />
                    <Text fontSize="xs" color="gray.500" textAlign="center">
                      No image available
                    </Text>
                  </VStack>
                </Box>
              }
            />
          </Box>
          <Box p={3} flex="1">
            <VStack align="start" spacing={1}>
              {ogData.title && (
                <Text
                  fontWeight="semibold"
                  fontSize="sm"
                  noOfLines={2}
                  color="primary"
                >
                  {ogData.title}
                </Text>
              )}
              {ogData.description && (
                <Text
                  fontSize="xs"
                  color="primary"
                  noOfLines={2}
                  lineHeight="1.3"
                >
                  {ogData.description}
                </Text>
              )}
              <HStack spacing={1} align="center">
                <ExternalLinkIcon color="accent" boxSize={3} />
                <Text fontSize="xs" color="gray.500">
                  {ogData.siteName || new URL(url).hostname.replace("www.", "")}
                </Text>
              </HStack>
            </VStack>
          </Box>
        </Box>
      </Link>
    </Box>
  );
};

export default OpenGraphPreview;
