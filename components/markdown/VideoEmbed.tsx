"use client";

import React, { useEffect, useState } from "react";
import VideoRenderer from "@/components/layout/VideoRenderer";
import { APP_CONFIG } from "@/config/app.config";
import { useStopFlipbookEvents } from "@/hooks/useStopFlipbookEvents";

interface VideoEmbedProps {
  type: "VIDEO" | "ODYSEE" | "YOUTUBE" | "VIMEO";
  id: string;
  index: number;
}

// Shared ribbon style for "this came from a third-party platform". Same
// position/style across YouTube/Odysee/Vimeo so it reads as a consistent
// rule: top-right chip = external provenance.
const PROVENANCE_RIBBON_STYLE: React.CSSProperties = {
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
};

function YouTubeLite({ id: rawId }: { id: string }) {
  // The markdown layer prefixes Shorts with "s:" so we can pick the right
  // aspect without inventing a new placeholder type. See MarkdownRenderer.
  const isShort = rawId.startsWith("s:");
  const id = isShort ? rawId.slice(2) : rawId;
  const aspectRatio = isShort ? "9 / 16" : "16 / 9";

  const [active, setActive] = useState(false);
  const [posterSrc, setPosterSrc] = useState(
    `https://img.youtube.com/vi/${id}/maxresdefault.jpg`
  );
  const buttonRef = useStopFlipbookEvents<HTMLButtonElement>();
  const iframeWrapperRef = useStopFlipbookEvents<HTMLDivElement>();

  if (active) {
    return (
      <div ref={iframeWrapperRef}>
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          style={{ width: "100%", aspectRatio, border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setActive(true)}
      aria-label="Play video"
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
      <img
        className="embed-poster"
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
      <span aria-hidden style={PROVENANCE_RIBBON_STYLE}>
        {isShort ? "YouTube Shorts" : "YouTube"}
      </span>
    </button>
  );
}

/**
 * Parse an Odysee embed URL into the `name#claim_id` form the resolve API
 * accepts. The embed URL has two known shapes:
 *
 *   regular:  https://odysee.com/$/embed/@channel:N/video-name:CLAIM_ID?…
 *   shorts:   https://odysee.com/%24/embed/%40channel%3AN%2Fvideo%3A5?…
 *             (everything past the host is percent-encoded — including the
 *              dollar sign and the slash between channel and video)
 *
 * The first thing we do is decode the whole pathname so both shapes split
 * the same way. Then we take the LAST segment (the video, not the channel)
 * and swap `:` for `#` to form a valid LBRY ref.
 */
function parseOdyseeRef(url: string): string | null {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname);
    const after = path.replace(/^\/\$\/embed\//, "");
    const segments = after.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || !last.includes(":")) return null;
    const colon = last.lastIndexOf(":");
    return `${last.slice(0, colon)}#${last.slice(colon + 1)}`;
  } catch {
    return null;
  }
}

type OdyseeData = {
  thumbnail: string | null;
  /** CSS aspect-ratio ("W / H") — derived from value.video.{width,height}
   *  in the resolve response (per OdyseeTeam/odysee-frontend conventions).
   *  This is faster and more reliable than measuring the thumbnail image
   *  and is the *only* way to detect shorts since the embed URL doesn't
   *  carry any aspect signal. Falls through to 16/9 on missing data. */
  aspectRatio: string;
  /** Video title from resolve metadata — kept for future use (hover hint,
   *  aria-label richness, fallback for blocked iframes). */
  title: string | null;
};

// Per-page-load cache. The resolve API returns the same answer for the
// lifetime of a claim, so one fetch per unique video is enough — a magazine
// page with the same Odysee link twice only hits the API once.
const odyseeDataCache = new Map<string, Promise<OdyseeData | null>>();

