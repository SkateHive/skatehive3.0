import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import CinemaContent from "@/components/cinema/CinemaContent";

const BASE_URL = APP_CONFIG.BASE_URL;
const ogImageUrl = `${BASE_URL}/api/og/page?title=Skate%20Cinema&subtitle=Classic%20Skateboarding%20Films`;

export const metadata: Metadata = {
  title: "Skate Cinema — Classic Skateboarding Videos & Full-Length Films | Skatehive",
  description:
    "Watch classic skateboarding videos and full-length films from brands like Girl, Zero, Real, Emerica, Element, DC Shoes, and more. A curated archive of the best skate videos ever made.",
  keywords: [
    "classic skate videos",
    "skateboard films",
    "full length skate videos",
    "girl yeah right",
    "zero dying to live",
    "real skateboards video",
    "emerica this is skateboarding",
    "baker bootleg",
    "skate video archive",
    "skateboarding history",
    "90s skate videos",
    "2000s skate videos",
  ],
  openGraph: {
    title: "Skate Cinema — Classic Skateboarding Films | Skatehive",
    description: "Watch classic skateboarding videos from Girl, Zero, Real, Emerica, and more.",
    url: `${BASE_URL}/cinema`,
    images: [{ url: ogImageUrl, width: 1200, height: 630, alt: "Skatehive Cinema" }],
    siteName: "Skatehive",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Cinema — Classic Skateboarding Films",
    description: "Watch classic skateboarding videos from the best brands in skateboarding history.",
    images: [ogImageUrl],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: ogImageUrl,
      button: {
        title: "Watch Films",
        action: { type: "launch_frame", name: "Skatehive", url: `${BASE_URL}/cinema` },
      },
      postUrl: `${BASE_URL}/cinema`,
    }),
    "fc:frame:image": ogImageUrl,
    "fc:frame:post_url": `${BASE_URL}/cinema`,
  },
  alternates: { canonical: `${BASE_URL}/cinema` },
};

export default function CinemaPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Skate Cinema",
    description: "A curated archive of classic skateboarding videos and full-length films.",
    url: `${BASE_URL}/cinema`,
    isPartOf: { "@type": "WebSite", name: "Skatehive", url: BASE_URL },
    breadcrumb: {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Cinema", item: `${BASE_URL}/cinema` },
      ],
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }} />
      <CinemaContent />
    </>
  );
}
