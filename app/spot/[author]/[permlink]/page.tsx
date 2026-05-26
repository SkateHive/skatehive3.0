import { Metadata } from "next";
import { notFound } from "next/navigation";
import HiveClient from "@/lib/hive/hiveclient";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import { cleanUsername } from "@/lib/utils/cleanUsername";
import { isSpotPost, parseSpotBody } from "@/lib/utils/parseSpotBody";
import SpotPageClient from "@/components/spotmap/SpotPageClient";
import { Discussion } from "@hiveio/dhive";

const DOMAIN_URL = APP_CONFIG.BASE_URL;
const FALLBACK_IMAGE = `${APP_CONFIG.BASE_URL}/ogimage.png`;

// ISR: cache HTML for 5 min. Spot body is fetched from Hive RPC and
// changes rarely after publish; making this static cuts ~48 serverless
// invocations/hour (was the third-highest cache-MISS route).
// `generateStaticParams` returning [] is required to opt into ISR on
// dynamic segments in Next 15 — `revalidate` alone is ignored.
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

async function getSpot(author: string, permlink: string): Promise<Discussion | null> {
  // Basic sanity check on the permlink shape — Hive permlinks are kebab-case slugs.
  if (typeof permlink !== "string" || permlink.length < 2 || /^\d+$/.test(permlink)) {
    return null;
  }
  try {
    const cleanAuthor = author.startsWith("@") ? author.slice(1) : author;
    const post = (await HiveClient.database.call("get_content", [
      cleanAuthor,
      permlink,
    ])) as Discussion;
    if (!post || !post.author) return null;
    return post;
  } catch (error) {
    console.error("Failed to fetch spot content:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ author: string; permlink: string }>;
}): Promise<Metadata> {
  const { author, permlink } = await params;
  const decodedAuthor = decodeURIComponent(author);
  const decodedPermlink = decodeURIComponent(permlink);

  const post = await getSpot(decodedAuthor, decodedPermlink);
  if (!post) {
    return {
      title: "Spot | Skatehive",
      description: "View this skate spot on Skatehive.",
    };
  }

  const spot = parseSpotBody(post.body);
  const cleanedAuthor = cleanUsername(post.author);
  const spotName = spot.name || post.title || "Skate spot";
  const title = `${spotName} — Skate spot on Skatehive`;

  const locationBit = spot.address
    ? ` Located at ${spot.address}.`
    : spot.lat != null && spot.lng != null
    ? ` Coordinates ${spot.lat.toFixed(5)}, ${spot.lng.toFixed(5)}.`
    : "";
  const descSnippet = (spot.description || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
  const description =
    `Skate spot "${spotName}" submitted by @${cleanedAuthor} on Skatehive.${locationBit}${
      descSnippet ? " " + descSnippet : ""
    }`.trim();

  const image = spot.images[0]?.url || FALLBACK_IMAGE;
  const spotUrl = `${DOMAIN_URL}/spot/${cleanedAuthor}/${decodedPermlink}`;

  return {
    title,
    description,
    authors: [{ name: cleanedAuthor }],
    keywords: [
      "skate spot",
      "skatepark",
      "skateboarding",
      "skatehive",
      spotName,
      cleanedAuthor,
    ],
    alternates: { canonical: spotUrl },
    openGraph: {
      title,
      description,
      url: spotUrl,
      images: [{ url: image, width: 1200, height: 630, alt: spotName }],
      siteName: "Skatehive",
      type: "article",
      publishedTime: post.created ? new Date(post.created + "Z").toISOString() : undefined,
      authors: [cleanedAuthor],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
      site: "@skatehive",
      creator: `@${cleanedAuthor}`,
    },
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: image,
        button: {
          title: "View spot",
          action: { type: "launch_frame", name: "Skatehive", url: spotUrl },
        },
        postUrl: spotUrl,
      }),
      "fc:frame:image": image,
      "fc:frame:post_url": spotUrl,
    },
  };
}

export default async function SpotPage({
  params,
}: {
  params: Promise<{ author: string; permlink: string }>;
}) {
  const { author, permlink } = await params;
  const decodedAuthor = decodeURIComponent(author);
  const decodedPermlink = decodeURIComponent(permlink);

  const post = await getSpot(decodedAuthor, decodedPermlink);
  if (!post) notFound();

  // Make sure this is actually a skate spot before rendering the spot UI.
  // If a non-spot post lands here, we just show the parsed-body view anyway —
  // but warn in logs so the issue surfaces.
  if (!isSpotPost({ body: post.body, json_metadata: post.json_metadata })) {
    console.warn(
      `[/spot] @${decodedAuthor}/${decodedPermlink} is not tagged 'skatespot' and body does not match the spot format.`
    );
  }

  const spot = parseSpotBody(post.body);
  const cleanedAuthor = cleanUsername(post.author);
  const spotUrl = `${DOMAIN_URL}/spot/${cleanedAuthor}/${decodedPermlink}`;
  const spotName = spot.name || "Skate spot";

  const placeJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: spotName,
    description: spot.description?.slice(0, 240) || `Skate spot submitted by @${cleanedAuthor}`,
    url: spotUrl,
    ...(spot.images[0]?.url ? { image: spot.images.map((i) => i.url) } : {}),
    ...(spot.lat != null && spot.lng != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: spot.lat,
            longitude: spot.lng,
          },
        }
      : {}),
    ...(spot.address
      ? { address: { "@type": "PostalAddress", streetAddress: spot.address } }
      : {}),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: DOMAIN_URL },
      { "@type": "ListItem", position: 2, name: "Skate Map", item: `${DOMAIN_URL}/map` },
      { "@type": "ListItem", position: 3, name: spotName, item: spotUrl },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(placeJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(breadcrumbJsonLd) }}
      />
      <SpotPageClient discussion={post} spot={spot} />
    </>
  );
}
