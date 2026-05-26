import Link from "next/link";
import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import MapPageShell from "@/components/spotmap/MapPageShell";
import GoogleMyMapsView from "@/components/spotmap/views/GoogleMyMapsView";

const BASE_URL = APP_CONFIG.BASE_URL;
const ogImageUrl = `${BASE_URL}/api/og/map`;

export const metadata: Metadata = {
  title: "Skate Spot Google Map — Curated Skateparks & Street Spots",
  description:
    "Browse the curated Google My Maps view of Skatehive skate spots. Skateparks, street spots, and DIY spots maintained by the community on Google Maps.",
  keywords: [
    "skate map google",
    "google skate map",
    "skate spots google maps",
    "skatepark google maps",
    "skate google my maps",
    "curated skate map",
  ],
  openGraph: {
    title: "Skate Spot Google Map | Skatehive",
    description:
      "The classic Skatehive Google My Maps view — curated skate spots worldwide.",
    url: `${BASE_URL}/map/google`,
    images: [{ url: ogImageUrl, width: 1200, height: 630, alt: "Skatehive Google Maps view" }],
    siteName: "Skatehive",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Spot Google Map | Skatehive",
    description: "The classic Google My Maps view of Skatehive spots.",
    images: [ogImageUrl],
  },
  alternates: { canonical: `${BASE_URL}/map/google` },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: ogImageUrl,
      button: {
        title: "Open Google Map",
        action: { type: "launch_frame", name: "Skatehive", url: `${BASE_URL}/map/google` },
      },
      postUrl: `${BASE_URL}/map/google`,
    }),
    "fc:frame:image": ogImageUrl,
    "fc:frame:post_url": `${BASE_URL}/map/google`,
  },
};

export default function GoogleMapPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Skate Spot Google Map — Skatehive",
    description:
      "The classic Skatehive Google My Maps view, curated by the community.",
    url: `${BASE_URL}/map/google`,
    isPartOf: { "@type": "WebSite", name: "Skatehive", url: BASE_URL },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Skate Map", item: `${BASE_URL}/map` },
        { "@type": "ListItem", position: 3, name: "Google", item: `${BASE_URL}/map/google` },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
      <MapPageShell activeTab="google">
        <GoogleMyMapsView />
      </MapPageShell>
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 56px" }}>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: 12 }}>
          The classic Skatehive Google Map
        </h2>
        <p style={{ lineHeight: 1.7, marginBottom: 16 }}>
          This is the original curated Google My Maps view of skate spots, kept around because the
          dataset still has spots not yet posted on-chain. Prefer the live Hive-powered view? Try
          the <Link href="/map">standard map</Link> or the{" "}
          <Link href="/map/globe">3D globe</Link>.
        </p>
      </section>
    </>
  );
}
