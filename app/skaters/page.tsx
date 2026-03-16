import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import SkatersContent from "@/components/skaters/SkatersContent";

const BASE_URL = APP_CONFIG.BASE_URL;
const ogImageUrl = `${BASE_URL}/api/og/page?title=Skaters&subtitle=Meet%20the%20skatehive%20community`;

export const metadata: Metadata = {
  title: "Skateboarders Directory — Find Skaters by Country & City | Skatehive",
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
  alternates: {
    canonical: `${BASE_URL}/skaters`,
  },
};

export default function SkatersPage() {
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
      <SkatersContent />
    </>
  );
}
