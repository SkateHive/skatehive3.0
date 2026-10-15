import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import { getSkaterDirectory } from "@/lib/skaters/fetchSkaters";
import { countrySlug } from "@/lib/skaters/geo";
import SkatersDirectory from "@/components/skaters/SkatersDirectory";

const BASE_URL = APP_CONFIG.BASE_URL;
const ogImageUrl = `${BASE_URL}/api/og/page?title=Skaters&subtitle=Meet%20the%20skatehive%20community`;

/** Countries listed in the page's structured data and crawlable links. */
const STRUCTURED_COUNTRY_LIMIT = 40;

const baseMetadata: Metadata = {
  // No "| Skatehive" suffix here: the root layout's title template adds it.
  title: "Skateboarders Directory — Find Skaters by Country & City",
  description:
    "Discover skateboarders from around the world. Browse skaters by country and city — from Brazilian skateboarders in São Paulo to street skaters in Los Angeles. Connect with the global skate community on Skatehive.",
  keywords: [
    "skateboarders",
    "skaters directory",
    "brazilian skateboarders",
    "skaters são paulo",
    "skaters rio de janeiro",
    "street skaters",
    "skateboarding community",
    "find skaters",
    "skaters by country",
    "skaters by city",
    "skateboard profiles",
  ],
  openGraph: {
    title: "Skateboarders Directory — Find Skaters Worldwide | Skatehive",
    description:
      "Discover skateboarders from around the world. Browse by country and city, connect with the global skate community.",
    url: `${BASE_URL}/skaters`,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Skatehive Skateboarders Directory",
      },
    ],
    siteName: "Skatehive",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skateboarders Directory — Find Skaters Worldwide",
    description:
      "Discover skateboarders from around the world. Browse by country and city.",
    images: [ogImageUrl],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: ogImageUrl,
      button: {
        title: "Find Skaters",
        action: { type: "launch_frame", name: "Skatehive", url: `${BASE_URL}/skaters` },
      },
      postUrl: `${BASE_URL}/skaters`,
    }),
    "fc:frame:image": ogImageUrl,
    "fc:frame:post_url": `${BASE_URL}/skaters`,
  },
  alternates: {
    canonical: `${BASE_URL}/skaters`,
  },
};

export const revalidate = 300; // ISR: render once, refresh every 5 min (static-safe page)

/**
 * Same reasoning as the country pages: if the snapshot came back empty the
 * upstream build failed, and a directory listing nobody should not be indexed
 * while that is true.
 */
export async function generateMetadata(): Promise<Metadata> {
  const data = await getSkaterDirectory();
  if (data.skaters.length > 0) return baseMetadata;
  return { ...baseMetadata, robots: { index: false, follow: true } };
}

export default async function SkatersPage() {
  const data = await getSkaterDirectory();
  const topCountries = data.countries.slice(0, STRUCTURED_COUNTRY_LIMIT);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Skateboarders Directory",
    description:
      "Directory of skateboarders from the Skatehive community — browse by country and city.",
    url: `${BASE_URL}/skaters`,
    isPartOf: {
      "@type": "WebSite",
      name: "Skatehive",
      url: BASE_URL,
    },
    // The real list of countries, so the directory's structure is legible to
    // crawlers even though the filtering itself happens client-side.
    mainEntity: {
      "@type": "ItemList",
      name: "Skateboarders by country",
      numberOfItems: data.countries.length,
      itemListElement: topCountries.map((entry, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: `Skateboarders in ${entry.country}`,
        url: `${BASE_URL}/skaters/${countrySlug(entry.country)}`,
      })),
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Skaters",
          item: `${BASE_URL}/skaters`,
        },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
      <SkatersDirectory data={data} />

      {/* Crawlable links to every country page. Visually hidden because the
          interactive country pills above cover the same ground for humans. */}
      <nav aria-label="Skaters by country" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
        <ul>
          {data.countries.map((entry) => (
            <li key={entry.country}>
              <a href={`/skaters/${countrySlug(entry.country)}`}>
                Skateboarders in {entry.country} ({entry.count})
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
