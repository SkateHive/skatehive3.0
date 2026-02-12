import { APP_CONFIG, HIVE_CONFIG } from "@/config/app.config";
import HiveClient from "@/lib/hive/hiveclient";

const BASE_URL = APP_CONFIG.BASE_URL;
const MAX_ITEMS = 50;

type RankedPost = {
  author?: string;
  permlink?: string;
  title?: string;
  body?: string;
  created?: string;
  json_metadata?: any;
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/!\[.*?\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .replace(/_{1,2}([^_]+)_{1,2}/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[-*]{3,}$/gm, "")
    .replace(/^>\s*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractImage(post: RankedPost): string | null {
  try {
    let meta = post.json_metadata;
    if (typeof meta === "string") meta = JSON.parse(meta);
    if (typeof meta === "string") meta = JSON.parse(meta);
    if (meta?.thumbnail?.[0]) return meta.thumbnail[0];
    if (meta?.image?.[0]) return meta.image[0];
    if (meta?.images?.[0]) return meta.images[0];
  } catch {}

  const imgMatch = post.body?.match(/!\[.*?\]\((https?:\/\/[^)]+)\)/);
  return imgMatch ? imgMatch[1] : null;
}

export async function GET() {
  try {
    const tag = HIVE_CONFIG.COMMUNITY_TAG;
    const posts: RankedPost[] = await HiveClient.call(
      "bridge",
      "get_ranked_posts",
      {
        sort: "created",
        tag,
        limit: MAX_ITEMS,
        observer: "",
      },
    );

    const items = (posts || [])
      .filter((p) => p?.author && p?.permlink && p?.title)
      .map((post) => {
        const postUrl = `${BASE_URL}/post/${post.author}/${post.permlink}`;
        const pubDate = post.created
          ? new Date(post.created + "Z").toUTCString()
          : new Date().toUTCString();
        const description = stripMarkdown(post.body || "").slice(0, 300);
        const image = extractImage(post);
        const imageTag = image
          ? `<enclosure url="${escapeXml(image)}" type="image/jpeg" length="0" />`
          : "";

        return `    <item>
      <title>${escapeXml(post.title || "")}</title>
      <link>${escapeXml(postUrl)}</link>
      <guid isPermaLink="true">${escapeXml(postUrl)}</guid>
      <pubDate>${pubDate}</pubDate>
      <dc:creator>${escapeXml(post.author || "")}</dc:creator>
      <description>${escapeXml(description)}</description>
      ${imageTag}
    </item>`;
      })
      .join("\n");

    const lastBuildDate =
      posts?.[0]?.created
        ? new Date(posts[0].created + "Z").toUTCString()
        : new Date().toUTCString();

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Skatehive - The Infinity Skateboard Magazine</title>
    <link>${BASE_URL}</link>
    <description>The latest skateboarding content from the Skatehive community on the Hive blockchain.</description>
    <language>en</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/SKATE_HIVE_VECTOR_FIN.svg</url>
      <title>Skatehive</title>
      <link>${BASE_URL}</link>
    </image>
${items}
  </channel>
</rss>`;

    return new Response(rss, {
      headers: {
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=1800, s-maxage=1800",
      },
    });
  } catch (error) {
    console.error("Error generating RSS feed:", error);
    return new Response("Error generating feed", { status: 500 });
  }
}
