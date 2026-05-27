"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ThreeSpeakApi } from "@mantequilla-soft/3speak-player";
import { FiMaximize, FiMinimize, FiVolume2, FiVolumeX } from "react-icons/fi";
import { LuPause, LuPlay } from "react-icons/lu";
import { useStopFlipbookEvents } from "@/hooks/useStopFlipbookEvents";

interface ThreeSpeakPlayerProps {
  videoId: string; // "author/permlink"
}

// Skatehive's primary brand color — used as the accent on every interactive
// surface in the player (active icons, progress fill, scrub thumb).
const PRIMARY = "limegreen";

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
    try {
      const meta = await threeSpeakApi.fetchVideoMetadata(author, permlink);
      thumbnail = meta?.thumbnail ?? null;
      short = !!meta?.short;
    } catch {
      return null;
    }
    let aspectRatio = short ? "9 / 16" : SKELETON_ASPECT_FALLBACK;
    if (thumbnail) {
      const dims = await measureImage(thumbnail);
      if (dims) aspectRatio = `${dims.w} / ${dims.h}`;
    }
    return { thumbnail, short, aspectRatio };
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

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
        <ThreeSpeakActivePlayer
          videoId={videoId}
          initialAspectRatio={videoData.aspectRatio}
        />
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
 * Shimmer placeholder used in two places: while we're fetching metadata,
 * and as an overlay on top of the empty <video> element while the SDK
 * loads + the first HLS segment downloads. Same animation in both spots
 * so a click-through transition reads as "same skeleton, just briefly".
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
      {/* 3Speak-orange play badge on the poster (matches their brand and
          telegraphs the source). Once playback starts, our control bar uses
          Skatehive limegreen — provenance on the cover, our app inside. */}
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

