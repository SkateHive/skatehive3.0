import { getImageUrls } from "@/lib/hive/metadata-utils";

export interface ExtractedMedia {
  previewUrl: string | null;
  inlineImageUrl: string | null;
  iframeEmbedType: string | null;
  videoSourceUrl: string | null;
}

export interface VoteValue {
  amount: number;
  currency: string;
}

/**
 * Extract media (images, video thumbnails) from post body HTML/Markdown
 */
export function extractMediaFromBody(body: string): ExtractedMedia {
  const iframeMatch = body.match(/<iframe[^>]*src=["']([^"']+)["'][^>]*>/i);
  const videoPosterMatch = body.match(
    /<video[^>]*poster=["']([^"']+)["'][^>]*>/i
  );
  const inlineImageMatch = body.match(
    /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)|<img[^>]*src=["']([^"']+)["']/i
  );
  
  // Try to find direct video source URLs
  const videoSrcMatch = body.match(
    /<video[^>]*>[\s\S]*?<source[^>]*src=["']([^"']+)["'][^>]*>|<video[^>]*src=["']([^"']+)["'][^>]*>/i
  );

  let previewUrl: string | null = null;
  let iframeEmbedType: string | null = null;
  let videoSourceUrl: string | null = null;

  // Extract video source URL
  if (videoSrcMatch) {
    videoSourceUrl = videoSrcMatch[1] || videoSrcMatch[2] || null;
  }

  if (videoPosterMatch && videoPosterMatch[1]) {
    previewUrl = videoPosterMatch[1];
  } else if (iframeMatch && iframeMatch[1]) {
    const iframeSrc = iframeMatch[1];

    // YouTube embed patterns
    const youtubeEmbedMatch = iframeSrc.match(
      /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:[^\s]*&)?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    const vimeoMatch = iframeSrc.match(/vimeo\.com\/(?:video\/)?(\d+)/);

    // 3Speak embed pattern - extract video ID for thumbnail
    const threespeakMatch = iframeSrc.match(
      /3speak\.(?:tv|co|online)\/embed\?v=([a-zA-Z0-9._-]+\/[a-zA-Z0-9_-]+)/i
    );

    // Odysee/LBRY embed pattern
    const odyseeMatch = iframeSrc.match(
      /odysee\.com\/\$\/embed\/([^/]+)\/([a-f0-9]+)/i
    );

    if (youtubeEmbedMatch && youtubeEmbedMatch[1]) {
      previewUrl = `https://img.youtube.com/vi/${youtubeEmbedMatch[1]}/mqdefault.jpg`;
    } else if (vimeoMatch && vimeoMatch[1]) {
      previewUrl = `https://vumbnail.com/${vimeoMatch[1]}.jpg`;
    } else if (threespeakMatch && threespeakMatch[1]) {
      // 3Speak thumbnail URL format
      const [author, permlink] = threespeakMatch[1].split("/");
      if (author && permlink) {
        previewUrl = `https://img.3speakcontent.co/${author}/${permlink}/thumbnail.png`;
      }
      iframeEmbedType = "3speak";
    } else if (odyseeMatch) {
      // Odysee uses a different thumbnail format
      iframeEmbedType = "odysee";
    } else if (
      iframeSrc.includes("ipfs") ||
      iframeSrc.includes("3speak") ||
      iframeSrc.includes("skatehive")
    ) {
      // IPFS video embed - store the source URL for potential video preview
      iframeEmbedType = "ipfs";
      videoSourceUrl = iframeSrc;
    }
  }

  return {
    previewUrl,
    inlineImageUrl: inlineImageMatch
      ? inlineImageMatch[1] || inlineImageMatch[2] || null
      : null,
    iframeEmbedType,
    videoSourceUrl,
  };
}

/**
 * Extract thumbnail from post metadata with video-specific fallbacks
 * Priority order: image > thumbnail > video.thumbnail > threespeak thumbnail > links
 * 
 * Supports various Hive app metadata formats:
 * - Standard: image, images, thumbnail
 * - 3Speak: video.info.snaphash, threespeak.thumbnail
 * - PeakD/Ecency: image array, thumbnail array
 * - Skatehive/mycommunity: links array, media object
 */
