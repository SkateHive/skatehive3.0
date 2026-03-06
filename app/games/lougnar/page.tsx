import { Metadata } from "next";
import LougnarGame from "./LougnarGame";

export const metadata: Metadata = {
  title: "Lougnar — Skateboarding Game | Skatehive",
  description:
    "Play Lougnar, the newest skateboarding game from the SkateHive community. Built by webgnar with Excalibur.js.",
  keywords: [
    "lougnar",
    "skateboarding game",
    "skate game",
    "browser game",
    "skatehive",
    "excalibur",
    "webgnar",
  ],
  openGraph: {
    title: "Lougnar — Skateboarding Game",
    description:
      "Play Lougnar, the newest skateboarding game from the SkateHive community.",
    type: "website",
    url: "/games/lougnar",
  },
};

export default function LougnarPage() {
  return <LougnarGame />;
}
