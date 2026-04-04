/**
 * VirtualCastsView - Optimized Farcaster casts with Pretext.js
 * 
 * Virtual scrolling for infinite casts feed with accurate height calculation.
 */

'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Box, VStack, Spinner, Center, Text } from '@chakra-ui/react';
import { usePretext, extractPlainText } from '@/hooks/usePretext';

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

interface VirtualCastsViewProps {
  casts: FarcasterCast[];
  renderCast: (cast: FarcasterCast) => React.ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

interface ItemMeasurement {
  index: number;
  height: number;
  offset: number;
}

const OVERSCAN_ITEMS = 3;
const BASE_CAST_HEIGHT = 200; // Estimated base height

export default function VirtualCastsView({
  casts,
  renderCast,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: VirtualCastsViewProps) {
  const { measureTextHeight } = usePretext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const containerHeight = 800; // Fixed container height

  // Measure cast heights using Pretext.js
  const itemMeasurements = useMemo<ItemMeasurement[]>(() => {
    let currentOffset = 0;
    const cardWidth = 600; // Approximate cast width

    return casts.map((cast, index) => {
      // Extract text
      const castText = extractPlainText(cast.text || '');

      // Measure text
      const textMeasure = measureTextHeight(castText, {
        width: cardWidth - 80, // Card width - padding - avatar
        fontSize: 14,
        lineHeight: 1.5,
      });

      // Cast height components:
      // - Avatar + header: 60px
      // - Text: measured
      // - Images: 200px per image (if exists)
      // - Links: 40px per link
      // - Action bar: 40px
      // - Padding: 24px

      const imageCount = cast.embeds?.filter(e => 
        e.metadata?.image?.url || e.url?.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)
      ).length || 0;

      const linkCount = cast.embeds?.filter(e => 
        e.url && !e.metadata?.image?.url
      ).length || 0;

      const height =
        60 + // Header
        textMeasure.height +
        (imageCount > 0 ? 200 : 0) + // Images
        (linkCount * 40) + // Links
        40 + // Actions
        24; // Padding

      const measurement: ItemMeasurement = {
        index,
        height: Math.max(height, BASE_CAST_HEIGHT),
        offset: currentOffset,
      };

      currentOffset += measurement.height;
      return measurement;
    });
  }, [casts, measureTextHeight]);

  // Total height
  const totalHeight = useMemo(() => {
    return itemMeasurements.length > 0
      ? itemMeasurements[itemMeasurements.length - 1].offset +
          itemMeasurements[itemMeasurements.length - 1].height
      : 0;
  }, [itemMeasurements]);

  // Visible range
  const visibleRange = useMemo(() => {
    if (itemMeasurements.length === 0) return { start: 0, end: 0 };

    const scrollBottom = scrollTop + containerHeight;

    // Binary search for first visible item
    let start = 0;
    let end = itemMeasurements.length - 1;
    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      if (itemMeasurements[mid].offset + itemMeasurements[mid].height < scrollTop) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }

    // Find last visible item
    let endIndex = start;
    while (
      endIndex < itemMeasurements.length &&
      itemMeasurements[endIndex].offset < scrollBottom
    ) {
      endIndex++;
    }

    return {
      start: Math.max(0, start - OVERSCAN_ITEMS),
      end: Math.min(itemMeasurements.length, endIndex + OVERSCAN_ITEMS),
    };
  }, [scrollTop, containerHeight, itemMeasurements]);

  // Visible casts
  const visibleCasts = useMemo(() => {
    return casts.slice(visibleRange.start, visibleRange.end);
  }, [casts, visibleRange]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop: newScrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    
    setScrollTop(newScrollTop);

    // Load more when near bottom
    if (
      hasMore &&
      !isLoadingMore &&
      onLoadMore &&
      scrollHeight - (newScrollTop + clientHeight) < 500
    ) {
      onLoadMore();
    }
  }, [hasMore, isLoadingMore, onLoadMore]);

  return (
    <Box
      ref={scrollContainerRef}
      onScroll={handleScroll}
      maxH={`${containerHeight}px`}
      overflowY="auto"
      border="1px solid"
      borderColor="whiteAlpha.100"
      borderRadius="md"
      sx={{
        '&::-webkit-scrollbar': { width: '8px' },
        '&::-webkit-scrollbar-track': { bg: 'transparent' },
        '&::-webkit-scrollbar-thumb': { bg: 'whiteAlpha.300', borderRadius: 'md' },
        '&::-webkit-scrollbar-thumb:hover': { bg: 'whiteAlpha.400' },
      }}
    >
      {/* Virtual scroll container */}
      <Box position="relative" height={`${totalHeight}px`}>
        {/* Visible casts */}
        <VStack
          spacing={0}
          align="stretch"
          position="absolute"
          top={0}
          left={0}
          right={0}
          transform={`translateY(${itemMeasurements[visibleRange.start]?.offset || 0}px)`}
        >
          {visibleCasts.map((cast, idx) => {
            const globalIndex = visibleRange.start + idx;
            const measurement = itemMeasurements[globalIndex];

            return (
              <Box
                key={cast.hash}
                minH={`${measurement?.height || BASE_CAST_HEIGHT}px`}
              >
                {renderCast(cast)}
              </Box>
            );
          })}
        </VStack>
      </Box>

      {/* Loading indicator - sticky at viewport bottom */}
      {isLoadingMore && (
        <Box
          position="sticky"
          bottom={0}
          left={0}
          right={0}
          textAlign="center"
          py={4}
          bg="background"
          borderTop="1px solid"
          borderColor="whiteAlpha.100"
          zIndex={10}
        >
          <Center>
            <VStack spacing={2}>
              <Spinner size="sm" color="primary" />
              <Text fontSize="xs" color="gray.500" fontFamily="mono">
                Loading more casts...
              </Text>
            </VStack>
          </Center>
        </Box>
      )}
    </Box>
  );
}
