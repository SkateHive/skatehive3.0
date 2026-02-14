import PostPage from "@/components/blog/PostPage";
import HiveClient from "@/lib/hive/hiveclient";
import { cleanUsername } from "@/lib/utils/cleanUsername";
import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";

// Constants
const DOMAIN_URL = APP_CONFIG.BASE_URL;
const FALLBACK_IMAGE = `${APP_CONFIG.BASE_URL}/ogimage.png`;

// Function to safely parse JSON metadata that might be double-encoded
function parseJsonMetadata(
  jsonMetadata: any,
): { image?: string[]; images?: string[]; thumbnail?: string[] } | null {
  if (!jsonMetadata) return null;

  try {
    let parsed = jsonMetadata;

    // If it's a string, try to parse it
    if (typeof jsonMetadata === "string") {
      parsed = JSON.parse(jsonMetadata);
    }

    // If the result is still a string (double-encoded), parse again
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    // Return the parsed object if it has the expected structure
    if (parsed && typeof parsed === "object") {
      return {
        image: Array.isArray(parsed.image) ? parsed.image : undefined,
        images: Array.isArray(parsed.images) ? parsed.images : undefined,
        thumbnail: Array.isArray(parsed.thumbnail)
          ? parsed.thumbnail
          : undefined,
      };
    }
  } catch (error) {
    console.warn("Failed to parse json_metadata:", error);
  }

  return null;
}

// Function to clean markdown and HTML syntax from text
function cleanTextForDescription(text: string): string {
  if (!text) return "";

  let cleaned = text;

  // Remove HTML tags
  cleaned = cleaned.replace(/<[^>]*>/g, "");

  // Remove markdown syntax
  cleaned = cleaned
    // Remove headers (# ## ### etc.)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold/italic (**text** *text* __text__ _text_)
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    // Remove strikethrough (~~text~~)
    .replace(/~~([^~]+)~~/g, "$1")
    // Remove inline code (`code`)
    .replace(/`([^`]+)`/g, "$1")
    // Remove code blocks (```code```)
    .replace(/```[\s\S]*?```/g, "")
    // Remove images ![alt](url)
    .replace(/!\[.*?\]\([^)]*\)/g, "")
    // Remove links [text](url) but keep the text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // Remove reference-style links [text][ref]
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1")
    // Remove horizontal rules (--- or ***)
    .replace(/^[-*]{3,}$/gm, "")
    // Remove blockquotes (> text)
    .replace(/^>\s*/gm, "")
    // Remove list markers (- * + 1.)
    .replace(/^[\s]*[-*+]\s+/gm, "")
    .replace(/^[\s]*\d+\.\s+/gm, "")
    // Remove extra whitespace and newlines
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned;
}

// Video URL extraction for VideoObject schema
const IPFS_GATEWAYS = [
  "ipfs.skatehive.app",
  "gateway.pinata.cloud",
  "ipfs.io",
  "cloudflare-ipfs.com",
];

const VIDEO_CONTENT_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];

/**
 * HEAD-request an IPFS URL to check if it's actually a video.
 * Pinata IPFS links have no file extension, so Content-Type is the
 * only reliable signal. Returns the URL if it's a video, null otherwise.
 */
async function probeIpfsContentType(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      next: { revalidate: 3600 },
    });
    clearTimeout(timeout);
    const ct = res.headers.get("content-type") || "";
    if (VIDEO_CONTENT_TYPES.some((t) => ct.startsWith(t))) {
      return url;
    }
  } catch {
    // Timeout or network error — skip this URL
  }
  return null;
}

/**
 * Find the first video URL in a post body.
 * For URLs with clear extensions or known platforms (YouTube, 3Speak)
 * we return immediately. For extensionless IPFS URLs we do a HEAD
 * request to check Content-Type.
 */
async function extractFirstVideoUrl(body: string): Promise<string | null> {
  if (!body) return null;

  // 1. Direct video links with extension: ![desc](url.mp4)
  const mdVideo = body.match(
    /!\[.*?\]\((https?:\/\/[^\s)]+?\.(mp4|webm|mov))\)/i,
  );
  if (mdVideo) return mdVideo[1];

  // 2. iframe src with IPFS and extension
  const iframeExtMatch = body.match(
    /<iframe[^>]*src=["'](https?:\/\/[^"']+\.(mp4|webm|mov))["'][^>]*>/i,
  );
  if (iframeExtMatch) return iframeExtMatch[1];

  // 3. YouTube (always video)
  const ytMatch = body.match(
    /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  if (ytMatch) return `https://www.youtube.com/watch?v=${ytMatch[1]}`;

  // 4. 3Speak (always video)
  const threeSpeakMatch = body.match(
    /https?:\/\/3speak\.tv\/watch\?v=([\w\-/]+)/,
  );
  if (threeSpeakMatch)
    return `https://3speak.tv/watch?v=${threeSpeakMatch[1]}`;

  // 5. Extensionless IPFS links — need HEAD request to verify content type
  //    Collect candidate URLs, probe at most 3 to keep latency low
  const ipfsCandidates: string[] = [];
  for (const gw of IPFS_GATEWAYS) {
    const escaped = gw.replace(/\./g, "\\.");
    // Markdown image links
    const mdPattern = new RegExp(
      `!\\[.*?\\]\\((https://${escaped}/ipfs/[\\w-]+)\\)`,
      "gi",
    );
    let m;
    while ((m = mdPattern.exec(body)) !== null) {
      // Skip if URL has an image extension (it's a photo, not a video)
      if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(m[1])) continue;
      // Skip if already has a video extension (handled in step 1)
      if (/\.(mp4|webm|mov)$/i.test(m[1])) continue;
      ipfsCandidates.push(m[1]);
    }
    // iframe links
    const iframePattern = new RegExp(
      `<iframe[^>]*src=["'](https://${escaped}/ipfs/[\\w-]+)["']`,
      "gi",
    );
    while ((m = iframePattern.exec(body)) !== null) {
      if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(m[1])) continue;
      ipfsCandidates.push(m[1]);
    }
  }

  // Probe up to 3 candidates in parallel
  const toProbe = ipfsCandidates.slice(0, 3);
  if (toProbe.length > 0) {
    const results = await Promise.all(toProbe.map(probeIpfsContentType));
    const found = results.find((r) => r !== null);
    if (found) return found;
  }

  return null;
}

