const YOUTUBE_ID = /^[a-zA-Z0-9_-]{11}$/;

function youtubeHost(hostname: string): string {
  return hostname.replace(/^www\./i, "").replace(/^m\./i, "").toLowerCase();
}

/**
 * Pull a YouTube video id out of a watch, embed, shorts, or youtu.be URL.
 * Snap bodies store these as iframe srcs; they are HTML pages, not media files.
 */
export function getYouTubeVideoId(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl);
    const host = youtubeHost(url.hostname);
    let videoId: string | null = null;

    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] || null;
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (url.pathname === "/watch") {
        videoId = url.searchParams.get("v");
      } else {
        const match = url.pathname.match(/^\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
        videoId = match?.[1] || null;
      }
    }

    if (!videoId || !YOUTUBE_ID.test(videoId)) return null;
    return videoId;
  } catch {
    return null;
  }
}

export function isYouTubeUrl(rawUrl: string | null | undefined): boolean {
  return getYouTubeVideoId(rawUrl) !== null;
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1`;
}

export function youtubePosterUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