function ThreeSpeakActivePlayer({
  videoId,
  initialAspectRatio,
}: {
  videoId: string;
  initialAspectRatio: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Player ref is `any` because the SDK is dynamic-imported and its types
  // aren't reachable to the static type system inside this effect. The
  // surface we call (togglePlay/setMuted/seek/toggleFullscreen) is stable.
  const playerRef = useRef<any>(null);

  // Pre-seeded from the API's `short` flag so the container is the right
  // shape on the first paint. The SDK's `resize` event later refines this
  // to the exact width/height the video reports — usually a no-op since
  // the API flag already gave us the right orientation.
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio);
  const [fatalError, setFatalError] = useState(false);
  // false from mount until the SDK fires `ready` (metadata + first frame
  // available). Drives the shimmer skeleton overlay that fills the gap
  // between "user clicked play" and "video actually renders" — usually
  // 0.5–2s while hls.js loads and the first HLS segment downloads.
  const [isReady, setIsReady] = useState(false);

  // Control-bar state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    let player: any = null;

    // Lazy-load the SDK only when the user clicks play. Cuts ~60KB
    // (hls.js) from the initial bundle for every page that just has
    // a 3Speak post visible but unplayed.
    import("@mantequilla-soft/3speak-player").then(({ Player }) => {
      if (cancelled) return;
      const video = videoRef.current;
      if (!video) return;

      const p = new Player({ muted: false, autopause: true });
      player = p;
      playerRef.current = p;

      p.on(
        "resize",
        (info: { width: number; height: number; isVertical: boolean }) => {
          if (cancelled || !info.width || !info.height) return;
          setAspectRatio(`${info.width} / ${info.height}`);
        }
      );
      p.on("ready", () => {
        if (!cancelled) setIsReady(true);
      });
      p.on("error", (err: { fatal: boolean }) => {
        if (!cancelled && err.fatal) setFatalError(true);
      });
      p.on("play", () => {
        if (cancelled) return;
        setIsPlaying(true);
        // Safety net — if the SDK never fires `ready` (some HLS sources
        // start playing before reporting it), treat first play as ready.
        setIsReady(true);
      });
      p.on("pause", () => !cancelled && setIsPlaying(false));
      p.on(
        "timeupdate",
        (s: { currentTime: number; duration: number }) => {
          if (cancelled) return;
          setCurrentTime(s.currentTime);
          if (Number.isFinite(s.duration)) setDuration(s.duration);
        }
      );
      p.on("fullscreen", (a: boolean) => !cancelled && setIsFullscreen(a));

      p.attach(video);
      p.load(videoId);
      // Inside the user's click gesture chain (poster activation just
      // flipped `active`), so browsers allow unmuted autoplay here.
      void p.play();
    });

    return () => {
      cancelled = true;
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      if (player) player.destroy();
      playerRef.current = null;
    };
  }, [videoId]);

  // Hide the control bar after a short idle period while playing, show
  // it again on any mouse activity. Always-visible when paused.
  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 2000);
  }, []);

  const handleActivity = useCallback(() => {
    setControlsVisible(true);
    if (isPlaying) scheduleHide();
  }, [isPlaying, scheduleHide]);

  useEffect(() => {
    if (!isPlaying) {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      scheduleHide();
    }
  }, [isPlaying, scheduleHide]);

  const handlePlayPause = useCallback(() => {
    playerRef.current?.togglePlay();
  }, []);

  const handleMuteToggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const next = !isMuted;
    p.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  const handleFullscreenToggle = useCallback(() => {
    playerRef.current?.toggleFullscreen();
  }, []);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const p = playerRef.current;
      if (!p || !duration) return;
      const newTime = (parseFloat(e.target.value) / 100) * duration;
      if (Number.isFinite(newTime)) p.seek(newTime);
      setCurrentTime(newTime);
    },
    [duration]
  );

  if (fatalError) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio,
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

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleActivity}
      onMouseEnter={handleActivity}
      onMouseLeave={() => isPlaying && setControlsVisible(false)}
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
        playsInline
        onClick={handlePlayPause}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "contain",
          cursor: "pointer",
        }}
      />

      {/* Shimmer overlay while the SDK loads (lazy hls.js import + first
          HLS segment download). Same animation as the pre-metadata skeleton
          on the parent, so the click-through feels like a continuous state. */}
      {!isReady && !fatalError && (
        <ThreeSpeakSkeleton aspectRatio={aspectRatio} overlay />
      )}

      {/* Bottom control bar — fades in/out with controlsVisible */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "32px 12px 12px",
          background:
            "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0) 100%)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "#fff",
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 12,
          opacity: controlsVisible ? 1 : 0,
          transition: "opacity 0.2s ease",
          pointerEvents: controlsVisible ? "auto" : "none",
        }}
      >
        <IconButton
          aria-label={isPlaying ? "Pause" : "Play"}
          onClick={handlePlayPause}
        >
          {isPlaying ? <LuPause size={20} /> : <LuPlay size={20} />}
        </IconButton>

        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            opacity: 0.92,
          }}
        >
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={Number.isFinite(progress) ? progress : 0}
          onChange={handleSeek}
          aria-label="Seek"
          style={{
            flex: 1,
            height: 4,
            WebkitAppearance: "none",
            appearance: "none",
            background: `linear-gradient(to right, ${PRIMARY} 0%, ${PRIMARY} ${progress}%, rgba(255,255,255,0.25) ${progress}%, rgba(255,255,255,0.25) 100%)`,
            borderRadius: 2,
            outline: "none",
            cursor: "pointer",
          }}
        />

        <IconButton
          aria-label={isMuted ? "Unmute" : "Mute"}
          onClick={handleMuteToggle}
        >
          {isMuted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
        </IconButton>

        <IconButton
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          onClick={handleFullscreenToggle}
        >
          {isFullscreen ? <FiMinimize size={18} /> : <FiMaximize size={18} />}
        </IconButton>
      </div>

      <style jsx>{`
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${PRIMARY};
          border: 2px solid #000;
          cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: ${PRIMARY};
          border: 2px solid #000;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

/**
 * Small icon-button wrapper. Default white, limegreen on hover/focus — matches
 * the rest of the player's accent. Avoids pulling in a UI lib for what's
 * essentially a styled <button>.
 */
function IconButton({
  children,
  onClick,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "transparent",
        border: 0,
        padding: 4,
        color: hover ? PRIMARY : "#fff",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "color 0.15s ease",
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
