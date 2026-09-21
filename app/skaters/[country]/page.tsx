import { Metadata } from "next";
import { notFound } from "next/navigation";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import { getSkaterDirectory } from "@/lib/skaters/fetchSkaters";
import { countryFromSlug, countrySlug } from "@/lib/skaters/geo";
import { avatarUrl } from "@/lib/skaters/directory";
import SkatersDirectory from "@/components/skaters/SkatersDirectory";

const BASE_URL = APP_CONFIG.BASE_URL;

/** How many skaters go into the page's structured data. */
const STRUCTURED_SKATER_LIMIT = 50;

export const revalidate = 300;

interface PageProps {
  params: Promise<{ country: string }>;
}

async function resolveCountry(slug: string) {
  const country = countryFromSlug(slug);
  if (!country) return null;
  const data = await getSkaterDirectory();
  const skaters = data.skaters.filter((skater) => skater.country === country);
  return {
    country,
    skaters,
    generatedAt: data.generatedAt,
    countries: data.countries,
    // An empty directory means the upstream build failed, not that the
    // community vanished. Either way there is nothing here worth indexing.
    isEmpty: skaters.length === 0,
  };
}

/**
 * Every country that has at least one skater gets a page built up front. There
 * are only ~65 of them and each one is a real landing page for "skateboarders
 * in <country>" searches, so there is nothing to gain by deferring any of them.
 *
 * `dynamicParams` stays on (the default) so a country that gains its first
 * skater between deploys still resolves — the country pills on /skaters link
 * straight to these URLs and must never point at a dead page.
 */
export async function generateStaticParams() {
  const data = await getSkaterDirectory();
  return data.countries.map((entry) => ({ country: countrySlug(entry.country) }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { country: slug } = await params;
  const resolved = await resolveCountry(slug);
  // A slug that is not a country still renders the 404 body below, but Next has
  // already begun streaming the shell by then so the response goes out as 200.
  // Telling robots not to index it is what actually keeps these out of search.
  if (!resolved) {
    return { title: "Skaters", robots: { index: false, follow: false } };
  }

  const { country, skaters, isEmpty } = resolved;
  const cities = Array.from(
    new Set(skaters.map((skater) => skater.city).filter(Boolean) as string[])
  ).slice(0, 6);

  // The root layout's title template appends "| Skatehive" to `title`, but
  // leaves openGraph/twitter titles alone — hence the two variants.
  const title = `Skateboarders in ${country} — ${skaters.length} Skaters`;
  const socialTitle = `${title} | Skatehive`;
  const description = cities.length
    ? `Meet ${skaters.length} skateboarders from ${country} on Skatehive, riding in ${cities.join(", ")} and beyond. See who is posting, follow their clips, and connect with the local scene.`
    : `Meet ${skaters.length} skateboarders from ${country} on Skatehive. See who is posting, follow their clips, and connect with the local scene.`;
  const ogImageUrl = `${BASE_URL}/api/og/page?title=${encodeURIComponent(
    `Skaters in ${country}`
  )}&subtitle=${encodeURIComponent(`${skaters.length} riders on Skatehive`)}`;

  return {
    title,
    description,
    keywords: [
      `skateboarders ${country}`,
      `skaters ${country}`,
      `skateboarding ${country}`,
      ...cities.map((city) => `skaters ${city}`),
    ],
    openGraph: {
      title: socialTitle,
      description,
      url: `${BASE_URL}/skaters/${countrySlug(country)}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `Skateboarders in ${country}` }],
      siteName: "Skatehive",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [ogImageUrl],
    },
    alternates: { canonical: `${BASE_URL}/skaters/${countrySlug(country)}` },
    // Keep a page with nobody on it out of the index. Without this, an outage
    // upstream publishes 66 indexable "0 Skaters" pages behind a 200.
    ...(isEmpty ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function SkatersByCountryPage({ params }: PageProps) {
  const { country: slug } = await params;
  const resolved = await resolveCountry(slug);
  if (!resolved) notFound();

  const { country, skaters, generatedAt, countries } = resolved;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `Skateboarders in ${country}`,
    description: `Skatehive community members who skate in ${country}.`,
    url: `${BASE_URL}/skaters/${countrySlug(country)}`,
    isPartOf: { "@type": "WebSite", name: "Skatehive", url: BASE_URL },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: skaters.length,
      itemListElement: skaters.slice(0, STRUCTURED_SKATER_LIMIT).map((skater, index) => ({
        "@type": "ListItem",
        position: index + 1,
        item: {
          "@type": "Person",
          name: skater.displayName || skater.username,
          alternateName: skater.username,
          url: `${BASE_URL}/user/${skater.username}`,
          image: avatarUrl(skater.username),
          ...(skater.city
            ? { homeLocation: { "@type": "Place", name: `${skater.city}, ${country}` } }
            : { homeLocation: { "@type": "Place", name: country } }),
        },
      })),
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Skaters", item: `${BASE_URL}/skaters` },
        {
          "@type": "ListItem",
          position: 3,
          name: country,
          item: `${BASE_URL}/skaters/${countrySlug(country)}`,
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
      <SkatersDirectory
        data={{ skaters, countries, generatedAt }}
        lockedCountry={country}
      />
    </>
  );
}
