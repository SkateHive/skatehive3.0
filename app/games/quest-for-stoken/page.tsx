import { Metadata } from "next";
import QuestForStokenGame from "./QuestForStokenGame";

const BASE_URL = "https://skatehive.app";

export const metadata: Metadata = {
  title: "Quest for Stoken — Play Free Skateboarding Game Online | SkateHive",
  description:
    "Play Quest for Stoken, the OG SkateHive skateboarding game. Control your skater, land tricks, collect STOKEN tokens — free in your browser, no download.",
  keywords: [
    "quest for stoken",
    "skatehive game",
    "skateboarding game online",
    "free skate game",
    "browser skateboard game",
    "html5 skate game",
    "play skateboarding game",
    "stoken crypto game",
  ],
  alternates: {
    canonical: `${BASE_URL}/games/quest-for-stoken`,
  },
  openGraph: {
    title: "Quest for Stoken — Free Skateboarding Game",
    description:
      "Play Quest for Stoken free in your browser. Land tricks, collect STOKEN, and chase the stoke.",
    type: "website",
    url: `${BASE_URL}/games/quest-for-stoken`,
    siteName: "SkateHive",
    images: [
      {
        url: `${BASE_URL}/images/qfs-ogimage.png`,
        width: 1200,
        height: 630,
        alt: "Quest for Stoken — SkateHive skateboarding game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quest for Stoken — Play Free | SkateHive",
    description: "The OG skateboarding browser game. Land tricks, collect STOKEN.",
    images: [`${BASE_URL}/images/qfs-ogimage.png`],
  },
  robots: { index: true, follow: true },
};

function QfsJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "Quest for Stoken",
    description:
      "The original SkateHive skateboarding game. Control your skater through challenging levels, land tricks, and collect STOKEN tokens.",
    url: `${BASE_URL}/games/quest-for-stoken`,
    image: `${BASE_URL}/images/qfs-ogimage.png`,
    genre: ["Platformer", "Arcade", "Skateboarding"],
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
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function QuestForStokenPage() {
  return (
    <>
      <QfsJsonLd />
      <QuestForStokenGame />
    </>
  );
}