function fetchOdyseeData(url: string): Promise<OdyseeData | null> {
  const ref = parseOdyseeRef(url);
  if (!ref) return Promise.resolve(null);
  const cached = odyseeDataCache.get(ref);
  if (cached) return cached;
  const promise = (async (): Promise<OdyseeData | null> => {
    let thumbnail: string | null = null;
    let title: string | null = null;
    let aspectRatio = "16 / 9";
    try {
      const res = await fetch(
        "https://api.na-backend.odysee.com/api/v1/proxy",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "resolve",
            params: { urls: [ref] },
          }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const entry = Object.values(data?.result ?? {})[0] as
          | {
              value?: {
                thumbnail?: { url?: string };
                title?: string;
                video?: { width?: number; height?: number };
              };
            }
          | undefined;
        thumbnail = entry?.value?.thumbnail?.url ?? null;
        title = entry?.value?.title ?? null;
        const w = entry?.value?.video?.width;
        const h = entry?.value?.video?.height;
        if (w && h) aspectRatio = `${w} / ${h}`;
      }
    } catch {
      // network/CORS/parse — fall through with null thumbnail
    }
    // Last-resort: scrape og:image via our server-side route. Only fires
    // when resolve returned no thumbnail (rate-limit, downtime, weird
    // claim metadata). Same edge route caches per URL for 24h.
    if (!thumbnail && typeof window !== "undefined") {
      try {
        const fb = await fetch(
          `/api/odysee-thumbnail?url=${encodeURIComponent(url)}`
        );
        if (fb.ok) {
          const j = await fb.json();
          if (typeof j?.thumbnail === "string") thumbnail = j.thumbnail;
        }
      } catch {
        // give up — caller will render without a poster
      }
    }
    return { thumbnail, aspectRatio, title };
  })();
  odyseeDataCache.set(ref, promise);
  return promise;
}

