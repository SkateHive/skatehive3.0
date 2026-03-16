import React, { useState, useEffect, useRef } from "react";
import { Box, Text, VStack, useBreakpointValue } from "@chakra-ui/react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation } from "swiper/modules";
import { EnhancedMarkdownRenderer } from "@/components/markdown/EnhancedMarkdownRenderer";
import VideoRenderer from "../layout/VideoRenderer";
import {
  isMeaningfulCaption,
  extractImageCaption,
} from "@/lib/utils/captionUtils";

// Import Swiper styles
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

interface MediaItem {
  type: "image" | "video" | "iframe";
  content: string;
  src?: string;
}

interface MediaCarouselProps {
  mediaItems: MediaItem[];
}

const MediaCarousel: React.FC<MediaCarouselProps> = ({ mediaItems }) => {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [containerHeight, setContainerHeight] = useState<number>(500);
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const mediaRefs = useRef<(HTMLImageElement | HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    // Function to calculate the tallest media item maintaining aspect ratio
    const calculateMaxHeight = () => {
      const containerWidth = isMobile ? window.innerWidth - 32 : 600; // Account for padding

      const heights = mediaRefs.current
        .filter(
          (ref): ref is HTMLImageElement | HTMLVideoElement => ref !== null
        )
        .map((ref) => {
          let naturalWidth = 0;
          let naturalHeight = 0;

          if (ref instanceof HTMLImageElement) {
            naturalWidth = ref.naturalWidth || ref.width;
            naturalHeight = ref.naturalHeight || ref.height;
          } else if (ref instanceof HTMLVideoElement) {
            naturalWidth = ref.videoWidth || ref.clientWidth;
            naturalHeight = ref.videoHeight || ref.clientHeight;
          }

          if (naturalWidth === 0 || naturalHeight === 0) return 0;

          // Calculate height when scaled to fit container width
          const aspectRatio = naturalHeight / naturalWidth;
          const scaledHeight = containerWidth * aspectRatio;

          return scaledHeight;
        })
        .filter((h) => h > 0);

      if (heights.length > 0) {
        const maxHeight = Math.max(...heights);
        // Cap at reasonable limits based on viewport
        const cappedHeight = isMobile
          ? Math.min(maxHeight, 600)
          : Math.min(maxHeight, 700);
        setContainerHeight(cappedHeight);
      }
    };

    // Load all images and videos first
    const loadPromises = mediaItems.map((item, index) => {
      if (item.type === "image") {
        const urlMatch = item.content.match(/!\[.*?\]\((.*?)\)/);
        if (urlMatch && urlMatch[1]) {
          return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              mediaRefs.current[index] = img;
              resolve(img);
            };
            img.onerror = () => resolve(null);
            img.src = urlMatch[1];
          });
        }
      } else if (item.type === "video" && item.src) {
        return new Promise((resolve) => {
          const video = document.createElement("video");
          video.onloadedmetadata = () => {
            mediaRefs.current[index] = video;
            resolve(video);
          };
          video.onerror = () => resolve(null);
          video.src = item.src!;
        });
      }
      return Promise.resolve(null);
    });

    Promise.all(loadPromises).then(() => {
      calculateMaxHeight();
    });
  }, [mediaItems, isMobile]);

  if (mediaItems.length === 0) return null;

  // If only one media item, render without carousel
  if (mediaItems.length === 1) {
    const item = mediaItems[0];
    return (
      <Box mt={2} mb={2}>
        {renderMediaItem(item, false)}
      </Box>
    );
  }

  return (
    <Box position="relative" width="100%" mt={2} mb={2}>
      <Box position="relative">
        <Swiper
          modules={[Navigation]}
          navigation={!isMobile}
          spaceBetween={0}
          slidesPerView={1}
          loop={mediaItems.length > 2}
          onSlideChange={(swiper) => setCurrentSlide(swiper.realIndex)}
          style={
            {
              "--swiper-navigation-color": "var(--chakra-colors-primary)",
              "--swiper-navigation-size": "20px",
              height: "100%",
            } as React.CSSProperties
          }
          className="media-carousel"
        >
          {mediaItems.map((item, index) => (
            <SwiperSlide key={index}>
              <VStack
                width="100%"
                height="100%"
                justifyContent="center"
                alignItems="center"
                spacing={0}
              >
                {renderMediaItem(item, true, containerHeight)}
              </VStack>
            </SwiperSlide>
          ))}
        </Swiper>
      </Box>
    </Box>
  );
};

function renderMediaItem(
  item: MediaItem,
  isCarouselMode: boolean = false,
  containerHeight?: number
) {
  const caption =
    item.type === "image" ? extractImageCaption(item.content) : null;
  const showCaption = caption && isMeaningfulCaption(caption);

  const captionElement = showCaption ? (
    <Text
      fontSize="xs"
      fontStyle="italic"
      textAlign="center"
      color="secondary"
      mt={2}
      px={2}
    >
      {caption}
    </Text>
  ) : null;

  switch (item.type) {
    case "image":
      return (
        <>
          <Box
            width="100%"
            display="flex"
            alignItems="center"
            justifyContent="center"
            overflow="hidden"
          >
            <Box
              width="100%"
              sx={{
                img: {
                  width: "100%",
                  height: "auto",
                  display: "block",
                },
              }}
            >
              <EnhancedMarkdownRenderer content={item.content} />
            </Box>
          </Box>
          {captionElement}
        </>
      );

    case "video":
      return item.src ? (
        <Box
          width="100%"
          height={isCarouselMode ? "100%" : "auto"}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bg={isCarouselMode ? "black" : "transparent"}
          borderRadius="none"
        >
          {isCarouselMode ? (
            <Box
              as="video"
              src={item.src}
              controls
              sx={{
                maxWidth: "100%",
                maxHeight: `${containerHeight}px`,
                width: "auto",
                height: "auto",
                objectFit: "contain",
                borderRadius: "md",
                display: "block",
              }}
            />
          ) : (
            <VideoRenderer src={item.src} />
          )}
        </Box>
      ) : null;

    case "iframe":
      return (
        <Box
          width="100%"
          height={isCarouselMode ? "100%" : "auto"}
          display="flex"
          alignItems="center"
          justifyContent="center"
        >
          <Box
            width="100%"
            height={isCarouselMode ? `${containerHeight}px` : "auto"}
            sx={{
              iframe: {
                width: "100%",
                height: "100%",
                minHeight: isCarouselMode ? "100%" : "300px",
                maxHeight: isCarouselMode ? "100%" : "500px",
                borderRadius: "md",
                border: "none",
              },
            }}
            dangerouslySetInnerHTML={{ __html: item.content }}
          />
        </Box>
      );

    default:
      return null;
  }
}

export default MediaCarousel;
