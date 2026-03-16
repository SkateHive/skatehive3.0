import dynamic from "next/dynamic";
import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";

const BASE_URL = APP_CONFIG.BASE_URL;
const ogImageUrl = `${BASE_URL}/api/og/page?title=Skate%20Map&subtitle=Find%20skate%20spots%20worldwide`;

export const metadata: Metadata = {
  title: "Find Skateparks Near You | Interactive Skate Spot Map 🛹",
  description:
    "Free interactive map of 1000+ skateparks, street spots & DIY spots worldwide. Search by city, see photos, add your local spots. Built by skaters, for skaters. Find your next session now!",
  keywords: [
    "skate spot map",
    "skate map",
    "skatemap",
    "skatespot map",
    "find skate spots",
    "skate spot finder",
    "skateboard map",
    "skateboarding map",
    "skateparks near me",
    "street spots",
    "skate spots near me",
    "global skate spots",
    "skatepark finder",
    "skate spot app",
    "add skate spot",
    "DIY skate spots",
  ],
  openGraph: {
    title: "Skate Spot Map — Find Skateparks & Street Spots Worldwide",
    description:
      "Discover skateparks, street spots, and DIY spots near you. Community-built map by skaters worldwide. Add your spots and explore new ones.",
    url: `${APP_CONFIG.BASE_URL}/map`,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Skatehive Skate Spot Map - Find spots worldwide",
      },
    ],
    siteName: "Skatehive",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Spot Map — Find Skateparks & Street Spots Near You",
    description:
      "Community-built skate spot map. Find skateparks, street spots, and DIY spots worldwide. Add your local spots.",
    images: [ogImageUrl],
  },
  alternates: {
    canonical: `${APP_CONFIG.BASE_URL}/map`,
  },
};

const EmbeddedMap = dynamic(() => import("@/components/spotmap/EmbeddedMap"), { ssr: true });

export default function MapPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Skate Spot Map — Find Skateparks & Street Spots",
    description:
      "Find skateparks, street spots, and DIY spots worldwide on the Skatehive community-built map.",
    url: `${BASE_URL}/map`,
    isPartOf: {
      "@type": "WebSite",
      name: "Skatehive",
      url: BASE_URL,
    },
    mainEntity: {
      "@type": "Map",
      name: "Skatehive Skate Spot Map",
      description:
        "Community-built map of skateparks, street spots, and DIY spots worldwide. Submitted by skaters, for skaters.",
      url: `${BASE_URL}/map`,
      mapType: "https://schema.org/VenueMap",
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Skate Map", item: `${BASE_URL}/map` },
      ],
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
      <EmbeddedMap />
    </>
  );
}
