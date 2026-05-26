import Link from "next/link";
import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import MapPageShell from "@/components/spotmap/MapPageShell";
import SpotsGlobe from "@/components/spotmap/views/SpotsGlobe";

const BASE_URL = APP_CONFIG.BASE_URL;
const ogImageUrl = `${BASE_URL}/api/og/map`;

export const metadata: Metadata = {
  title: "Skate Spot Globe — 3D Interactive Map of Skate Spots Worldwide",
  description:
    "Spin the globe to discover skateparks, street spots, and DIY skate spots worldwide. The Skatehive 3D globe view plots community-submitted spots on a rotating Earth.",
  keywords: [
    "skate spot globe",
    "3d skate map",
    "interactive skate map",
    "skate spots worldwide",
    "global skate spots",
    "skatepark globe",
    "skate map 3d",
  ],
  openGraph: {
    title: "Skate Spot Globe — 3D Skate Spots Worldwide | Skatehive",
    description:
      "Spin the globe and click skate spot markers anywhere on Earth. Community-built skate spot map in 3D.",
    url: `${BASE_URL}/map/globe`,
    images: [{ url: ogImageUrl, width: 1200, height: 630, alt: "Skatehive 3D skate spot globe" }],
    siteName: "Skatehive",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Spot Globe — 3D Skate Spots Worldwide | Skatehive",
    description: "Skate spots from around the world plotted on an interactive globe.",
    images: [ogImageUrl],
  },
  alternates: { canonical: `${BASE_URL}/map/globe` },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: ogImageUrl,
      button: {
        title: "Spin the globe",
        action: { type: "launch_frame", name: "Skatehive", url: `${BASE_URL}/map/globe` },
      },
      postUrl: `${BASE_URL}/map/globe`,
    }),
    "fc:frame:image": ogImageUrl,
    "fc:frame:post_url": `${BASE_URL}/map/globe`,
  },
};

export default function GlobeMapPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Skate Spot Globe — Skatehive",
    description:
      "Community-built skate spot map rendered as an interactive 3D globe. Click a marker to open the spot page.",
    url: `${BASE_URL}/map/globe`,
    isPartOf: { "@type": "WebSite", name: "Skatehive", url: BASE_URL },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Skate Map", item: `${BASE_URL}/map` },
        { "@type": "ListItem", position: 3, name: "Globe", item: `${BASE_URL}/map/globe` },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
      <MapPageShell activeTab="globe">
        <SpotsGlobe />
      </MapPageShell>
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 56px" }}>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: 12 }}>
          See skate spots on a rotating globe
        </h2>
        <p style={{ lineHeight: 1.7, marginBottom: 16 }}>
          The globe view plots every Skatehive spot with coordinates on an interactive 3D Earth.
          Drag to rotate, scroll to zoom, and click any marker to open that spot. Prefer a flat
          view? Try the <Link href="/map">standard map</Link> or the curated{" "}
          <Link href="/map/google">Google Maps view</Link>.
        </p>
      </section>
    </>
  );
}
