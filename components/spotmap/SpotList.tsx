import React, { useEffect, useState, useCallback } from "react";
import NextLink from "next/link";
import {
  Box,
  Text,
  Spinner,
  Button,
  SimpleGrid,
} from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";
import { Discussion } from "@hiveio/dhive";
import Snap from "@/components/homepage/Snap";
import LoadingComponent from "@/components/homepage/loadingComponent";

interface SpotListProps {
  newSpot?: Discussion | null;
  spots?: Discussion[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export default function SpotList({
  newSpot,
  spots = [],
  isLoading = false,
  hasMore = false,
  onLoadMore
}: SpotListProps) {
  const t = useTranslations('map');
  const [displayedSpots, setDisplayedSpots] = useState<Discussion[]>([]);

  // Update displayed spots when spots or newSpot changes
  useEffect(() => {
    
    let baseSpots = [...spots];
    if (newSpot) {
      // Prepend new spot if not already in the list
      const exists = baseSpots.some((c) => c.permlink === newSpot.permlink);
      if (!exists) {
        baseSpots = [newSpot, ...baseSpots];
      }
    }
    // Sort by created date, newest first, handling invalid dates
    baseSpots.sort((a, b) => {
      const dateA = a.created === "just now" ? new Date() : new Date(a.created);
      const dateB = b.created === "just now" ? new Date() : new Date(b.created);
      return dateB.getTime() - dateA.getTime();
    });
    setDisplayedSpots(baseSpots);
  }, [spots, newSpot]);

  const handleLoadMore = useCallback(() => {
    if (onLoadMore && hasMore && !isLoading) {
      onLoadMore();
    }
  }, [onLoadMore, hasMore, isLoading]);

  // Infinite scroll functionality
  useEffect(() => {
    if (!hasMore || isLoading || !onLoadMore) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollPosition = window.innerHeight + document.documentElement.scrollTop;
          const documentHeight = document.documentElement.offsetHeight;

          if (scrollPosition >= documentHeight - 500) { // Increased threshold for better UX
            if (hasMore && !isLoading) {
              handleLoadMore();
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [hasMore, isLoading, onLoadMore, handleLoadMore]);

  if (isLoading && displayedSpots.length === 0) {
    return <LoadingComponent />;
  }

  if (displayedSpots.length === 0) {
    return (
      <Box textAlign="center" my={8}>
        <Text>{t('noSpotsYet')}</Text>
      </Box>
    );
  }

  return (
    <Box my={8} className="spot-list">
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        {displayedSpots.map((spot) => (
          <Box
            key={spot.permlink}
            p={2}
            borderRadius="md"
            border="1px solid"
            borderColor="whiteAlpha.100"
            transition="border-color 0.15s, background 0.15s"
            _hover={{ borderColor: "primary", bg: "rgba(167,255,0,0.04)" }}
          >
            <Snap
              discussion={spot}
              onOpen={() => {}}
              setReply={() => {}}
            />
            <Box mt={2} textAlign="right">
              <NextLink
                href={`/spot/${spot.author}/${spot.permlink}`}
                style={{ fontSize: "0.85rem", color: "var(--chakra-colors-primary)" }}
                prefetch={false}
              >
                View spot →
              </NextLink>
            </Box>
          </Box>
        ))}
      </SimpleGrid>

      {/* Show loading spinner when fetching more data */}
      {isLoading && displayedSpots.length > 0 && (
        <Box display="flex" justifyContent="center" py={4}>
          <Spinner color="primary" />
        </Box>
      )}

      {/* Show Load More button only when there's more data to fetch */}
      {hasMore && onLoadMore && !isLoading && (
        <Box display="flex" justifyContent="center" py={4}>
          <Button
            onClick={handleLoadMore}
            colorScheme="primary"
            variant="outline"
          >
            {t('loadMoreSpots')}
          </Button>
        </Box>
      )}
    </Box>
  );
}
