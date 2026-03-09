import { Metadata } from "next";
import GamesGallery from "./GamesGallery";

const BASE_URL = "https://skatehive.app";

export const metadata: Metadata = {
  title: "Skate Games — Play Free Skateboarding Games Online | Skatehive",
  description:
    "Play free skateboarding games built by the SkateHive community. Browser-based skate games like Quest for Stoken and Lougnar — no download needed.",
  keywords: [
    "skateboarding games",
    "skate games online",
    "free skate game",
    "browser skateboard game",
    "play skateboarding game online",
    "skatehive games",
    "quest for stoken",
    "lougnar game",
    "web3 games",
    "skateboarding arcade",
    "html5 skate game",
  ],
  alternates: {
    canonical: `${BASE_URL}/games`,
  },
  openGraph: {
    title: "Skate Games — Play Free Skateboarding Games Online",
    description:
      "Play free skateboarding games built by the SkateHive community. No download needed — play in your browser.",
    type: "website",
    url: `${BASE_URL}/games`,
    siteName: "SkateHive",
    images: [
      {
        url: `${BASE_URL}/images/qfs-ogimage.png`,
        width: 1200,
        height: 630,
        alt: "SkateHive Games — Free skateboarding games",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Games — Play Free Online | SkateHive",
    description:
      "Free browser-based skateboarding games built by skaters, for skaters. No download required.",
    images: [`${BASE_URL}/images/qfs-ogimage.png`],
  },
  robots: {
    index: true,
    follow: true,
  },
};

function GamesJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "SkateHive Games — Free Skateboarding Games",
    description:
      "A collection of free browser-based skateboarding games built by the SkateHive community.",
    url: `${BASE_URL}/games`,
    publisher: {
      "@type": "Organization",
      name: "SkateHive",
      url: BASE_URL,
    },
    hasPart: [
      {
        "@type": "VideoGame",
        name: "Quest for Stoken",
        description:
          "The OG SkateHive game. Control your skater through challenging levels and collect STOKEN tokens.",
        url: `${BASE_URL}/games/quest-for-stoken`,
        genre: ["Platformer", "Arcade", "Skateboarding"],
        gamePlatform: "Web Browser",
        applicationCategory: "Game",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        author: {
          "@type": "Person",
          name: "webgnar",
        },
        image: `${BASE_URL}/images/qfs-ogimage.png`,
      },
      {
        "@type": "VideoGame",
        name: "Lougnar",
        description:
          "The newest skateboarding game from SkateHive. A fresh take on skate gaming built with Excalibur.js.",
        url: `${BASE_URL}/games/lougnar`,
        genre: ["Action", "Skateboarding"],
        gamePlatform: "Web Browser",
        applicationCategory: "Game",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        author: {
          "@type": "Person",
          name: "webgnar",
        },
        image: `${BASE_URL}/images/lougnar-thumb.jpg`,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export default function GamesPage() {
  return (
    <>
      <GamesJsonLd />
      {/* SSR content block — Google sees this in initial HTML */}
      <div
        data-ssr-seo="true"
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          borderWidth: 0,
        }}
      >
        <h1>Skate Games — Play Free Skateboarding Games Online</h1>
        <p>Play free browser-based skateboarding games built by the SkateHive community. No download needed.</p>
        <h2>Quest for Stoken</h2>
        <p>The OG SkateHive game. Control your skater through challenging levels, collect STOKEN tokens, and compete for high scores. Built by webgnar.</p>
        <h2>Lougnar</h2>
        <p>The newest skateboarding game from SkateHive. A fresh take on skate gaming built with Excalibur.js. Click to jump and dodge obstacles.</p>
        <p>All games are free to play in your browser — no downloads, no signups. Just click and skate.</p>
      </div>
      <GamesGallery />
    </>
  );
}