function OdyseeLite({ url }: { url: string }) {
  const [active, setActive] = useState(false);
  const [data, setData] = useState<OdyseeData | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const buttonRef = useStopFlipbookEvents<HTMLButtonElement>();
  const iframeWrapperRef = useStopFlipbookEvents<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setThumbnailFailed(false);
    fetchOdyseeData(url).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Default to 16/9 until measurement resolves; switches to the real
  // ratio (e.g. 9/16 for shorts) once the thumbnail is measured.
  const aspectRatio = data?.aspectRatio ?? "16 / 9";

  if (active) {
    return (
      <div ref={iframeWrapperRef}>
        <iframe
          src={url}
          style={{ width: "100%", aspectRatio, border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // odycdn's image proxy serves a sized/optimized version. Passing the raw
  // thumbnail URL works too, but the proxy is what Odysee itself uses in
  // og:image — same path the native iframe ends up loading.
  const posterSrc =
    data?.thumbnail && !thumbnailFailed
      ? `https://thumbnails.odycdn.com/card/s:1280:720/quality:85/plain/${data.thumbnail}`
      : null;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setActive(true)}
      aria-label="Play Odysee video"
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
      {posterSrc && (
        <img
          className="embed-poster"
          src={posterSrc}
          alt=""
          loading="lazy"
          onError={() => setThumbnailFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
      {/* Odysee-red play badge */}
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
          <circle cx="38" cy="38" r="36" fill="rgba(229, 80, 57, 0.92)" />
          <path d="M30 24 L54 38 L30 52 Z" fill="#fff" />
        </svg>
      </span>
      {/* While resolve API hasn't returned yet, lay a subtle shimmer over
          the (still-empty) poster. Once data resolves the <img> appears on
          top of this and the shimmer is no longer visible. The @keyframes
          rule lives inside ThreeSpeakPlayer too but we redeclare it here
          (same name, same body) so Odysee-only pages still animate. */}
      {!data && (
        <>
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)",
              backgroundSize: "200% 100%",
              animation:
                "skatehive-skeleton-shimmer 1.4s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
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
      )}
      <span aria-hidden style={PROVENANCE_RIBBON_STYLE}>
        Odysee
      </span>
    </button>
  );
}

type VimeoData = {
  thumbnail: string | null;
  /** Computed from thumbnail_width / thumbnail_height in the oEmbed response.
   *  Vimeo's thumbnail ratios mirror the video itself. */
  aspectRatio: string;
  title: string | null;
};

const vimeoDataCache = new Map<string, Promise<VimeoData | null>>();

function fetchVimeoData(id: string): Promise<VimeoData | null> {
  const cached = vimeoDataCache.get(id);
  if (cached) return cached;
  const promise = (async (): Promise<VimeoData | null> => {
    try {
      const canonical = `https://vimeo.com/${id}`;
      const res = await fetch(
        `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(canonical)}`
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        thumbnail_url?: string;
        thumbnail_width?: number;
        thumbnail_height?: number;
        title?: string;
      };
      const w = data.thumbnail_width;
      const h = data.thumbnail_height;
      return {
        thumbnail: data.thumbnail_url ?? null,
        aspectRatio: w && h ? `${w} / ${h}` : "16 / 9",
        title: data.title ?? null,
      };
    } catch {
      return null;
    }
  })();
  vimeoDataCache.set(id, promise);
  return promise;
}

function VimeoLite({ id }: { id: string }) {
  const [active, setActive] = useState(false);
  const [data, setData] = useState<VimeoData | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const buttonRef = useStopFlipbookEvents<HTMLButtonElement>();
  const iframeWrapperRef = useStopFlipbookEvents<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setThumbnailFailed(false);
    fetchVimeoData(id).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const aspectRatio = data?.aspectRatio ?? "16 / 9";

  if (active) {
    return (
      <div ref={iframeWrapperRef}>
        <iframe
          src={`https://player.vimeo.com/video/${id}?autoplay=1`}
          style={{ width: "100%", aspectRatio, border: 0 }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const posterSrc = data?.thumbnail && !thumbnailFailed ? data.thumbnail : null;

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setActive(true)}
      aria-label={data?.title ? `Play ${data.title}` : "Play Vimeo video"}
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
      {posterSrc && (
        <img
          className="embed-poster"
          src={posterSrc}
          alt=""
          loading="lazy"
          onError={() => setThumbnailFailed(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
      {/* Vimeo-cyan play badge */}
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
          <circle cx="38" cy="38" r="36" fill="rgba(26, 183, 234, 0.92)" />
          <path d="M30 24 L54 38 L30 52 Z" fill="#fff" />
        </svg>
      </span>
      {!data && (
        <>
          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(90deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)",
              backgroundSize: "200% 100%",
              animation:
                "skatehive-skeleton-shimmer 1.4s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
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
      )}
      <span aria-hidden style={PROVENANCE_RIBBON_STYLE}>
        Vimeo
      </span>
    </button>
  );
}

/**
 * Fallback IPFS gateways. When the primary `APP_CONFIG.IPFS_GATEWAY`
 * times out or 5xxs, VideoRenderer races these in parallel before giving up.
 * Order is most-likely-to-work first (used as tie-breaker if the race times out).
 *
 * Note on caching: the primary gateway (ipfs.skatehive.app) is a Pinata dedicated
 * gateway served through Cloudflare. As of 2026 it already returns
 *   cache-control: public, max-age=29030400
 *   accept-ranges: bytes
 *   access-control-allow-origin: *
 * with cf-cache-status HIT on the edge — so no extra cache configuration is
 * needed on our side. Verified via `curl -I` against a live CID.
 */
const IPFS_FALLBACK_GATEWAYS = [
  "ipfs.skatehive.app",
  "gateway.pinata.cloud",
  "cloudflare-ipfs.com",
  "ipfs.io",
];

function buildIpfsUrls(hash: string): { primary: string; fallbacks: string[] } {
  const primaryGw = APP_CONFIG.IPFS_GATEWAY;
  const primary = `https://${primaryGw}/ipfs/${hash}`;
  const fallbacks = IPFS_FALLBACK_GATEWAYS
    .filter((gw) => gw !== primaryGw)
    .map((gw) => `https://${gw}/ipfs/${hash}`);
  return { primary, fallbacks };
}

export function VideoEmbed({ type, id, index }: VideoEmbedProps) {
  switch (type) {
    case "VIDEO": {
      const { primary, fallbacks } = buildIpfsUrls(id);
      return (
        <VideoRenderer
          key={`video-${id}-${index}`}
          src={primary}
          fallbackSrcs={fallbacks}
        />
      );
    }

    case "ODYSEE":
      return <OdyseeLite key={`odysee-${id}-${index}`} url={id} />;

    case "YOUTUBE":
      return <YouTubeLite key={`youtube-${id}-${index}`} id={id} />;

    case "VIMEO":
      return <VimeoLite key={`vimeo-${id}-${index}`} id={id} />;

    default:
      return null;
  }
}
