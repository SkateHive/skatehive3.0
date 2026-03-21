import React from "react";
import VideoRenderer from "@/components/layout/VideoRenderer";
import { APP_CONFIG } from "@/config/app.config";

interface VideoEmbedProps {
  type: "VIDEO" | "ODYSEE" | "YOUTUBE" | "VIMEO";
  id: string;
  index: number;
}

export function VideoEmbed({ type, id, index }: VideoEmbedProps) {
  switch (type) {
    case "VIDEO":
      return (
          <VideoRenderer
            key={`video-${id}-${index}`}
            src={`https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${id}`}
          />

      );

    case "ODYSEE":
      return (
        <iframe
          key={`odysee-${index}`}
          src={id}
          style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
          allowFullScreen
          loading="lazy"
          id={`odysee-iframe-${index}`}
        />
      );

    case "YOUTUBE":
      return (
        <iframe
          key={`youtube-${index}`}
          src={`https://www.youtube.com/embed/${id}`}
          style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
          allowFullScreen
          id={`youtube-iframe-${index}`}
        />
      );

    case "VIMEO":
      return (
        <iframe
          key={`vimeo-${index}`}
          src={`https://player.vimeo.com/video/${id}`}
          style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
          allowFullScreen
          id={`vimeo-iframe-${index}`}
        />
      );

    default:
      return null;
  }
}
