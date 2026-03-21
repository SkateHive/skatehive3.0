import React, { useMemo } from "react";
import MediaCarousel from "@/components/shared/MediaCarousel";
import OpenGraphPreview from "@/components/shared/OpenGraphPreview";
import SnapshotPreview from "@/components/shared/SnapshotPreview";
import { parseMediaContent, extractLastUrl } from "@/lib/utils/snapUtils";

import { isSnapshotUrl } from "@/lib/utils/snapshotUtils";

interface MediaRendererProps {
  mediaContent: string;
  fullContent: string; // Add full content to extract URLs from
}

const MediaRenderer = React.memo(function MediaRenderer({ mediaContent, fullContent }: MediaRendererProps) {
  const mediaItems = useMemo(() => parseMediaContent(mediaContent), [mediaContent]);
  const lastUrl = useMemo(() => extractLastUrl(fullContent), [fullContent]);

  return (
    <>
      {/* Render media content using MediaCarousel for consistent handling */}
      {mediaItems.length > 0 && <MediaCarousel mediaItems={mediaItems} />}

      {/* Render appropriate preview for the last URL */}
      {lastUrl && (
        <>
          {isSnapshotUrl(lastUrl) ? (
            <SnapshotPreview url={lastUrl} />
          ) : (
            <OpenGraphPreview url={lastUrl} />
          )}
        </>
      )}
    </>
  );
});

export default MediaRenderer;
