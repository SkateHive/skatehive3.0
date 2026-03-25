import { Metadata } from "next";
import SwapPageClient from "./SwapPageClient";
import { APP_CONFIG } from "@/config/app.config";

const swapUrl = `${APP_CONFIG.BASE_URL}/swap`;

export const metadata: Metadata = {
  title: "Swap Tokens — Trade & Fund Skateparks | Skatehive",
  description:
    "Swap ERC-20 tokens on Base, Ethereum and Arbitrum with best prices from 150+ DEXes. Every swap sends a small fee to the Skatehive treasury — funding skateparks, obstacles, sponsorships and public goods for skaters worldwide.",
  keywords: [
    "token swap",
    "dex aggregator",
    "erc20 swap",
    "skatehive swap",
    "crypto swap skateboarding",
    "base swap",
    "0x swap",
    "fund skateparks",
    "skate public goods",
    "hive swap",
    "skateboard crypto",
    "decentralized exchange",
  ],
  openGraph: {
    title: "Swap Tokens — Trade & Fund Skateparks | Skatehive",
    description:
      "Swap ERC-20 tokens with best prices from 150+ DEXes. A small fee from every swap funds skateparks, obstacles, sponsorships and public goods for skaters worldwide.",
    url: swapUrl,
    siteName: "Skatehive",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Swap Tokens — Trade & Fund Skateparks | Skatehive",
    description:
      "Swap ERC-20 tokens with best prices from 150+ DEXes. Every swap helps fund skateparks, obstacles and sponsorships.",
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${APP_CONFIG.BASE_URL}/api/og/bounty?title=Swap+Tokens.+Fund+Skateparks.&amount=0.5%25&currency=FEE&status=OPEN&source=0x&chain=`,
      button: {
        title: "Swap Now",
        action: {
          type: "launch_frame",
          name: "Skatehive",
          url: swapUrl,
        },
      },
      postUrl: swapUrl,
    }),
    "fc:frame:image": `${APP_CONFIG.BASE_URL}/api/og/bounty?title=Swap+Tokens.+Fund+Skateparks.&amount=0.5%25&currency=FEE&status=OPEN&source=0x&chain=`,
    "fc:frame:post_url": swapUrl,
  },
  alternates: {
    canonical: swapUrl,
  },
};

export default function SwapPage() {
  return <SwapPageClient />;
}
