import dynamic from "next/dynamic";
import { Metadata } from "next";
import { APP_CONFIG } from "@/config/app.config";

export const metadata: Metadata = {
  title: "Skate Spot Map — Find Skateparks & Street Spots Near You",
  description:
    "Find skateparks, street spots, and DIY spots worldwide on the Skatehive Skate Map. Community-built by skaters, for skaters. Add your local spots and discover new ones to shred.",
  keywords: [
    "skate spot map",
    "skate map",
    "skatemap",
    "skatespot map",
    "find skate spots",
    "skate spot finder",
    "skateboard map",
    "skateboarding map",
    "skateparks near me",
    "street spots",
    "skate spots near me",
    "global skate spots",
    "skatepark finder",
    "skate spot app",
    "add skate spot",
    "DIY skate spots",
  ],
  openGraph: {
    title: "Skate Spot Map — Find Skateparks & Street Spots Worldwide",
    description:
      "Discover skateparks, street spots, and DIY spots near you. Community-built map by skaters worldwide. Add your spots and explore new ones.",
    url: `${APP_CONFIG.BASE_URL}/map`,
    images: [
      {
        url: `${APP_CONFIG.BASE_URL}/ogimage.png`,
        width: 1200,
        height: 630,
        alt: "Skatehive Skate Spot Map - Find spots worldwide",
      },
    ],
    siteName: "Skatehive",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Spot Map — Find Skateparks & Street Spots Near You",
    description:
      "Community-built skate spot map. Find skateparks, street spots, and DIY spots worldwide. Add your local spots.",
    images: [`${APP_CONFIG.BASE_URL}/ogimage.png`],
  },
  alternates: {
    canonical: `${APP_CONFIG.BASE_URL}/map`,
  },
};

const EmbeddedMap = dynamic(() => import("@/components/spotmap/EmbeddedMap"), { ssr: true });

export default function MapPage() {
  return <EmbeddedMap />;
}
