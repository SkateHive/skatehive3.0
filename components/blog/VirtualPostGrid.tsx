/**
 * VirtualPostGrid - Optimized post grid with Pretext.js
 * 
 * Virtual scrolling for blog/magazine posts with accurate height calculation
 * using pure JS text measurement.
 */

'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Box, SimpleGrid } from '@chakra-ui/react';
import { Discussion } from '@hiveio/dhive';
import PostCard from './PostCard';
import { usePretext, extractPlainText } from '@/hooks/usePretext';

interface VirtualPostGridProps {
  posts: Discussion[];
  columns: number;
  viewMode: 'grid' | 'list' | 'magazine';
  context?: 'blog' | 'profile' | 'rightsidebar';
  hideAuthorInfo?: boolean;
  containerHeight?: number;
}

interface ItemMeasurement {
  index: number;
  height: number;
  offset: number;
}

const OVERSCAN_ROWS = 2; // Render extra rows above/below
const BASE_CARD_HEIGHT = 400; // Estimated base height

export default function VirtualPostGrid({
  posts,
  columns,
  viewMode,
  context = 'blog',
  hideAuthorInfo = false,
  containerHeight = 800,
}: VirtualPostGridProps) {
  const { measureTextHeight } = usePretext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Group posts into rows
  const rows = useMemo(() => {
    const result: Discussion[][] = [];
    for (let i = 0; i < posts.length; i += columns) {
      result.push(posts.slice(i, i + columns));
    }
    return result;
  }, [posts, columns]);

  // Measure row heights using Pretext.js
  const rowMeasurements = useMemo<ItemMeasurement[]>(() => {
    let currentOffset = 0;
    const cardWidth = 300; // Approximate card width

    return rows.map((row, index) => {
      // Measure each card in the row
      const cardHeights = row.map((post) => {
        // Extract text from post
        const titleText = post.title || '';
        const bodyText = extractPlainText(post.body || '');
        const excerpt = bodyText.substring(0, 200); // First 200 chars

        // Measure title
        const titleMeasure = measureTextHeight(titleText, {
          width: cardWidth - 40, // Card width - padding
          fontSize: 20,
          lineHeight: 1.3,
        });

        // Measure excerpt
        const excerptMeasure = measureTextHeight(excerpt, {
          width: cardWidth - 40,
          fontSize: 14,
          lineHeight: 1.5,
        });

        // Total card height components:
        // - Avatar + author: 60px
        // - Image: 200px (if has image)
        // - Title: measured
        // - Excerpt: measured (capped at 3 lines)
        // - Footer (stats): 40px
        // - Padding: 32px

        const hasImage = post.json_metadata && JSON.parse(post.json_metadata)?.image;
        const imageHeight = hasImage ? 200 : 0;
        const titleHeight = titleMeasure.height;
        const excerptHeight = Math.min(excerptMeasure.height, 14 * 1.5 * 3); // Max 3 lines

        return (
          (hideAuthorInfo ? 0 : 60) +
          imageHeight +
          titleHeight +
          excerptHeight +
          40 +
          32
        );
      });

      // Row height = max card height in the row
      const maxCardHeight = Math.max(...cardHeights, BASE_CARD_HEIGHT);

      const measurement: ItemMeasurement = {
        index,
        height: maxCardHeight + 16, // + spacing
        offset: currentOffset,
      };

      currentOffset += measurement.height;
      return measurement;
    });
  }, [rows, measureTextHeight, hideAuthorInfo]);

  // Total height
  const totalHeight = useMemo(() => {
    return rowMeasurements.length > 0
      ? rowMeasurements[rowMeasurements.length - 1].offset +
          rowMeasurements[rowMeasurements.length - 1].height
      : 0;
  }, [rowMeasurements]);

  // Visible range
  const visibleRange = useMemo(() => {
    if (rowMeasurements.length === 0) return { start: 0, end: 0 };

    const scrollBottom = scrollTop + containerHeight;

    // Binary search for first visible row
    let start = 0;
    let end = rowMeasurements.length - 1;
    while (start < end) {
      const mid = Math.floor((start + end) / 2);
      if (rowMeasurements[mid].offset + rowMeasurements[mid].height < scrollTop) {
        start = mid + 1;
      } else {
        end = mid;
      }
    }

    // Find last visible row
    let endIndex = start;
    while (
      endIndex < rowMeasurements.length &&
      rowMeasurements[endIndex].offset < scrollBottom
    ) {
      endIndex++;
    }

    return {
      start: Math.max(0, start - OVERSCAN_ROWS),
      end: Math.min(rowMeasurements.length, endIndex + OVERSCAN_ROWS),
    };
  }, [scrollTop, containerHeight, rowMeasurements]);

  // Visible rows
  const visibleRows = useMemo(() => {
    return rows.slice(visibleRange.start, visibleRange.end);
  }, [rows, visibleRange]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    setScrollTop(scrollContainerRef.current.scrollTop);
  }, []);

  return (
    <Box
      ref={scrollContainerRef}
      onScroll={handleScroll}
      maxH={`${containerHeight}px`}
      overflowY="auto"
      sx={{
        '&::-webkit-scrollbar': { width: '8px' },
        '&::-webkit-scrollbar-track': { bg: 'transparent' },
        '&::-webkit-scrollbar-thumb': { bg: 'whiteAlpha.300', borderRadius: 'md' },
        '&::-webkit-scrollbar-thumb:hover': { bg: 'whiteAlpha.400' },
      }}
    >
      {/* Virtual scroll container */}
      <Box position="relative" height={`${totalHeight}px`}>
        {/* Visible rows */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          transform={`translateY(${rowMeasurements[visibleRange.start]?.offset || 0}px)`}
        >
          {visibleRows.map((row, idx) => {
            const globalRowIndex = visibleRange.start + idx;
            const measurement = rowMeasurements[globalRowIndex];

            return (
              <Box key={globalRowIndex} minH={`${measurement?.height || BASE_CARD_HEIGHT}px`} mb={4}>
                <SimpleGrid columns={columns} spacing={4}>
                  {row.map((post) => (
                    <PostCard
                      key={post.permlink}
                      post={post}
                      viewMode={viewMode}
                      context={context}
                      hideAuthorInfo={hideAuthorInfo}
                    />
                  ))}
                </SimpleGrid>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
