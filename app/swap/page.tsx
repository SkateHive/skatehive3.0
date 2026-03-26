import { Metadata } from "next";
import SwapPageClient from "./SwapPageClient";
import { APP_CONFIG } from "@/config/app.config";

const swapUrl = `${APP_CONFIG.BASE_URL}/swap`;

export const metadata: Metadata = {
  title: "Swap Tokens — ERC-20 & Hive Token Exchange | Skatehive",
  description:
    "Swap ERC-20 tokens on Base, Ethereum and Arbitrum with best prices from 150+ DEXes. Convert HIVE and HBD. Fast, simple token trading built for skaters.",
  keywords: [
    "token swap",
    "dex aggregator",
    "erc20 swap",
    "skatehive swap",
    "crypto swap skateboarding",
    "base swap",
    "0x swap",
    "hive swap",
    "hbd convert",
    "skateboard crypto",
    "decentralized exchange",
  ],
  openGraph: {
    title: "Swap Tokens — ERC-20 & Hive Exchange | Skatehive",
    description:
      "Swap ERC-20 tokens with best prices from 150+ DEXes. Convert HIVE and HBD. Fast, simple token trading built for skaters.",
    url: swapUrl,
    siteName: "Skatehive",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Swap Tokens — ERC-20 & Hive Exchange | Skatehive",
    description:
      "Swap ERC-20 tokens with best prices from 150+ DEXes. Convert HIVE and HBD. Built for skaters.",
  },
  other: {
    "fc:frame": JSON.stringify({
      version: "next",
      imageUrl: `${APP_CONFIG.BASE_URL}/ogimage.png`,
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
    "fc:frame:image": `${APP_CONFIG.BASE_URL}/ogimage.png`,
    "fc:frame:post_url": swapUrl,
  },
  alternates: {
    canonical: swapUrl,
  },
};

export default function SwapPage() {
  return <SwapPageClient />;
}
