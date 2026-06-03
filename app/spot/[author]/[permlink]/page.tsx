import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPostContent } from "@/lib/hive/server-content";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import { cleanUsername } from "@/lib/utils/cleanUsername";
import { isSpotPost, parseSpotBody } from "@/lib/utils/parseSpotBody";
import SpotPageClient from "@/components/spotmap/SpotPageClient";
import KmlSpotClient from "@/components/spotmap/KmlSpotClient";
import { getSpotmapSupabase, type SpotmapRow } from "@/lib/spotmap/supabase";
import { parseKmlDescription } from "@/lib/spotmap/parseKmlDescription";
import { Discussion } from "@hiveio/dhive";

// Reserved "author" used for spots that were imported from the curated
// Google My Maps KML feed. These aren't real Hive posts — when the URL
// uses this author we skip the Hive RPC entirely and serve from
// spotmap_spots in Supabase.
const SYNTHETIC_KML_AUTHOR = "skatehive-map";

async function getKmlSpot(permlink: string): Promise<SpotmapRow | null> {
  const supabase = getSpotmapSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("spotmap_spots")
    .select("*")
    .eq("hive_author", SYNTHETIC_KML_AUTHOR)
    .eq("hive_permlink", permlink)
    .maybeSingle();
  if (error || !data) return null;
  return data as SpotmapRow;
}

const DOMAIN_URL = APP_CONFIG.BASE_URL;
const FALLBACK_IMAGE = `${APP_CONFIG.BASE_URL}/ogimage.png`;

// ISR: cache HTML for a day. A spot's body is immutable after publish;
// making this static cuts serverless invocations (was a top cache-MISS
// route). `generateStaticParams` returning [] is required to opt into ISR
// on dynamic segments in Next 15 — `revalidate` alone is ignored.
//
// Must be a literal — Next statically parses this segment config and rejects
// imported constants. CONTENT tier = 1 day; see config/revalidate.ts.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

// Cached + request-deduplicated: generateMetadata and the page body below
// share one Hive RPC instead of two.
async function getSpot(author: string, permlink: string): Promise<Discussion | null> {
  return (await getPostContent(author, permlink)) as Discussion | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ author: string; permlink: string }>;
}): Promise<Metadata> {
  const { author, permlink } = await params;
  const decodedAuthor = decodeURIComponent(author);
  const decodedPermlink = decodeURIComponent(permlink);

  // KML-backed spot — metadata comes straight from spotmap_spots.
  if (decodedAuthor === SYNTHETIC_KML_AUTHOR) {
    const kml = await getKmlSpot(decodedPermlink);
    if (!kml) {
      return { title: "Spot | Skatehive", description: "View this skate spot on Skatehive." };
    }
    const url = `${DOMAIN_URL}/spot/${SYNTHETIC_KML_AUTHOR}/${decodedPermlink}`;
    const description = kml.kml_description
      ? parseKmlDescription(kml.kml_description).text.slice(0, 200)
      : `Community-mapped skate spot at ${kml.lat.toFixed(4)}, ${kml.lng.toFixed(4)}.`;
    const image = kml.thumbnail || FALLBACK_IMAGE;
    return {
      title: `${kml.name} — Skate spot on Skatehive`,
      description,
      alternates: { canonical: url },
      openGraph: {
        title: `${kml.name} — Skate spot on Skatehive`,
        description,
        url,
        siteName: "Skatehive",
        type: "article",
        images: [{ url: image, width: 1200, height: 630, alt: kml.name }],
      },
      twitter: {
        card: "summary_large_image",
        title: `${kml.name} — Skate spot on Skatehive`,
        description,
        images: [image],
        site: "@skatehive",
      },
    };
  }

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

  // KML-backed spot — render the lightweight client and bail out early.
  if (decodedAuthor === SYNTHETIC_KML_AUTHOR) {
    const kml = await getKmlSpot(decodedPermlink);
    if (!kml) notFound();
    const parsed = parseKmlDescription(kml.kml_description);
    const url = `${DOMAIN_URL}/spot/${SYNTHETIC_KML_AUTHOR}/${decodedPermlink}`;
    const placeJsonLd: Record<string, unknown> = {
      "@context": "https://schema.org",
      "@type": "Place",
      name: kml.name,
      description:
        parsed.text.slice(0, 240) || `Skate spot from the Skatehive Google My Maps dataset.`,
      url,
      ...(kml.thumbnail || parsed.images[0]
        ? { image: [kml.thumbnail, ...parsed.images].filter(Boolean) }
        : {}),
      geo: { "@type": "GeoCoordinates", latitude: kml.lat, longitude: kml.lng },
    };
    const breadcrumbJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: DOMAIN_URL },
        { "@type": "ListItem", position: 2, name: "Skate Map", item: `${DOMAIN_URL}/map` },
        { "@type": "ListItem", position: 3, name: kml.name, item: url },
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
        <KmlSpotClient spot={kml} parsed={parsed} />
      </>
    );
  }

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
