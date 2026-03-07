import { Metadata } from "next";
import HomePageClient from "./HomePageClient";
import { APP_CONFIG } from "@/config/app.config";

export const metadata: Metadata = {
  title: "Skatehive - The Infinity Skateboard Magazine",
  description:
    "Discover the latest skateboarding content, tricks, spots, and community posts. Join the global skateboarding community on Skatehive. Post videos, earn crypto, find skate spots worldwide.",
  keywords: [
    "skatehive",
    "skateboarding",
    "skate community",
    "skateboard magazine",
    "skate videos",
    "skateboarding tricks",
    "skate spots",
    "crypto skateboarding",
    "hive blockchain",
    "skateboard content",
    "skate map",
    "skateparks",
  ],
  alternates: {
    canonical: APP_CONFIG.BASE_URL,
  },
  openGraph: {
    title: "Skatehive - The Infinity Skateboard Magazine",
    description:
      "The global skateboarding community. Post videos, find spots, earn crypto. Built by skaters, for skaters.",
    type: "website",
    url: APP_CONFIG.BASE_URL,
    siteName: "Skatehive",
    images: [
      {
        url: `${APP_CONFIG.BASE_URL}/ogimage.png`,
        width: 1200,
        height: 630,
        alt: "Skatehive - The Infinity Skateboard Magazine",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skatehive - The Infinity Skateboard Magazine",
    description:
      "The global skateboarding community. Post videos, find spots, earn crypto. Built by skaters, for skaters.",
    images: [`${APP_CONFIG.BASE_URL}/ogimage.png`],
  },
};

const BASE_URL = APP_CONFIG.BASE_URL;

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Skatehive",
  url: BASE_URL,
  description: "The global skateboarding community platform. Post videos, find skate spots, earn crypto rewards.",
  potentialAction: {
    "@type": "SearchAction",
    target: `${BASE_URL}/blog/tag/{search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Skatehive",
  url: BASE_URL,
  logo: `${BASE_URL}/SKATE_HIVE_VECTOR_FIN.svg`,
  sameAs: [
    "https://twitter.com/skatehive",
    "https://github.com/sktbrd/skatehive",
  ],
};

const navJsonLd = {
  "@context": "https://schema.org",
  "@type": "SiteNavigationElement",
  name: ["Home", "Magazine", "Map", "Tricks", "Games", "Bounties", "Leaderboard"],
  url: [
    BASE_URL,
    `${BASE_URL}/blog`,
    `${BASE_URL}/map`,
    `${BASE_URL}/tricks`,
    `${BASE_URL}/games`,
    `${BASE_URL}/bounties`,
    `${BASE_URL}/leaderboard`,
  ],
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(navJsonLd) }}
      />
      <HomePageClient />
    </>
  );
}
