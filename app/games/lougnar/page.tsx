import { Metadata } from "next";
import LougnarGame from "./LougnarGame";

const BASE_URL = "https://skatehive.app";

export const metadata: Metadata = {
  title: "Lougnar — Play New Skateboarding Game Online Free | SkateHive",
  description:
    "Play Lougnar, the newest skateboarding game from SkateHive. Built with Excalibur.js by webgnar. Fresh take on skate gaming — free in your browser, no download.",
  keywords: [
    "lougnar game",
    "new skateboarding game",
    "skate game online",
    "free browser skate game",
    "skatehive lougnar",
    "excalibur skateboard game",
    "webgnar game",
    "html5 skate game",
  ],
  alternates: {
    canonical: `${BASE_URL}/games/lougnar`,
  },
  openGraph: {
    title: "Lougnar — New Skateboarding Game Free Online",
    description:
      "Play Lougnar free in your browser. The newest skateboarding game from SkateHive, built with Excalibur.js.",
    type: "website",
    url: `${BASE_URL}/games/lougnar`,
    siteName: "SkateHive",
    images: [
      {
        url: `${BASE_URL}/images/lougnar-thumb.jpg`,
        width: 315,
        height: 250,
        alt: "Lougnar — SkateHive skateboarding game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lougnar — Play Free | SkateHive",
    description: "The newest skateboarding browser game from SkateHive. Built with Excalibur.js.",
    images: [`${BASE_URL}/images/lougnar-thumb.jpg`],
  },
  robots: { index: true, follow: true },
};

function LougnarJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Lougnar",
    description:
      "The newest skateboarding game from SkateHive. A fresh take on skate gaming built with Excalibur.js engine.",
    url: `${BASE_URL}/games/lougnar`,
    image: `${BASE_URL}/images/lougnar-thumb.jpg`,
    genre: ["Action", "Skateboarding"],
    gamePlatform: "Web Browser",
    applicationCategory: "Game",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    author: { "@type": "Person", name: "webgnar" },
    publisher: { "@type": "Organization", name: "SkateHive", url: BASE_URL },
    datePublished: "2026",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function LougnarPage() {
  return (
    <>
      <LougnarJsonLd />
      <LougnarGame />
    </>
  );
}
