"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ThreeSpeakApi } from "@mantequilla-soft/3speak-player";
import VideoRenderer from "@/components/layout/VideoRenderer";
import { useStopFlipbookEvents } from "@/hooks/useStopFlipbookEvents";

interface ThreeSpeakPlayerProps {
  videoId: string; // "author/permlink"
}

// Default aspect for the brief skeleton state shown before metadata resolves.
// Most 3Speak content is landscape, so this minimizes layout-shift on the
// common path. Vertical videos still get one size adjustment when their
// real aspect ratio resolves — unavoidable on first view, but cached for
// subsequent renders of the same video.
const SKELETON_ASPECT_FALLBACK = "16 / 9";

const SKELETON_BG_STYLE: React.CSSProperties = {
  background:
    "linear-gradient(90deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)",
  backgroundSize: "200% 100%",
  animation: "skatehive-skeleton-shimmer 1.4s ease-in-out infinite",
};

type VideoData = {
  thumbnail: string | null;
  short: boolean;
  /**
   * CSS aspect-ratio string ("W / H") driving every container — skeleton,
   * poster, and active player. Resolved in this order:
   *   1. Measured from the thumbnail image's natural dimensions (accurate,
   *      catches vertical videos that *aren't* uploaded as Shorts).
   *   2. 3Speak's `short` boolean as a coarse fallback (true → 9/16).
   *   3. 16/9 default.
   * Once we know it, both the poster and player render at the same shape
   * — no resize-jump when the user clicks play.
   */
  aspectRatio: string;
  /** Primary HLS playlist URL. Passed to VideoRenderer as src once the
   *  user clicks play; VideoRenderer's HLS effect handles the rest. */
  hlsUrl: string | null;
  /** Backup HLS playlists from the 3Speak metadata response. VideoRenderer's
   *  fallback/retry/watchdog cycle through these on stall or error. */
  hlsFallbacks: string[];
};

// Shared API client + result cache. A magazine page with many 3Speak
// embeds rerenders posters often; without caching, each rerender re-hits
// the 3Speak API. Cache key is "author/permlink".
const threeSpeakApi = new ThreeSpeakApi();
const videoDataCache = new Map<string, Promise<VideoData | null>>();

// Probe an image's intrinsic dimensions without rendering it. Used to pin
// down the aspect ratio of a video from its thumbnail before either poster
// or player mounts. Resolves to null on error or 4s timeout.
function measureImage(
  url: string
): Promise<{ w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    let done = false;
    const finish = (result: { w: number; h: number } | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), 4000);
    img.onload = () =>
      finish(
        img.naturalWidth && img.naturalHeight
          ? { w: img.naturalWidth, h: img.naturalHeight }
          : null
      );
    img.onerror = () => finish(null);
    img.src = url;
  });
}

