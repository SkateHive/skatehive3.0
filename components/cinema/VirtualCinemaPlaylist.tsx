/**
 * VirtualCinemaPlaylist - Optimized cinema playlist with Pretext.js
 * 
 * Uses pure JS text measurement to calculate item heights without DOM reads,
 * enabling smooth scrolling through hundreds of skate videos.
 */

'use client';

import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Box, VStack, HStack, Text, Icon, Image } from '@chakra-ui/react';
import { FaPlay } from 'react-icons/fa';
import { usePretext } from '@/hooks/usePretext';

interface CinemaVideo {
  slug: string;
  title: string;
  brand: string;
  year: number | null;
  thumbnail: string;
  description: string;
}

interface VirtualCinemaPlaylistProps {
  videos: CinemaVideo[];
  currentIndex: number;
  onVideoClick: (index: number) => void;
  containerHeight?: number;
}

interface ItemMeasurement {
  index: number;
  height: number;
  offset: number;
}

const OVERSCAN_COUNT = 5; // Render extra items above/below viewport
const BASE_ITEM_HEIGHT = 92; // Base height: thumbnail (68px) + padding (24px)
const THUMBNAIL_HEIGHT = 68;
const CONTAINER_WIDTH = 420;

export default function VirtualCinemaPlaylist({
  videos,
  currentIndex,
  onVideoClick,
  containerHeight = 600,
}: VirtualCinemaPlaylistProps) {
  const { measureTextHeight } = usePretext();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Measure all items using Pretext.js
  const itemMeasurements = useMemo<ItemMeasurement[]>(() => {
    let currentOffset = 0;

    return videos.map((video, index) => {
      // Measure title text height (wraps if long)
      const titleMeasure = measureTextHeight(video.title, {
        width: CONTAINER_WIDTH - 140 - 40, // Container - thumbnail - padding
        fontSize: 13,
        lineHeight: 1.3,
      });

      // Total height: max(thumbnail, title + year badge) + padding
      const contentHeight = Math.max(
        THUMBNAIL_HEIGHT,
        titleMeasure.height + (video.year ? 20 : 0) // Year badge adds 20px
      );

      const totalHeight = contentHeight + 24; // 12px top + 12px bottom padding

      const measurement: ItemMeasurement = {
        index,
        height: totalHeight,
        offset: currentOffset,
      };

      currentOffset += totalHeight;
      return measurement;
    });
  }, [videos, measureTextHeight]);

  // Total list height
  const totalHeight = useMemo(() => {
    return itemMeasurements.length > 0
      ? itemMeasurements[itemMeasurements.length - 1].offset +
          itemMeasurements[itemMeasurements.length - 1].height
      : 0;
  }, [itemMeasurements]);

  // Calculate visible range
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
      start: Math.max(0, start - OVERSCAN_COUNT),
      end: Math.min(itemMeasurements.length, endIndex + OVERSCAN_COUNT),
    };
  }, [scrollTop, containerHeight, itemMeasurements]);

  // Visible items
  const visibleItems = useMemo(() => {
    return videos.slice(visibleRange.start, visibleRange.end);
  }, [videos, visibleRange]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    setScrollTop(scrollContainerRef.current.scrollTop);
  }, []);

  // Auto-scroll to current video
  useEffect(() => {
    if (!scrollContainerRef.current || currentIndex < 0) return;

    const measurement = itemMeasurements[currentIndex];
    if (!measurement) return;

    const { offset, height } = measurement;
    const scrollContainer = scrollContainerRef.current;
    const currentScrollTop = scrollContainer.scrollTop;
    const viewportBottom = currentScrollTop + containerHeight;

    // Only scroll if item is not visible
    if (offset < currentScrollTop || offset + height > viewportBottom) {
      scrollContainer.scrollTo({
        top: offset - 100, // Offset from top for better UX
        behavior: 'smooth',
      });
    }
  }, [currentIndex, itemMeasurements, containerHeight]);

  return (
    <Box
      ref={scrollContainerRef}
      onScroll={handleScroll}
      flex={1}
      overflowY="auto"
      py={1}
      sx={{
        '&::-webkit-scrollbar': { width: '8px' },
        '&::-webkit-scrollbar-track': { bg: 'transparent' },
        '&::-webkit-scrollbar-thumb': { bg: 'transparent', borderRadius: 'md' },
        '&:hover::-webkit-scrollbar-thumb': { bg: 'whiteAlpha.300' },
        '&:hover::-webkit-scrollbar-thumb:hover': { bg: 'whiteAlpha.400' },
        scrollbarWidth: 'thin',
        scrollbarColor: 'transparent transparent',
        '&:hover': { scrollbarColor: 'rgba(255,255,255,0.3) transparent' },
      }}
    >
      {/* Virtual scroll container */}
      <Box position="relative" height={`${totalHeight}px`}>
        {/* Visible items */}
        <Box
          position="absolute"
          top={0}
          left={0}
          right={0}
          transform={`translateY(${itemMeasurements[visibleRange.start]?.offset || 0}px)`}
        >
          <VStack spacing={0} align="stretch">
            {visibleItems.map((video, idx) => {
              const globalIndex = visibleRange.start + idx;
              const isActive = globalIndex === currentIndex;
              const measurement = itemMeasurements[globalIndex];

              return (
                <HStack
                  key={video.slug}
                  spacing={3}
                  p={2}
                  py={3}
                  cursor="pointer"
                  onClick={() => onVideoClick(globalIndex)}
                  bg={isActive ? 'whiteAlpha.100' : 'transparent'}
                  borderLeft="3px solid"
                  borderColor={isActive ? 'primary' : 'transparent'}
                  _hover={{ bg: 'whiteAlpha.50' }}
                  transition="all 0.15s"
                  borderRadius="sm"
                  minH={`${measurement?.height || BASE_ITEM_HEIGHT}px`}
                >
                  {/* Index/Play icon */}
                  <Text
                    fontFamily="mono"
                    fontSize="xs"
                    color="gray.600"
                    w="20px"
                    textAlign="center"
                    flexShrink={0}
                  >
                    {isActive ? (
                      <Icon as={FaPlay} boxSize={2.5} color="primary" />
                    ) : (
                      globalIndex + 1
                    )}
                  </Text>

                  {/* Thumbnail */}
                  <Box
                    position="relative"
                    w="120px"
                    h="68px"
                    flexShrink={0}
                    borderRadius="sm"
                    overflow="hidden"
                    bg="background"
                  >
                    <Image
                      src={video.thumbnail}
                      alt={video.title}
                      w="100%"
                      h="100%"
                      objectFit="cover"
                    />
                    {video.year && (
                      <Box
                        position="absolute"
                        bottom={1}
                        right={1}
                        bg="blackAlpha.800"
                        px={1.5}
                        py={0.5}
                        borderRadius="sm"
                      >
                        <Text fontSize="2xs" fontFamily="mono" color="yellow.300">
                          {video.year}
                        </Text>
                      </Box>
                    )}
                  </Box>

                  {/* Title */}
                  <VStack align="start" spacing={0.5} flex={1} minW={0}>
                    <Text
                      fontSize="13px"
                      fontWeight={isActive ? 'semibold' : 'normal'}
                      color={isActive ? 'primary' : 'text'}
                      noOfLines={2}
                      lineHeight="1.3"
                    >
                      {video.title}
                    </Text>
                    <Text fontSize="xs" color="gray.500" noOfLines={1}>
                      {video.brand}
                    </Text>
                  </VStack>
                </HStack>
              );
            })}
          </VStack>
        </Box>
      </Box>
    </Box>
  );
}
