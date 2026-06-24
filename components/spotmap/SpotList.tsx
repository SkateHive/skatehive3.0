"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  SimpleGrid,
  Spinner,
  Text,
} from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";
import { Discussion } from "@hiveio/dhive";
import LoadingComponent from "@/components/homepage/loadingComponent";
import SpotCard from "./SpotCard";

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
  onLoadMore,
}: SpotListProps) {
  const t = useTranslations("map");

  // Merge any optimistic "just-posted" spot with the server-side list, dedupe,
  // and sort newest-first. Memoised so cards don't re-render on every parent
  // tick.
  const displayedSpots = useMemo<Discussion[]>(() => {
    const base = [...spots];
    if (newSpot && !base.some((c) => c.permlink === newSpot.permlink)) {
      base.unshift(newSpot);
    }
    base.sort((a, b) => {
      const da = a.created === "just now" ? new Date() : new Date(a.created);
      const db = b.created === "just now" ? new Date() : new Date(b.created);
      return db.getTime() - da.getTime();
    });
    return base;
  }, [spots, newSpot]);

  const handleLoadMore = useCallback(() => {
    if (onLoadMore && hasMore && !isLoading) onLoadMore();
  }, [onLoadMore, hasMore, isLoading]);

  // Infinite scroll
  useEffect(() => {
    if (!hasMore || isLoading || !onLoadMore) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.innerHeight + document.documentElement.scrollTop;
        const h = document.documentElement.offsetHeight;
        if (y >= h - 500 && hasMore && !isLoading) handleLoadMore();
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, isLoading, onLoadMore, handleLoadMore]);

  if (isLoading && displayedSpots.length === 0) {
    return <LoadingComponent />;
  }

  if (displayedSpots.length === 0) {
    return (
      <Box textAlign="center" my={10} color="gray.500">
        <Text>{t("noSpotsYet")}</Text>
      </Box>
    );
  }

  return (
    <Box my={{ base: 6, md: 10 }} className="spot-list">
      {/* Section header — gives the grid a clear identity below the map */}
      <Flex
        align="baseline"
        justify="space-between"
        mb={{ base: 4, md: 5 }}
        px={{ base: 1, md: 0 }}
      >
        <HStack spacing={3} align="baseline">
          <Heading
            as="h2"
            fontSize={{ base: "lg", md: "xl" }}
            color="primary"
            letterSpacing="wide"
            textTransform="uppercase"
            fontWeight="800"
          >
            Recent spots
          </Heading>
          <Box
            h="2px"
            flex={1}
            bg="linear-gradient(to right, var(--chakra-colors-primary), transparent)"
            opacity={0.4}
            display={{ base: "none", md: "block" }}
            minW="40px"
          />
        </HStack>
        <Text
          fontSize="xs"
          color="gray.500"
          fontFamily="ui-monospace, monospace"
        >
          {displayedSpots.length} spot{displayedSpots.length === 1 ? "" : "s"}
        </Text>
      </Flex>

      <SimpleGrid
        columns={{ base: 1, sm: 2, lg: 3 }}
        spacing={{ base: 4, md: 5 }}
      >
        {displayedSpots.map((spot) => (
          <SpotCard key={`${spot.author}/${spot.permlink}`} spot={spot} />
        ))}
      </SimpleGrid>

      {isLoading && displayedSpots.length > 0 && (
        <Flex justify="center" py={6}>
          <Spinner color="primary" />
        </Flex>
      )}

      {hasMore && onLoadMore && !isLoading && (
        <Flex justify="center" py={6}>
          <Button
            onClick={handleLoadMore}
            variant="outline"
            borderColor="primary"
            color="primary"
            _hover={{ bg: "primary", color: "background" }}
            size="sm"
            px={6}
          >
            {t("loadMoreSpots")}
          </Button>
        </Flex>
      )}
    </Box>
  );
}
