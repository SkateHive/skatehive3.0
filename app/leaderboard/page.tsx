import { Metadata } from "next";
import LeaderboardClient from "./leaderboardClient";
import { SkaterData } from "@/types/leaderboard";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";

interface LeaderboardDataResult {
  data: SkaterData[];
  top3: SkaterData[];
  top3Names: string;
  podiumImageUrl: string;
}

const BASE_URL = APP_CONFIG.ORIGIN;
const API_ENDPOINT = `${APP_CONFIG.API_BASE_URL}/api/v2/leaderboard`;

// Unified data fetching with optimized caching strategy
async function fetchLeaderboardData(
  revalidateSeconds: number = 60
): Promise<SkaterData[]> {
  try {
    const res = await fetch(API_ENDPOINT, {
      next: { revalidate: revalidateSeconds },
    });

    if (!res.ok) {
      throw new Error(
        `Failed to fetch leaderboard data: ${res.status} ${res.statusText}`
      );
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    return [];
  }
}

// Generate podium image URL with top 3 skaters
function generatePodiumImageUrl(top3: SkaterData[]): string {
  if (top3.length === 0) {
    return `${BASE_URL}/api/generate-podium?default=true`;
  }

  const avatarUrls = top3
    .map(
      (skater) =>
        `https://images.hive.blog/u/${skater.hive_author}/avatar/small`
    )
    .join(",");

  const names = top3.map((skater) => skater.hive_author).join(",");

  return `${BASE_URL}/api/generate-podium?avatars=${encodeURIComponent(
    avatarUrls
  )}&names=${encodeURIComponent(names)}`;
}

// Process leaderboard data and generate metadata assets
async function processLeaderboardData(
  revalidateSeconds?: number
): Promise<LeaderboardDataResult> {
  const data = await fetchLeaderboardData(revalidateSeconds);

  // Get top 3 by points, with fallback for empty data
  const top3 =
    data.length > 0
      ? [...data].sort((a, b) => b.points - a.points).slice(0, 3)
      : [];

  const top3Names = top3.map((skater) => skater.hive_author).join(", ");
  const podiumImageUrl = generatePodiumImageUrl(top3);

  return {
    data,
    top3,
    top3Names,
    podiumImageUrl,
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const { top3, top3Names, podiumImageUrl } = await processLeaderboardData(300); // 5 minutes cache for metadata

  const dynamicDescription =
    top3.length > 0
      ? `Current top skaters: ${top3Names}. Discover the top performers in the Skatehive community based on points, HIVE power, posts, NFTs, and community contributions.`
      : "Discover the top performers in the Skatehive community. View rankings based on HIVE power, posts, NFTs, and community contributions.";

  const pageTitle = `Skatehive Leaderboard | Top Skaters - ${
    top3[0]?.hive_author || "Champions"
  } Leading`;
  const ogTitle = `🏆 Skatehive Leaderboard - ${
    top3[0]?.hive_author || "Champions"
  } on Top!`;

  // Create optimized frame object with complete metadata
  const frameObject = {
    version: "next",
    imageUrl: podiumImageUrl,
    button: {
      title: "Open Leaderboard",
      action: {
        type: "launch_frame",
        name: "Skatehive",
        url: `${BASE_URL}/leaderboard`,
      },
    },
    postUrl: BASE_URL,
  };

  return {
    title: pageTitle,
    description: dynamicDescription,
    alternates: {
      canonical: `${BASE_URL}/leaderboard`,
    },
    keywords: [
      "skatehive",
      "leaderboard",
      "hive",
      "skateboarding",
      "blockchain",
      "nft",
      "web3",
      "community",
      ...top3.map((skater) => skater.hive_author),
    ],
    openGraph: {
      title: ogTitle,
      description: dynamicDescription,
      type: "website",
      url: `${BASE_URL}/leaderboard`,
      images: [
        {
          url: podiumImageUrl,
          width: 1200,
          height: 630,
          alt: `Skatehive Leaderboard Podium - Top 3: ${
            top3Names || "Champions"
          }`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: dynamicDescription,
      images: [podiumImageUrl],
    },
    other: {
      "fc:frame": JSON.stringify(frameObject),
      "fc:frame:image": podiumImageUrl,
      "fc:frame:post_url": BASE_URL,
      "fc:frame:button:1": "Open Leaderboard",
      "fc:frame:button:1:action": "launch_frame",
    },
  };
}

export default async function LeaderboardPage() {
  const { data: skatersData } = await processLeaderboardData(60); // 1 minute cache for page data

  // Build ItemList JSON-LD for top skaters
  const top10 = [...skatersData].sort((a, b) => b.points - a.points).slice(0, 10);
  const itemListJsonLd = top10.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Skatehive Leaderboard - Top Skaters",
    numberOfItems: top10.length,
    itemListElement: top10.map((skater, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: skater.hive_author,
      url: `${BASE_URL}/user/${skater.hive_author}`,
    })),
  } : null;

  return (
    <>
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(itemListJsonLd) }}
        />
      )}
      <LeaderboardClient skatersData={skatersData} />
    </>
  );
}
