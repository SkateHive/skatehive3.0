import { Metadata } from "next";
import BountiesHubClient from "@/components/bounties/BountiesHubClient";
import { APP_CONFIG } from "@/config/app.config";

const ogImageUrl = `${APP_CONFIG.BASE_URL}/api/og/bounty?title=Land+The+Trick.+Get+Paid.&amount=&currency=&status=OPEN&source=poidh&chain=`;
const frameImageUrl = `${APP_CONFIG.BASE_URL}/api/og/bounty?title=Land+The+Trick.+Get+Paid.&amount=&currency=&status=OPEN&source=poidh&chain=&format=frame`;
const bountyUrl = `${APP_CONFIG.BASE_URL}/bounties`;

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
    url: bountyUrl,
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "Skatehive Bounties — Land Tricks, Earn Rewards",
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
    images: [ogImageUrl],
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: frameImageUrl,
      button: {
        title: "View Bounties",
        action: {
          type: "launch_frame",
          name: "Skatehive",
          url: bountyUrl,
        },
      },
      postUrl: bountyUrl,
    }),
    "fc:frame:image": frameImageUrl,
    "fc:frame:post_url": bountyUrl,
  },
  alternates: {
    canonical: bountyUrl,
  },
};

export default function BountiesPage() {
  return <BountiesHubClient />;
}
