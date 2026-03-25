import { Metadata } from "next";
import GameClientPage from "./GameClientPage";

export const metadata: Metadata = {
  title: "Quest for Skateboard - SkateHive Game",
  description:
    "Experience the ultimate skateboarding adventure in Quest for Skateboard! Control your skater through challenging levels, perform epic tricks, and master the art of skateboarding in this immersive browser-based game.",
  keywords: [
    "skateboarding game",
    "skateboard",
    "quest",
    "browser game",
    "skatehive",
    "skating",
    "tricks",
    "skater",
    "sports game",
    "adventure",
  ],
  authors: [{ name: "SkateHive" }],
  creator: "SkateHive",
  publisher: "SkateHive",
  category: "Games",
  openGraph: {
    title: "Quest for Skateboard - SkateHive Game",
    description:
      "Experience the ultimate skateboarding adventure! Control your skater, perform tricks, and master challenging levels in this immersive browser game.",
    type: "website",
    url: "/game",
    siteName: "SkateHive",
    images: [
      {
        url: "/images/qfs-ogimage.png", // You can add an actual game screenshot here
        width: 1200,
        height: 630,
        alt: "Quest for Skateboard Game Preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Quest for Skateboard - SkateHive Game",
    description:
      "Experience the ultimate skateboarding adventure! Control your skater and perform epic tricks.",
    images: ["/images/qfs-ogimage.png"], // Same image as OpenGraph
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: "/images/qfs-ogimage.png",
      button: {
        title: "Play Now",
        action: { type: "launch_frame", name: "Skatehive", url: "https://skatehive.app/game" },
      },
      postUrl: "https://skatehive.app/game",
    }),
    "fc:frame:image": "/images/qfs-ogimage.png",
    "fc:frame:post_url": "https://skatehive.app/game",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f2937",
};

export default function GamePage() {
  return <GameClientPage />;
}
