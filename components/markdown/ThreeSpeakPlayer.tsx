"use client";

import React, { useRef, useEffect, useState } from "react";
import { Player } from "@mantequilla-soft/3speak-player";

interface ThreeSpeakPlayerProps {
  videoId: string; // "author/permlink"
}

export function ThreeSpeakPlayer({ videoId }: ThreeSpeakPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [aspectRatio, setAspectRatio] = useState("16 / 9");
  const [fatalError, setFatalError] = useState(false);

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
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
}
