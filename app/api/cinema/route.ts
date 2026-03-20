import { NextResponse } from "next/server";

const RSS_FEEDS = [
  "https://odysee.com/$/rss/@SkateVideoArchive:6",
  "https://odysee.com/$/rss/@SkateVideoLibrary:e",
  "https://odysee.com/$/rss/@SkatePlaza:7",
];

export interface CinemaVideo {
  title: string;
  link: string;
  embedUrl: string;
  thumbnail: string;
  description: string;
  pubDate: string;
  channel: string;
}

function extractOdyseeEmbedUrl(link: string): string {
  // Convert https://odysee.com/Title:hash to https://odysee.com/$/embed/Title:hash
  try {
    const url = new URL(link);
    const path = url.pathname;
    if (path.includes("/$/embed/")) return link;
    return `https://odysee.com/$/embed${path}`;
  } catch {
    return link;
  }
}

async function parseFeed(feedUrl: string): Promise<CinemaVideo[]> {
  const res = await fetch(feedUrl, { next: { revalidate: 3600 } }); // cache 1 hour
  if (!res.ok) return [];

  const xml = await res.text();
  const videos: CinemaVideo[] = [];

  // Extract channel name
  const channelMatch = xml.match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/);
  const channel = channelMatch?.[1]?.replace(" on Odysee", "") || "Unknown";

  // Extract items
  const items = xml.split("<item>").slice(1);

  for (const item of items) {
    const titleMatch = item.match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/);
    const linkMatch = item.match(/<link>(.+?)<\/link>/);
    const descMatch = item.match(/<description><!\[CDATA\[(.+?)\]\]><\/description>/s);
    const dateMatch = item.match(/<pubDate>(.+?)<\/pubDate>/);
    const thumbMatch = item.match(/<itunes:image\s+href="(.+?)"/);
    const title = titleMatch?.[1] || "Untitled";
    const link = linkMatch?.[1] || "";
    if (!link) continue;

    // Try thumbnail from itunes:image, then enclosure poster, then odycdn thumb
    let thumbnail = thumbMatch?.[1] || "";
    if (!thumbnail) {
      // Try to extract from description img tag
      const imgMatch = item.match(/<img[^>]*src="([^"]+)"/);
      thumbnail = imgMatch?.[1] || "";
    }
    if (!thumbnail) {
      thumbnail = "/ogimage.png";
    }

    const description = (descMatch?.[1] || "")
      .replace(/<[^>]*>/g, "") // strip HTML
      .slice(0, 200);

    videos.push({
      title,
      link,
      embedUrl: extractOdyseeEmbedUrl(link),
      thumbnail,
      description,
      pubDate: dateMatch?.[1] || "",
      channel,
    });
  }

  return videos;
}

export async function GET() {
  try {
    const results = await Promise.all(RSS_FEEDS.map(parseFeed));
    const all = results.flat();

    // Deduplicate by title (normalized)
    const seen = new Set<string>();
    const deduped = all.filter((v) => {
      const key = `${v.channel}:${v.title}`.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by pubDate descending
    deduped.sort((a, b) => {
      const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      // Handle NaN from invalid date strings
      const safeA = Number.isNaN(da) ? 0 : da;
      const safeB = Number.isNaN(db) ? 0 : db;
      return safeB - safeA;
    });

    return NextResponse.json({
      videos: deduped,
      count: deduped.length,
      sources: RSS_FEEDS.length,
    });
  } catch (error) {
    console.error("Cinema RSS fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch cinema feed" }, { status: 500 });
  }
}