export function extractThumbnailFromMetadata(
  metadata: Record<string, unknown>,
  enableLogging = false
): string | null {
  if (enableLogging) {
    console.log("[notifications] Full metadata:", JSON.stringify(metadata, null, 2));
  }

  // Check for standard image fields first
  const imageUrls = getImageUrls(metadata);
  if (imageUrls.length > 0) {
    if (enableLogging) console.log("[notifications] Found image in standard fields:", imageUrls[0]);
    return imageUrls[0];
  }

  // Check for thumbnail field (can be string or array)
  if (metadata.thumbnail) {
    if (typeof metadata.thumbnail === "string" && metadata.thumbnail.trim()) {
      if (enableLogging) console.log("[notifications] Found thumbnail string:", metadata.thumbnail);
      return metadata.thumbnail.trim();
    }
    if (Array.isArray(metadata.thumbnail)) {
      const firstThumb = metadata.thumbnail.find(
        (t: unknown) => typeof t === "string" && (t as string).trim().length > 0
      );
      if (firstThumb) {
        if (enableLogging) console.log("[notifications] Found thumbnail array item:", firstThumb);
        return (firstThumb as string).trim();
      }
    }
  }

  // Check for video object with thumbnail
  if (metadata.video && typeof metadata.video === "object") {
    const video = metadata.video as Record<string, unknown>;
    if (video.thumbnail && typeof video.thumbnail === "string") {
      if (enableLogging) console.log("[notifications] Found video.thumbnail:", video.thumbnail);
      return video.thumbnail.trim();
    }
    // 3Speak video metadata structure
    if (video.info && typeof video.info === "object") {
      const info = video.info as Record<string, unknown>;
      if (info.snaphash && typeof info.snaphash === "string") {
        const thumb = `https://threespeakvideo.b-cdn.net/${info.snaphash}/thumbnail.png`;
        if (enableLogging) console.log("[notifications] Found 3speak snaphash thumbnail:", thumb);
        return thumb;
      }
      if (info.thumbnail && typeof info.thumbnail === "string") {
        if (enableLogging) console.log("[notifications] Found video.info.thumbnail:", info.thumbnail);
        return info.thumbnail.trim();
      }
    }
  }

  // Check for threespeak-specific metadata
  if (metadata.threespeak && typeof metadata.threespeak === "object") {
    const ts = metadata.threespeak as Record<string, unknown>;
    if (ts.thumbnail && typeof ts.thumbnail === "string") {
      if (enableLogging) console.log("[notifications] Found threespeak.thumbnail:", ts.thumbnail);
      return ts.thumbnail.trim();
    }
  }

  // Check for app-specific video thumbnails
  if (metadata.videoThumbnail && typeof metadata.videoThumbnail === "string") {
    if (enableLogging) console.log("[notifications] Found videoThumbnail:", metadata.videoThumbnail);
    return metadata.videoThumbnail.trim();
  }

  // Check for links array (used by some apps like mycommunity-mobile)
  if (metadata.links && Array.isArray(metadata.links)) {
    const imageLink = metadata.links.find((link: unknown) => {
      if (typeof link !== "string") return false;
      const lower = link.toLowerCase();
      return (
        lower.includes(".jpg") ||
        lower.includes(".jpeg") ||
        lower.includes(".png") ||
        lower.includes(".gif") ||
        lower.includes(".webp")
      );
    });
    if (imageLink) {
      if (enableLogging) console.log("[notifications] Found image in links array:", imageLink);
      return imageLink as string;
    }
  }

  // Check for media object (some apps use this)
  if (metadata.media && typeof metadata.media === "object") {
    const media = metadata.media as Record<string, unknown>;
    if (media.thumbnail && typeof media.thumbnail === "string") {
      if (enableLogging) console.log("[notifications] Found media.thumbnail:", media.thumbnail);
      return media.thumbnail.trim();
    }
    if (media.image && typeof media.image === "string") {
      if (enableLogging) console.log("[notifications] Found media.image:", media.image);
      return media.image.trim();
    }
  }

  // Check for poster (video poster image)
  if (metadata.poster && typeof metadata.poster === "string") {
    if (enableLogging) console.log("[notifications] Found poster:", metadata.poster);
    return metadata.poster.trim();
  }

  // Check for cover image
  if (metadata.cover && typeof metadata.cover === "string") {
    if (enableLogging) console.log("[notifications] Found cover:", metadata.cover);
    return metadata.cover.trim();
  }

  if (enableLogging) console.log("[notifications] No thumbnail found in metadata");
  return null;
}

/**
 * Sanitize notification body content by removing iframes and excess newlines
 */
export function sanitizeNotificationBody(
  content: string,
  keepMedia = false
): string {
  if (keepMedia) {
    return content.replace(/\n{3,}/g, "\n\n").trim();
  }
  const withoutIframe = content.replace(
    /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
    ""
  );
  return withoutIframe.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Format notification date for display
 */
export function formatNotificationDate(dateString: string): string {
  return new Date(dateString + "Z").toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Check if notification is new (unread)
 */
export function isNotificationNew(
  notificationDate: string,
  lastReadDate: string
): boolean {
  const notificationDateStr = notificationDate.endsWith("Z")
    ? notificationDate
    : `${notificationDate}Z`;
  const notifDate = new Date(notificationDateStr);
  const lastRead = new Date(lastReadDate);
  return notifDate > lastRead;
}

/**
 * Extract author from notification message
 */
export function extractAuthorFromMessage(msg: string): string {
  return msg.trim().replace(/^@/, "").split(" ")[0];
}

/**
 * Extract vote percentage from notification message
 */
export function extractVotePercentage(msg: string): string {
  const match = msg.match(/\(([^)]+)\)/);
  return match && match[1] ? `(${match[1]})` : "";
}

/**
 * Extract a monetary value from a vote notification message
 */
export function extractVoteValue(msg: string): VoteValue | null {
  const dollarMatch = msg.match(/\$([0-9.,]+)/);
  if (dollarMatch && dollarMatch[1]) {
    const amount = parseFloat(dollarMatch[1].replace(/,/g, ""));
    if (!Number.isNaN(amount)) {
      return { amount, currency: "$" };
    }
  }

  const tokenMatch = msg.match(/([0-9.,]+)\s*(HBD|HIVE)/i);
  if (tokenMatch && tokenMatch[1] && tokenMatch[2]) {
    const amount = parseFloat(tokenMatch[1].replace(/,/g, ""));
    if (!Number.isNaN(amount)) {
      return { amount, currency: tokenMatch[2].toUpperCase() };
    }
  }

  return null;
}
