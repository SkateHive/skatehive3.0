"use client";

import React, { useRef, useEffect, useState } from "react";
import { Player } from "@mantequilla-soft/3speak-player";
import { useStopFlipbookEvents } from "@/hooks/useStopFlipbookEvents";

interface ThreeSpeakPlayerProps {
  videoId: string; // "author/permlink"
}

// Known 3Speak thumbnail pattern — shown immediately so the player has
// something visible while the SDK's load() finishes its API round-trip.
// The SDK will overwrite video.poster with the real thumbnail once load()
// resolves with the canonical URL from the 3Speak API.
function initialPoster(videoId: string): string | undefined {
  const [author, permlink] = videoId.replace(/^@/, "").split("/");
  if (!author || !permlink) return undefined;
  return `https://img.3speakcontent.co/${author}/${permlink}/thumbnail.png`;
}

export function ThreeSpeakPlayer({ videoId }: ThreeSpeakPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useStopFlipbookEvents<HTMLDivElement>();
  const [aspectRatio, setAspectRatio] = useState("16 / 9");
  const [fatalError, setFatalError] = useState(false);
  const poster = initialPoster(videoId);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setFatalError(false);

    const player = new Player({ muted: false, autopause: true });

    player.on("ready", ({ isVertical }) => {
      setAspectRatio(isVertical ? "9 / 16" : "16 / 9");
    });

    player.on("error", ({ fatal }) => {
      if (fatal) setFatalError(true);
    });

    player.attach(video);
    player.load(videoId);

    return () => {
      player.destroy();
    };
  }, [videoId]);

  if (fatalError) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#888",
          fontFamily: "monospace",
          fontSize: "0.875rem",
          borderRadius: "8px",
        }}
      >
        video unavailable
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        aspectRatio,
        background: "#000",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <video
        ref={videoRef}
        controls
        playsInline
        poster={poster}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
