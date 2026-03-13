import { Metadata } from "next";
import BountiesHubClient from "@/components/bounties/BountiesHubClient";
import { APP_CONFIG } from "@/config/app.config";

export const metadata: Metadata = {
  title: "Skate Trick Bounties — Land Tricks, Earn Rewards",
  description:
    "Take on skate trick challenges and earn crypto rewards. Post a bounty for any trick, submit your clip landing it, and get paid. Real challenges from real skaters.",
  keywords: [
    "skate bounties",
    "trick challenges",
    "skateboarding challenges",
    "earn skating",
    "skate trick contest",
    "skateboard rewards",
    "crypto skateboarding",
    "skate tricks",
    "land tricks earn money",
  ],
  openGraph: {
    title: "Skate Trick Bounties — Land Tricks, Earn Rewards | Skatehive",
    description:
      "Take on skate trick challenges and earn crypto rewards. Post a bounty, submit your clip, get paid. Real challenges from real skaters.",
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
    title: "Skate Trick Bounties — Land Tricks, Earn Rewards | Skatehive",
    description:
      "Take on skate trick challenges and earn crypto rewards. Post a bounty, submit your clip, get paid.",
    images: [`${APP_CONFIG.BASE_URL}/ogimage.png`],
  },
  alternates: {
    canonical: `${APP_CONFIG.BASE_URL}/bounties`,
  },
};

export default function BountiesPage() {
  return <BountiesHubClient />;
}
