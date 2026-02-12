import { Metadata } from "next";
import BountiesClient from "@/components/bounties/bountiesClient";
import { APP_CONFIG } from "@/config/app.config";

export const metadata: Metadata = {
  title: "Bounties | Skate Trick Challenges",
  description:
    "Submit and complete skate trick bounties. Post a challenge, submit your trick, and earn respect!",
  keywords: [
    "skate bounties",
    "trick challenges",
    "skateboarding",
    "skatehive",
    "bounty",
    "skate tricks",
  ],
  openGraph: {
    title: "Bounties | Skate Trick Challenges",
    description:
      "Submit and complete skate trick bounties. Post a challenge, submit your trick, and earn respect!",
    url: `${APP_CONFIG.BASE_URL}/bounties`,
    images: [
      {
        url: `${APP_CONFIG.BASE_URL}/ogimage.png`,
        width: 1200,
        height: 630,
        alt: "Skatehive Bounties Open Graph Image",
      },
    ],
    siteName: "Skatehive",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bounties | Skate Trick Challenges",
    description:
      "Submit and complete skate trick bounties. Post a challenge, submit your trick, and earn respect!",
    images: [`${APP_CONFIG.BASE_URL}/ogimage.png`],
  },
  alternates: {
    canonical: `${APP_CONFIG.BASE_URL}/bounties`,
  },
};

export default function BountiesPage() {
  return <BountiesClient />;
} 