import { Box } from "@chakra-ui/react";
import { EnhancedMarkdownRenderer } from "@/components/markdown/EnhancedMarkdownRenderer";
import VideoRenderer from "@/components/layout/VideoRenderer";
import MediaCarousel from "@/components/shared/MediaCarousel";
import OpenGraphPreview from "@/components/shared/OpenGraphPreview";
import { parseMediaContent, extractLastUrl } from "@/lib/utils/snapUtils";

interface MediaRendererProps {
  mediaContent: string;
  fullContent: string; // Add full content to extract URLs from
  onMobileVideoFullscreen?: (videoSrc: string) => void; // Add mobile fullscreen callback
}

const MediaRenderer = ({ mediaContent, fullContent, onMobileVideoFullscreen }: MediaRendererProps) => {
  const mediaItems = parseMediaContent(mediaContent);
  const lastUrl = extractLastUrl(fullContent);

  return (
    <>
      {/* Render media content */}
      {mediaItems.length >= 2 && <MediaCarousel mediaItems={mediaItems} onMobileVideoFullscreen={onMobileVideoFullscreen} />}

      {mediaItems.length === 1 &&
        (() => {
          const item = mediaItems[0];

          if (item.type === "image") {
            return (
              <Box
                sx={{
                  img: {
                    width: "100%",
                    height: "auto",
                    objectFit: "contain",
                    marginTop: "0.5rem",
                    marginBottom: "0.5rem",
                  },
                }}
              >
                <EnhancedMarkdownRenderer content={item.content} />
              </Box>
            );
          }

          if (item.type === "video" && item.src) {
            return <VideoRenderer src={item.src} onMobileFullscreen={onMobileVideoFullscreen} />;
          }

          if (item.type === "iframe") {
            return (
              <Box
                dangerouslySetInnerHTML={{ __html: item.content }}
                sx={{
                  iframe: {
                    width: "100%",
                    height: "auto",
                    minHeight: "300px",
                  },
                }}
              />
            );
          }

          return null;
        })()}

      {/* Render OpenGraph preview for the last URL */}
      {lastUrl && <OpenGraphPreview url={lastUrl} />}
    </>
  );
};

export default MediaRenderer;
