"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStopFlipbookEvents } from "@/hooks/useStopFlipbookEvents";

interface ThreeSpeakPlayerProps {
  videoId: string; // "author/permlink"
}

/**
 * Thumbnail URL candidates for a 3Speak video. 3Speak doesn't expose a
 * canonical thumbnail format — the original upload determines the
 * extension. We probe in order (png → jpg → webp) and fall through to
 * the next when one returns 404. A black fallback color is used if all
 * three miss, which is rare in practice.
 */
function thumbCandidates(videoId: string): string[] {
  const [author, permlink] = videoId.replace(/^@/, "").split("/");
  if (!author || !permlink) return [];
  return [
    `https://img.3speakcontent.co/${author}/${permlink}/thumbnail.png`,
    `https://img.3speakcontent.co/${author}/${permlink}/thumbnail.jpg`,
    `https://img.3speakcontent.co/${author}/${permlink}/thumbnail.webp`,
  ];
}

/**
 * Click-to-play wrapper. Shows the poster + a play button until the user
 * clicks, then mounts the @mantequilla-soft/3speak-player SDK. Same pattern
 * as YouTubeLite — keeps the magazine fast even with many 3Speak embeds
 * (no SDK / hls.js download until the user actually wants to watch).
 */
export function ThreeSpeakPlayer({ videoId }: ThreeSpeakPlayerProps) {
  const [active, setActive] = useState(false);
  const wrapperRef = useStopFlipbookEvents<HTMLDivElement>();

  if (active) {
    return (
      <div ref={wrapperRef}>
        <ThreeSpeakActivePlayer videoId={videoId} />
      </div>
    );
  }

  return (
    <div ref={wrapperRef}>
      <ThreeSpeakPoster videoId={videoId} onActivate={() => setActive(true)} />
    </div>
  );
}

function ThreeSpeakPoster({
  videoId,
  onActivate,
}: {
  videoId: string;
  onActivate: () => void;
}) {
  const candidates = useMemo(() => thumbCandidates(videoId), [videoId]);
  const [posterIdx, setPosterIdx] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  const buttonRef = useStopFlipbookEvents<HTMLButtonElement>();

  const poster = posterFailed ? undefined : candidates[posterIdx];

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onActivate}
      aria-label="Play 3Speak video"
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
      {poster && (
        <img
          src={poster}
          alt=""
          loading="lazy"
          onError={() => {
            // Walk the candidate list; mark failure once all are exhausted
            // so the black background takes over instead of showing a broken
            // image icon.
            if (posterIdx + 1 < candidates.length) {
              setPosterIdx(posterIdx + 1);
            } else {
              setPosterFailed(true);
            }
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
      {/* 3Speak-orange play badge (matches their brand) */}
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
          width="76"
          height="76"
          viewBox="0 0 76 76"
          style={{ filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.55))" }}
        >
          <circle cx="38" cy="38" r="36" fill="rgba(255, 88, 0, 0.92)" />
          <path d="M30 24 L54 38 L30 52 Z" fill="#fff" />
        </svg>
      </span>
      {/* Provenance ribbon — visible affordance that this is 3Speak content */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          padding: "3px 8px",
          borderRadius: 4,
          background: "rgba(0,0,0,0.55)",
          color: "#fff",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.5,
          textTransform: "uppercase",
        }}
      >
        3Speak
      </span>
    </button>
  );
}

function ThreeSpeakActivePlayer({ videoId }: { videoId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("16 / 9");
  const [fatalError, setFatalError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let player: { destroy: () => void } | null = null;

    // Lazy-load the SDK only when the user clicks play. Cuts ~60KB
    // (hls.js) from the initial bundle for every page that just has
    // a 3Speak post visible but unplayed.
    import("@mantequilla-soft/3speak-player").then(({ Player }) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) return;

      const p = new Player({ muted: false, autopause: true });
      player = p;

      p.on("ready", ({ isVertical }) => {
        if (cancelled) return;
        setAspectRatio(isVertical ? "9 / 16" : "16 / 9");
        setIsLoading(false);
      });
      p.on("loading", (loading) => {
        if (!cancelled) setIsLoading(loading);
      });
      p.on("error", ({ fatal }) => {
        if (!cancelled && fatal) setFatalError(true);
      });

      p.attach(video);
      p.load(videoId);
      // User explicitly clicked play — kick playback now, browser allows
      // it because this lives inside the click's gesture chain (the
      // ThreeSpeakPlayer wrapper just flipped `active`).
      void p.play();
    });

    return () => {
      cancelled = true;
      if (player) player.destroy();
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
        position: "relative",
        width: "100%",
        aspectRatio,
        background: "#000",
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        controls
        playsInline
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "contain",
        }}
      />
      {isLoading && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            background: "rgba(0,0,0,0.35)",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid rgba(255,255,255,0.25)",
              borderTopColor: "rgba(255, 88, 0, 0.95)",
              borderRadius: "50%",
              animation: "tspeak-spin 0.85s linear infinite",
            }}
          />
        </div>
      )}
      <style jsx>{`
        @keyframes tspeak-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