function isIpfsVideoUrl(url: string): boolean {
  return IPFS_GATEWAYS.some((gw) => url.includes(gw));
}

// Check for object permlinks only
function validatePermlink(permlink: any, source: string) {
  if (
    typeof permlink === "object" ||
    (typeof permlink === "string" && permlink.includes("[object"))
  ) {
    console.error(`🚨 OBJECT PERMLINK in ${source}:`, {
      permlink,
      type: typeof permlink,
      stack: new Error().stack?.split("\n").slice(2, 5).join("\n"),
    });
    throw new Error(`Invalid permlink: ${String(permlink)}`);
  }
}

async function getData(user: string, permlink: string) {
  validatePermlink(permlink, "getData");
  try {
    const cleanUser = user.startsWith("@") ? user.slice(1) : user;
    const postContent = await HiveClient.database.call("get_content", [
      cleanUser,
      permlink,
    ]);

    if (!postContent || !postContent.author) {
      throw new Error("Post not found");
    }

    return postContent;
  } catch (error) {
    console.error("Failed to fetch post content:", error);

    // Log the detailed error information for debugging
    if (error && typeof error === "object") {
      const errorObj = error as any;
      console.error("Error details:", {
        message: errorObj.message,
        jse_shortmsg: errorObj.jse_shortmsg,
        jse_info: errorObj.jse_info,
      });
    }

    throw new Error("Failed to fetch post content");
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ author: string; permlink: string }>;
}): Promise<Metadata> {
  const { author, permlink } = await params;

  validatePermlink(permlink, "generateMetadata");

  // Quick validation to catch object permlinks
  if (typeof permlink !== "string") {
    console.error("generateMetadata: permlink is not a string:", {
      author,
      permlink,
    });
    return {
      title: "Post | Skatehive",
      description: "View this post on Skatehive.",
    };
  }

  try {
    const decodedAuthor = decodeURIComponent(author);
    const post = await getData(decodedAuthor, permlink);
    const cleanedAuthor = cleanUsername(post.author);
    const title = post.title || "Skatehive Snap";

    // Clean the post body of markdown and HTML syntax before creating description
    const cleanedBody = cleanTextForDescription(post.body || "");
    const description = cleanedBody
      ? `${cleanedBody.slice(0, 128)}...`
      : "No description available";

    // Extract images from markdown using regex (similar to old approach)
    const images = post.body ? post.body.match(/!\[.*?\]\((.*?)\)/g) : [];
    const imageUrls = images
      ? images.map((img: string) => {
          const match = img.match(/\((.*?)\)/);
          return match ? match[1] : "";
        })
      : [];

    // Parse JSON metadata for additional images
    const parsedMetadata = parseJsonMetadata(post.json_metadata);

    // Get banner image with priority: json_metadata.thumbnail, json_metadata.image, markdown images, fallback
    let bannerImage = FALLBACK_IMAGE;
    if (parsedMetadata?.thumbnail && parsedMetadata.thumbnail[0]) {
      bannerImage = parsedMetadata.thumbnail[0];
    } else if (parsedMetadata?.image && parsedMetadata.image[0]) {
      bannerImage = parsedMetadata.image[0];
    } else if (parsedMetadata?.images && parsedMetadata.images[0]) {
      bannerImage = parsedMetadata.images[0];
    } else if (imageUrls[0]) {
      bannerImage = imageUrls[0];
    }

    const postUrl = `${DOMAIN_URL}/post/${cleanedAuthor}/${permlink}`;
    const ogImage = `${DOMAIN_URL}/api/og/post/${cleanedAuthor}/${permlink}`;

    return {
      title: title,
      description: description,
      authors: [{ name: cleanedAuthor }],
      applicationName: "Skatehive",
      alternates: {
        canonical: postUrl,
      },
      openGraph: {
        title: title,
        description: description,
        url: postUrl,
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
          },
        ],
        siteName: "Skatehive",
        type: "article",
        publishedTime: post.created
          ? new Date(post.created + "Z").toISOString()
          : undefined,
        modifiedTime: post.last_update
          ? new Date(post.last_update + "Z").toISOString()
          : undefined,
        authors: [cleanedAuthor],
      },
      twitter: {
        card: "summary_large_image",
        title: title,
        description: description,
        images: ogImage,
        site: "@skatehive",
        creator: `@${cleanedAuthor}`,
      },
      other: {
        "fc:frame": JSON.stringify({
          version: "next",
          imageUrl: bannerImage,
          button: {
            title: "Open post",
            action: {
              type: "launch_frame",
              name: "Skatehive",
              url: postUrl,
            },
          },
          postUrl: postUrl,
        }),
        "fc:frame:image": bannerImage,
        "fc:frame:post_url": postUrl,
      },
    };
  } catch (error) {
    console.error("Error generating post metadata:", error);
    return {
      title: "Post | Skatehive",
      description: "View this post on Skatehive.",
    };
  }
}

