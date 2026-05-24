"use client";

import React, { useState } from "react";
import VideoRenderer from "@/components/layout/VideoRenderer";
import { APP_CONFIG } from "@/config/app.config";

interface VideoEmbedProps {
  type: "VIDEO" | "ODYSEE" | "YOUTUBE" | "VIMEO";
  id: string;
  index: number;
}

function YouTubeLite({ id }: { id: string }) {
  const [active, setActive] = useState(false);
  const [posterSrc, setPosterSrc] = useState(
    `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
  );

  if (active) {
    return (
      <iframe
        src={`https://www.youtube.com/embed/${id}?autoplay=1`}
        style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setActive(true)}
      aria-label="Play video"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16 / 9",
        border: 0,
        padding: 0,
        background: "#000",
        cursor: "pointer",
        overflow: "hidden",
        display: "block",
      }}
    >
      <img
        src={posterSrc}
        onError={() =>
          setPosterSrc(`https://img.youtube.com/vi/${id}/hqdefault.jpg`)
        }
        alt=""
        loading="lazy"
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <svg
          width="68"
          height="48"
          viewBox="0 0 68 48"
          style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }}
        >
          <path
            d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55C3.97 2.33 2.27 4.81 1.48 7.74 0 13.06 0 24 0 24s0 10.94 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C68 34.94 68 24 68 24s0-10.94-1.48-16.26z"
            fill="#f00"
          />
          <path d="M45 24 27 14v20" fill="#fff" />
        </svg>
      </span>
    </button>
  );
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
      return <YouTubeLite key={`youtube-${id}-${index}`} id={id} />;

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
