import { Metadata } from "next";
import QuestForStokenGame from "./QuestForStokenGame";

export const metadata: Metadata = {
  title: "Quest for Stoken — SkateHive Game",
  description:
    "Play Quest for Stoken, the OG SkateHive skateboarding game. Hit fullscreen, land tricks, and chase the stoke.",
  keywords: [
    "quest for stoken",
    "skatehive game",
    "skateboarding game",
    "skate game",
    "browser game",
    "html5 game",
  ],
  openGraph: {
    title: "Quest for Stoken — SkateHive Game",
    description:
      "Play Quest for Stoken, the OG SkateHive skateboarding game.",
    type: "website",
    url: "/games/quest-for-stoken",
    images: [
      {
        url: "/images/qfs-ogimage.png",
        width: 1200,
        height: 630,
        alt: "Quest for Stoken game preview",
      },
    ],
  },
};

export default function QuestForStokenPage() {
  return <QuestForStokenGame />;
}
