import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";
import { safeJsonLdStringify } from "@/lib/utils/safeJsonLd";
import VideosContent from "@/components/videos/VideosContent";

const BASE_URL = APP_CONFIG.BASE_URL;

export const metadata: Metadata = {
  title: "Skate Videos — Street Skating, Park Clips & Full Edits | Skatehive",
  description:
    "Watch skateboarding videos from around the world. Street skating clips, park sessions, full edits, and raw footage from the Skatehive community. Discover skate videos on 3Speak, YouTube, and IPFS.",
  keywords: [
    "skate videos",
    "skateboarding videos",
    "street skate videos",
    "skate clips",
    "skateboard videos",
    "skate video edits",
    "skate footage",
    "skateboarding clips",
    "skate montage",
    "skateboard edits",
    "3speak skateboarding",
    "skate youtube",
  ],
  openGraph: {
    title: "Skate Videos — Community Clips & Edits | Skatehive",
    description:
      "Watch skateboarding videos from the Skatehive community. Street skating, park sessions, full edits, and more.",
    url: `${BASE_URL}/videos`,
    images: [
      {
        url: `${BASE_URL}/ogimage.png`,
        width: 1200,
        height: 630,
        alt: "Skatehive Skate Videos",
      },
    ],
    siteName: "Skatehive",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Videos — Community Clips & Edits",
    description:
      "Watch skateboarding videos from the Skatehive community. Street skating, park sessions, and more.",
    images: [`${BASE_URL}/ogimage.png`],
  },
  alternates: {
    canonical: `${BASE_URL}/videos`,
  },
};

export default function VideosPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Skate Videos",
    description:
      "Skateboarding videos from the Skatehive community — street skating, park clips, full edits, and raw footage.",
    url: `${BASE_URL}/videos`,
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
          name: "Videos",
          item: `${BASE_URL}/videos`,
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
      <VideosContent />
    </>
  );
}
