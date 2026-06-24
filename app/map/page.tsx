import Link from "next/link";
import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import MapPageShell from "@/components/spotmap/MapPageShell";
import MapWithCards from "@/components/spotmap/views/MapWithCards";

const BASE_URL = APP_CONFIG.BASE_URL;
const ogImageUrl = `${BASE_URL}/api/og/map`;

export const metadata: Metadata = {
  title: "Skate Spot Map, Find Skateparks & Skate Spots Worldwide",
  description:
    "Explore a free skate spot map with skateparks, street spots, and DIY skate spots worldwide. Use Skatehive to find skate spots near you, browse skatepark maps by city, and add new local spots.",
  keywords: [
    "skate spot map",
    "skate spots map",
    "skatepark map",
    "skateparks map",
    "skate spots near me",
    "skateparks near me",
    "skate map",
    "skatemap",
    "skatespot map",
    "find skate spots",
    "skate spot finder",
    "skatepark finder",
    "skateboard map",
    "skateboarding map",
    "street spots",
    "DIY skate spots",
    "global skate spots",
    "add skate spot",
  ],
  openGraph: {
    title: "Skate Spot Map, Find Skateparks & Street Spots Worldwide | Skatehive",
    description:
      "Browse a community-built skate spot map with skateparks, street spots, and DIY spots worldwide. Find skate spots near you or explore skatepark maps in new cities.",
    url: `${APP_CONFIG.BASE_URL}/map`,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Skatehive skate spot map with skateparks and street spots worldwide",
      },
    ],
    siteName: "Skatehive",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Spot Map, Find Skateparks & Spots Worldwide | Skatehive",
    description:
      "Find skateparks, street spots, and DIY spots near you on the Skatehive skate spot map.",
    images: [ogImageUrl],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: ogImageUrl,
      button: {
        title: "Find Spots",
        action: { type: "launch_frame", name: "Skatehive", url: `${APP_CONFIG.BASE_URL}/map` },
      },
      postUrl: `${APP_CONFIG.BASE_URL}/map`,
    }),
    "fc:frame:image": ogImageUrl,
    "fc:frame:post_url": `${APP_CONFIG.BASE_URL}/map`,
  },
  alternates: {
    canonical: `${APP_CONFIG.BASE_URL}/map`,
  },
};

export default function MapPage() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Skate Spot Map, Find Skateparks and Skate Spots Worldwide",
      description:
        "Explore skateparks, street spots, and DIY skate spots worldwide on the Skatehive community-built skate spot map.",
      url: `${BASE_URL}/map`,
      isPartOf: {
        "@type": "WebSite",
        name: "Skatehive",
        url: BASE_URL,
      },
      about: ["skate spot map", "skate spots map", "skatepark map", "skate spots near me"],
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
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is the Skatehive skate spot map?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "The Skatehive skate spot map is a free community-built map of skateparks, street spots, and DIY skate spots worldwide.",
          },
        },
        {
          "@type": "Question",
          name: "How do I find skate spots near me?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Use the Near Me mode to center the map on your location and discover nearby skateparks, street spots, and DIY spots.",
          },
        },
        {
          "@type": "Question",
          name: "Can I add a skatepark or local skate spot?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. You can submit a new skatepark, street spot, or DIY spot to help other skaters discover places to skate.",
          },
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
      <MapPageShell activeTab="map" suppressSpotList>
        <MapWithCards />
      </MapPageShell>
      <section style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px 56px" }}>
        <h2 style={{ fontSize: "1.75rem", fontWeight: 800, marginBottom: 12 }}>
          A skate spot map built for real-world sessions
        </h2>
        <p style={{ lineHeight: 1.7, marginBottom: 16 }}>
          Skatehive helps skaters discover skateparks, street spots, ledges, rails, DIY spots, and
          other skateable places around the world. If you are planning a trip, searching for a
          skatepark map in a new city, or trying to find skate spots near you before a quick
          session, this page gives you an indexable, community-built map that keeps growing.
        </p>
        <p style={{ lineHeight: 1.7, marginBottom: 16 }}>
          Want a different view?{" "}
          <Link href="/map/google">Open the curated Google Maps version</Link>, or jump straight to
          spots <Link href="/map/near-me">near your location</Link>.
        </p>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 800, marginBottom: 12 }}>
          Why this skatepark map is useful
        </h2>
        <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>
          <li>Browse skateparks, street spots, and DIY spots in one place.</li>
          <li>Explore spots worldwide when traveling or filming.</li>
          <li>Add new local spots so the map stays fresh and community-driven.</li>
        </ul>
      </section>
    </>
  );
}
