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

function YouTubeLite({ id }: { id: string }) {
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
          style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
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

/**
 * Parse an Odysee embed URL into the `name#claim_id` form the resolve API
 * accepts. The embed URL looks like:
 *   https://odysee.com/$/embed/@channel:N/video-name:CLAIM_ID?query
 *   https://odysee.com/$/embed/video-name:CLAIM_ID          (no channel)
 * We only care about the *last* path segment (the video itself, not the
 * channel), URI-decoded, with the colon swapped for a hash.
 */
function parseOdyseeRef(url: string): string | null {
  try {
    const u = new URL(url);
    const after = u.pathname.replace(/^\/\$\/embed\//, "");
    const segments = after.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (!last || !last.includes(":")) return null;
    const decoded = decodeURIComponent(last);
    const colon = decoded.lastIndexOf(":");
    return `${decoded.slice(0, colon)}#${decoded.slice(colon + 1)}`;
  } catch {
    return null;
  }
}

// Per-page-load cache of resolved Odysee thumbnails. The resolve API
// returns the same answer for the lifetime of a claim, so one fetch per
// unique video is enough — a magazine page with the same Odysee link
// twice only hits the API once.
const odyseeThumbnailCache = new Map<string, Promise<string | null>>();

function fetchOdyseeThumbnail(url: string): Promise<string | null> {
  const ref = parseOdyseeRef(url);
  if (!ref) return Promise.resolve(null);
  const cached = odyseeThumbnailCache.get(ref);
  if (cached) return cached;
  const promise = fetch("https://api.na-backend.odysee.com/api/v1/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "resolve",
      params: { urls: [ref] },
    }),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const results = data?.result;
      if (!results) return null;
      const entry = Object.values(results)[0] as
        | { value?: { thumbnail?: { url?: string } } }
        | undefined;
      return entry?.value?.thumbnail?.url ?? null;
    })
    .catch(() => null);
  odyseeThumbnailCache.set(ref, promise);
  return promise;
}

function OdyseeLite({ url }: { url: string }) {
  const [active, setActive] = useState(false);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const buttonRef = useStopFlipbookEvents<HTMLButtonElement>();
  const iframeWrapperRef = useStopFlipbookEvents<HTMLDivElement>();

  useEffect(() => {
    let cancelled = false;
    setThumbnail(null);
    setThumbnailFailed(false);
    fetchOdyseeThumbnail(url).then((thumb) => {
      if (!cancelled) setThumbnail(thumb);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (active) {
    return (
      <div ref={iframeWrapperRef}>
        <iframe
          src={url}
          style={{ width: "100%", aspectRatio: "16 / 9", border: 0 }}
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
    thumbnail && !thumbnailFailed
      ? `https://thumbnails.odycdn.com/card/s:1280:720/quality:85/plain/${thumbnail}`
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
        aspectRatio: "16 / 9",
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
      {/* Provenance ribbon — visible affordance that this is Odysee content */}
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
        Odysee
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