export default async function PostPageRoute({
  params,
}: {
  params: Promise<{ author: string; permlink: string }>;
}) {
  const { author, permlink } = await params;

  validatePermlink(permlink, "PostPageRoute");

  // Log any problematic permlinks for debugging
  if (
    typeof permlink !== "string" ||
    permlink.includes("[object") ||
    permlink.includes("%5B")
  ) {
    console.error("PostPageRoute: problematic permlink detected:", {
      author,
      permlink,
      permlinkType: typeof permlink,
    });

    // Return a safe error page instead of trying to process invalid permlink
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Invalid Post URL</h1>
        <p>The post URL contains invalid parameters.</p>
      </div>
    );
  }

  const decodedAuthor = decodeURIComponent(author);
  const decodedPermlink = decodeURIComponent(permlink);
  const cleanedAuthor = cleanUsername(decodedAuthor);

  // Build JSON-LD structured data (Breadcrumb + Article + optional VideoObject)
  let breadcrumbJsonLd: Record<string, unknown> | null = null;
  let articleJsonLd: Record<string, unknown> | null = null;
  let videoJsonLd: Record<string, unknown> | null = null;
  try {
    const post = await getData(decodedAuthor, decodedPermlink);
    const cleanedBody = cleanTextForDescription(post.body || "");
    const parsedMetadata = parseJsonMetadata(post.json_metadata);
    let bannerImage = FALLBACK_IMAGE;
    if (parsedMetadata?.thumbnail?.[0])
      bannerImage = parsedMetadata.thumbnail[0];
    else if (parsedMetadata?.image?.[0]) bannerImage = parsedMetadata.image[0];
    else if (parsedMetadata?.images?.[0])
      bannerImage = parsedMetadata.images[0];

    const postUrl = `${DOMAIN_URL}/post/${cleanedAuthor}/${decodedPermlink}`;
    const publishedIso = post.created
      ? new Date(post.created + "Z").toISOString()
      : undefined;

    breadcrumbJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: DOMAIN_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Blog",
          item: `${DOMAIN_URL}/blog`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title || "Post",
          item: postUrl,
        },
      ],
    };

    articleJsonLd = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title || "Skatehive Post",
      description: cleanedBody.slice(0, 160),
      image: bannerImage,
      author: {
        "@type": "Person",
        name: cleanedAuthor,
        url: `${DOMAIN_URL}/user/${cleanedAuthor}`,
      },
      publisher: {
        "@type": "Organization",
        name: "Skatehive",
        logo: {
          "@type": "ImageObject",
          url: `${DOMAIN_URL}/SKATE_HIVE_VECTOR_FIN.svg`,
        },
      },
      url: postUrl,
      datePublished: publishedIso,
      dateModified: post.last_update
        ? new Date(post.last_update + "Z").toISOString()
        : undefined,
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": postUrl,
      },
    };

    // Build VideoObject schema if the post contains a video
    const videoUrl = await extractFirstVideoUrl(post.body || "");
    if (videoUrl) {
      videoJsonLd = {
        "@context": "https://schema.org",
        "@type": "VideoObject",
        name: post.title || "Skatehive Video",
        description: cleanedBody.slice(0, 160) || "Skateboarding video on Skatehive",
        thumbnailUrl: bannerImage,
        uploadDate: publishedIso,
        contentUrl: isIpfsVideoUrl(videoUrl) ? videoUrl : undefined,
        embedUrl: !isIpfsVideoUrl(videoUrl) ? videoUrl : undefined,
        publisher: {
          "@type": "Organization",
          name: "Skatehive",
          logo: {
            "@type": "ImageObject",
            url: `${DOMAIN_URL}/SKATE_HIVE_VECTOR_FIN.svg`,
          },
        },
      };
    }
  } catch {
    // Silently fail - page will still render without JSON-LD
  }

  return (
    <>
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
        />
      )}
      {articleJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(articleJsonLd) }}
        />
      )}
      {videoJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(videoJsonLd) }}
        />
      )}
      <PostPage author={cleanedAuthor} permlink={decodedPermlink} />
    </>
  );
}