function fetchVideoData(videoId: string): Promise<VideoData | null> {
  const [author, permlink] = videoId.replace(/^@/, "").split("/");
  if (!author || !permlink) return Promise.resolve(null);
  const key = `${author}/${permlink}`;
  const cached = videoDataCache.get(key);
  if (cached) return cached;
  const promise = (async (): Promise<VideoData | null> => {
    let thumbnail: string | null = null;
    let short = false;
    let hlsUrl: string | null = null;
    let hlsFallbacks: string[] = [];
    try {
      const meta = await threeSpeakApi.fetchVideoMetadata(author, permlink);
      thumbnail = meta?.thumbnail ?? null;
      short = !!meta?.short;
      hlsUrl = meta?.videoUrl ?? null;
      hlsFallbacks = [
        meta?.videoUrlFallback1,
        meta?.videoUrlFallback2,
        meta?.videoUrlFallback3,
      ].filter((u): u is string => !!u);
    } catch {
      return null;
    }
    let aspectRatio = short ? "9 / 16" : SKELETON_ASPECT_FALLBACK;
    if (thumbnail) {
      const dims = await measureImage(thumbnail);
      if (dims) aspectRatio = `${dims.w} / ${dims.h}`;
    }
    return { thumbnail, short, aspectRatio, hlsUrl, hlsFallbacks };
  })();
  videoDataCache.set(key, promise);
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
 *
 * Video metadata (thumbnail + vertical/horizontal flag) is fetched once
 * here and threaded down to whichever child is mounted — so the aspect
 * ratio is correct from the very first paint of the poster.
 */
export function ThreeSpeakPlayer({ videoId }: ThreeSpeakPlayerProps) {
  const [active, setActive] = useState(false);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const wrapperRef = useStopFlipbookEvents<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;
    setVideoData(null);
    fetchVideoData(videoId).then((d) => {
      if (!cancelled) setVideoData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  // Before metadata resolves, render a shimmer skeleton at the fallback
  // aspect. Once videoData arrives, the poster (and later the player)
  // both mount at the *measured* aspect ratio — no further size changes.
  if (!videoData) {
    return (
      <div ref={wrapperRef}>
        <ThreeSpeakSkeleton aspectRatio={SKELETON_ASPECT_FALLBACK} />
      </div>
    );
  }

  return (
    <div ref={wrapperRef}>
      {active ? (
        <ThreeSpeakActivePlayer videoData={videoData} />
      ) : (
        <ThreeSpeakPoster
          videoId={videoId}
          apiThumbnail={videoData.thumbnail}
          aspectRatio={videoData.aspectRatio}
          onActivate={() => setActive(true)}
        />
      )}
    </div>
  );
}

/**
 * Shimmer placeholder used while we're fetching metadata. Same animation
 * name as the skeleton in VideoEmbed.tsx so any future shared use stays
 * consistent. Mostly visible for a fraction of a second on the happy path.
 */
function ThreeSpeakSkeleton({
  aspectRatio,
  overlay = false,
}: {
  aspectRatio: string;
  overlay?: boolean;
}) {
  const base: React.CSSProperties = overlay
    ? { position: "absolute", inset: 0, pointerEvents: "none" }
    : { width: "100%", aspectRatio };
  return (
    <>
      <div aria-hidden style={{ ...base, ...SKELETON_BG_STYLE }} />
      <style jsx global>{`
        @keyframes skatehive-skeleton-shimmer {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
    </>
  );
}

function ThreeSpeakPoster({
  videoId,
  apiThumbnail,
  aspectRatio,
  onActivate,
}: {
  videoId: string;
  apiThumbnail: string | null;
  aspectRatio: string;
  onActivate: () => void;
}) {
  const candidates = useMemo(() => thumbCandidates(videoId), [videoId]);
  const [apiFailed, setApiFailed] = useState(false);
  const [probeIdx, setProbeIdx] = useState(0);
  const [probeFailed, setProbeFailed] = useState(false);
  const buttonRef = useStopFlipbookEvents<HTMLButtonElement>();

  // Two-tier resolution: prefer the API-resolved thumbnail; fall through
  // to the legacy CDN probe only if it's missing or its image 404s.
  const poster =
    apiThumbnail && !apiFailed
      ? apiThumbnail
      : !probeFailed
      ? candidates[probeIdx]
      : undefined;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onActivate}
      aria-label="Play 3Speak video"
      style={{
        position: "relative",
        width: "100%",
        aspectRatio,
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
          className="embed-poster"
          src={poster}
          alt=""
          loading="lazy"
          onError={() => {
            if (apiThumbnail && !apiFailed) {
              setApiFailed(true);
              return;
            }
            if (probeIdx + 1 < candidates.length) {
              setProbeIdx(probeIdx + 1);
            } else {
              setProbeFailed(true);
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
      {/* 3Speak-orange play badge on the poster — provenance affordance.
          Once playback starts, VideoRenderer's controls take over in
          Skatehive limegreen and a "3Speak" ribbon marks the source. */}
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

/**
 * Active 3Speak player — a thin wrapper around our generic VideoRenderer.
 *
 * The 3Speak metadata API gave us:
 *   - The primary HLS playlist + up to 3 CDN fallbacks
 *   - The thumbnail (poster) and exact aspect ratio
 *
 * VideoRenderer's HLS effect lazy-loads hls.js (or uses Safari's native
 * HLS) and its watchdog/retry/gateway-race cycles through the playlist
 * fallbacks the same way it does for IPFS gateways. The provenance ribbon
 * marks the content as 3Speak; controls stay Skatehive limegreen so the
 * experience reads as "our player, their source".
 */
function ThreeSpeakActivePlayer({ videoData }: { videoData: VideoData }) {
  if (!videoData.hlsUrl) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: videoData.aspectRatio,
          background: "#111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#888",
          fontFamily: "monospace",
          fontSize: "0.875rem",
        }}
      >
        video unavailable
      </div>
    );
  }
  return (
    <VideoRenderer
      src={videoData.hlsUrl}
      fallbackSrcs={videoData.hlsFallbacks}
      posterOverride={videoData.thumbnail}
      aspectRatioOverride={videoData.aspectRatio}
      provenance="3Speak"
      // 3Speak always supplies a poster, so the LogoMatrix on top of it
      // is just noise. IPFS keeps the default loader for older clips
      // that have no thumbnail wired up.
      showLoadingMatrix={false}
    />
  );
}
