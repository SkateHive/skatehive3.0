import React from "react";
import { Box, useBreakpointValue } from "@chakra-ui/react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination } from "swiper/modules";
import { EnhancedMarkdownRenderer } from "@/components/markdown/EnhancedMarkdownRenderer";
import VideoRenderer from "../layout/VideoRenderer";

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
  onMobileVideoFullscreen?: (videoSrc: string) => void;
}

const MediaCarousel: React.FC<MediaCarouselProps> = ({ mediaItems, onMobileVideoFullscreen }) => {
  const isMobile = useBreakpointValue({ base: true, md: false });

  if (mediaItems.length === 0) return null;

  // If only one media item, render without carousel
  if (mediaItems.length === 1) {
    const item = mediaItems[0];
    return (
      <Box mt={2} mb={2}>
        {renderMediaItem(item, onMobileVideoFullscreen)}
      </Box>
    );
  }

  return (
    <Box position="relative" width="100%" mt={2} mb={2}>
      <Swiper
        modules={[Navigation, Pagination]}
        navigation={!isMobile}
        pagination={{
          clickable: true,
          dynamicBullets: true,
          dynamicMainBullets: 3,
        }}
        spaceBetween={0}
        slidesPerView={1}
        loop={mediaItems.length > 2}
        style={
          {
            "--swiper-navigation-color": "var(--chakra-colors-primary)",
            "--swiper-pagination-color": "var(--chakra-colors-primary)",
            "--swiper-navigation-size": "20px",
          } as React.CSSProperties
        }
        className="media-carousel"
      >
        {mediaItems.map((item, index) => (
          <SwiperSlide key={index}>
            <Box width="100%" display="flex" justifyContent="center">
              {renderMediaItem(item, onMobileVideoFullscreen)}
            </Box>
          </SwiperSlide>
        ))}
      </Swiper>
    </Box>
  );
};

function renderMediaItem(item: MediaItem, onMobileVideoFullscreen?: (videoSrc: string) => void) {
  switch (item.type) {
    case "image":
      return (
        <Box
          sx={{
            img: {
              width: "100%",
              height: "auto",
              objectFit: "contain",
              maxHeight: "500px",
              borderRadius: "md",
              display: "block",
              margin: "0 auto",
            },
          }}
        >
          <EnhancedMarkdownRenderer content={item.content} />
        </Box>
      );
    case "video":
      return item.src ? (
        <Box width="100%">
          <VideoRenderer src={item.src} onMobileFullscreen={onMobileVideoFullscreen} />
        </Box>
      ) : null;
    case "iframe":
      return (
        <Box
          dangerouslySetInnerHTML={{ __html: item.content }}
          sx={{
            iframe: {
              width: "100%",
              height: "auto",
              minHeight: "300px",
              maxHeight: "500px",
              borderRadius: "md",
            },
          }}
        />
      );
    default:
      return null;
  }
}

export default MediaCarousel;
