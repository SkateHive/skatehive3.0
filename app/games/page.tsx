import { Metadata } from "next";
import dynamic from "next/dynamic";

// Lazy load games gallery (heavy game assets)
const GamesGallery = dynamic(() => import("./GamesGallery"));

const BASE_URL = "https://skatehive.app";

export const metadata: Metadata = {
  title: "Free Skateboarding Games Online, Play in Your Browser | SkateHive",
  description:
    "Play free skateboarding games online with SkateHive. Jump into Quest for Stoken and Lougnar instantly in your browser, no download or signup required.",
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
    title: "Free Skateboarding Games Online | SkateHive",
    description:
      "Play Quest for Stoken and Lougnar free in your browser. No download, no signup, just click and skate.",
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
    title: "Play Free Skateboarding Games Online | SkateHive",
    description:
      "Free browser skate games by the SkateHive community. Play instantly, no download needed.",
    images: [`${BASE_URL}/images/qfs-ogimage.png`],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${BASE_URL}/images/qfs-ogimage.png`,
      button: {
        title: "Play Games",
        action: { type: "launch_frame", name: "Skatehive", url: `${BASE_URL}/games` },
      },
      postUrl: `${BASE_URL}/games`,
    }),
    "fc:frame:image": `${BASE_URL}/images/qfs-ogimage.png`,
    "fc:frame:post_url": `${BASE_URL}/games`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

function GamesJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${BASE_URL}/games#webpage`,
        name: "SkateHive Games",
        description:
          "Play free skateboarding games online in your browser, including Quest for Stoken and Lougnar.",
        url: `${BASE_URL}/games`,
        isPartOf: {
          "@type": "WebSite",
          name: "SkateHive",
          url: BASE_URL,
        },
        about: {
          "@type": "Thing",
          name: "Skateboarding games",
        },
        breadcrumb: {
          "@id": `${BASE_URL}/games#breadcrumb`,
        },
        mainEntity: {
          "@id": `${BASE_URL}/games#itemlist`,
        },
        publisher: {
          "@type": "Organization",
          name: "SkateHive",
          url: BASE_URL,
        },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${BASE_URL}/games#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: BASE_URL,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Games",
            item: `${BASE_URL}/games`,
          },
        ],
      },
      {
        "@type": "ItemList",
        "@id": `${BASE_URL}/games#itemlist`,
        name: "Free Skateboarding Games",
        itemListOrder: "https://schema.org/ItemListOrderAscending",
        numberOfItems: 2,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            url: `${BASE_URL}/games/quest-for-stoken`,
            item: {
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
          },
          {
            "@type": "ListItem",
            position: 2,
            url: `${BASE_URL}/games/lougnar`,
            item: {
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
          },
        ],
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

export const revalidate = 300; // ISR: render once, refresh every 5 min (static-safe page)

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
        <h1>Free Skateboarding Games Online</h1>
        <p>Play free skateboarding games online from the SkateHive community. Start instantly in your browser, no download or signup needed.</p>
        <h2>Quest for Stoken</h2>
        <p>The OG SkateHive game. Control your skater through challenging levels, collect STOKEN tokens, and compete for high scores. Built by webgnar.</p>
        <h2>Lougnar</h2>
        <p>The newest skateboarding game from SkateHive. A fresh take on skate gaming built with Excalibur.js. Click to jump and dodge obstacles.</p>
        <p>Discover browser skate games made by skaters, including arcade and action titles you can play right away. All games are free, fast to load, and easy to jump into.</p>
      </div>
      <GamesGallery />
    </>
  );
}
