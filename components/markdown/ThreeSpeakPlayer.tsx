"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ThreeSpeakApi } from "@mantequilla-soft/3speak-player";
import { useStopFlipbookEvents } from "@/hooks/useStopFlipbookEvents";

interface ThreeSpeakPlayerProps {
  videoId: string; // "author/permlink"
}

// Shared API client + thumbnail cache. A magazine page with many 3Speak
// embeds rerenders posters often (flip animations, viewport changes);
// without caching, each rerender re-hits the 3Speak API. The cache key is
// "author/permlink"; values are the resolved thumbnail URL (or null when
// the API returned no thumbnail).
const threeSpeakApi = new ThreeSpeakApi();
const thumbnailCache = new Map<string, Promise<string | null>>();

function fetchThumbnail(videoId: string): Promise<string | null> {
  const [author, permlink] = videoId.replace(/^@/, "").split("/");
  if (!author || !permlink) return Promise.resolve(null);
  const key = `${author}/${permlink}`;
  const cached = thumbnailCache.get(key);
  if (cached) return cached;
  const promise = threeSpeakApi
    .fetchVideoMetadata(author, permlink)
    .then((meta) => meta?.thumbnail ?? null)
    .catch(() => null);
  thumbnailCache.set(key, promise);
  return promise;
}

/**
 * Static-URL fallback for the thumbnail. The 3Speak API is the source of
 * truth, but when it's unreachable (offline, rate-limited, CORS hiccup) we
 * fall back to the legacy CDN convention — `img.3speakcontent.co/{author}/
 * {permlink}/thumbnail.{ext}` — probed in order (png → jpg → webp).
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
  // Two-tier resolution:
  //   1. apiThumbnail — the canonical URL from 3Speak's metadata endpoint.
  //      Resolves async; null until the fetch settles, then either a URL or
  //      null (API failure / no thumbnail on record).
  //   2. candidates[posterIdx] — legacy CDN convention, used only after the
  //      API attempt has resolved with no thumbnail.
  const [apiThumbnail, setApiThumbnail] = useState<string | null>(null);
  const [apiResolved, setApiResolved] = useState(false);
  const [posterIdx, setPosterIdx] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  const buttonRef = useStopFlipbookEvents<HTMLButtonElement>();

  useEffect(() => {
    let cancelled = false;
    setApiThumbnail(null);
    setApiResolved(false);
    fetchThumbnail(videoId).then((url) => {
      if (cancelled) return;
      setApiThumbnail(url);
      setApiResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Show the API thumbnail as soon as it resolves; otherwise wait for it
  // before falling back to the legacy CDN probe. This avoids a flash of the
  // probe URL on the (common) happy path.
  const poster = apiThumbnail
    ?? (apiResolved && !posterFailed ? candidates[posterIdx] : undefined);

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
            // If the API thumbnail itself failed to load (rare but
            // possible — stale metadata pointing at a deleted CDN file),
            // drop it and fall through to the legacy URL probe.
            if (apiThumbnail) {
              setApiThumbnail(null);
              return;
            }
            // Walk the legacy candidate list; mark failure once exhausted
            // so the black background takes over instead of a broken icon.
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
  // Default to 16/9 while the SDK loads metadata. The resize event below
  // refines this to the video's actual ratio (handles vertical, 4:3,
  // ultrawide, etc. — not just the two binary presets).
  const [aspectRatio, setAspectRatio] = useState<string>("16 / 9");
  const [fatalError, setFatalError] = useState(false);

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

      // Use the exact dimensions reported by the player (fires once
      // metadata is loaded) so the container hugs the real video shape.
      p.on("resize", (info: { width: number; height: number; isVertical: boolean }) => {
        if (cancelled || !info.width || !info.height) return;
        setAspectRatio(`${info.width} / ${info.height}`);
      });
      p.on("error", (err: { fatal: boolean }) => {
        if (!cancelled && err.fatal) setFatalError(true);
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
    </div>
  );
}
