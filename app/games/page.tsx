import { Metadata } from "next";
import GamesGallery from "./GamesGallery";

export const metadata: Metadata = {
  title: "Skate Games — Play Free Skateboarding Games | Skatehive",
  description:
    "Play free skateboarding games built by the SkateHive community. Quest for Stoken, Lougnar, and more browser-based skate games.",
  keywords: [
    "skateboarding games",
    "skate games",
    "free skate game",
    "browser skateboard game",
    "skatehive games",
    "quest for stoken",
    "lougnar",
    "web3 games",
    "skateboarding",
  ],
  openGraph: {
    title: "Skate Games — Play Free Skateboarding Games",
    description:
      "Play free skateboarding games built by the SkateHive community.",
    type: "website",
    url: "/games",
    siteName: "SkateHive",
  },
  twitter: {
    card: "summary_large_image",
    title: "Skate Games — SkateHive",
    description:
      "Play free skateboarding games built by skaters, for skaters.",
  },
};

export default function GamesPage() {
  return <GamesGallery />;
}
