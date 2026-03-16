import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import SkateshopsContent from "@/components/skateshops/SkateshopsContent";

const BASE_URL = APP_CONFIG.BASE_URL;
const ogImageUrl = `${BASE_URL}/api/og/page?title=Skate%20Shops&subtitle=Support%20local%20skate%20shops`;

export const metadata: Metadata = {
  title: "Skate Shops Directory — Support Local Skate Shops Worldwide",
  description:
    "Discover skateboard shops from around the world. From Bless Skate Shop in Brazil to your local shop — support the community that supports skateboarding. Find gear, decks, wheels & more.",
  keywords: [
    "skate shop",
    "skateshop",
    "bless skate shop",
    "bless skateshop",
    "skate shops",
    "skateboard shop",
    "skateboard shops",
    "local skate shop",
    "skateboarding store",
    "skate gear",
    "skateboard store",
    "buy skateboard",
    "skate decks",
  ],
  openGraph: {
    title: "Skate Shops Directory — Find Local Skate Shops Worldwide",
    description:
      "Explore skateboard shops from the Skatehive community. Support local shops that keep skateboarding alive.",
    url: `${BASE_URL}/skateshops`,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Skatehive Skate Shops Directory",
      },
    ],
    siteName: "Skatehive",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Shops Directory — Support Local Skate Shops",
    description:
      "Discover skateboard shops worldwide. From Bless Skate Shop to your local spot — support the community.",
    images: [ogImageUrl],
  },
  alternates: {
    canonical: `${BASE_URL}/skateshops`,
  },
};

export default function SkateshopsPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Skate Shops Directory",
    description:
      "Skateboard shops from around the world, shared by the Skatehive community. Support local shops that keep skateboarding alive.",
    url: `${BASE_URL}/skateshops`,
    isPartOf: {
      "@type": "WebSite",
      name: "Skatehive",
      url: BASE_URL,
    },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        {
          "@type": "ListItem",
          position: 2,
          name: "Skate Shops",
          item: `${BASE_URL}/skateshops`,
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
      <SkateshopsContent />
    </>
  );
}
