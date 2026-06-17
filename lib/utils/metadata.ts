import { Metadata } from "next";
import { formatEther } from "viem";
import { APP_CONFIG } from "@/config/app.config";

interface MiniAppEmbedOptions {
  /** Embed image. Must be 3:2 aspect ratio, 600x400 min / 3000x2000 max, <10MB. */
  imageUrl: string;
  /** Button call-to-action text. Truncated to the 32 char spec limit. */
  buttonTitle: string;
  /** URL the Mini App launches to. */
  url: string;
  /** App name shown in the splash screen. Defaults to "Skatehive". */
  name?: string;
  splashImageUrl?: string;
  splashBackgroundColor?: string;
}

/**
 * Build spec-compliant Farcaster Mini App embed meta tags.
 *
 * Emits both the primary `fc:miniapp` tag (action type `launch_miniapp`) and
 * the backward-compatible `fc:frame` tag (`launch_frame`), per the current
 * Mini Apps sharing spec (https://miniapps.farcaster.xyz/docs/guides/sharing).
 *
 * Note: legacy `version: "next"`, the non-spec `postUrl` field, and the
 * Frames-v1 `fc:frame:image` / `fc:frame:post_url` tags are intentionally
 * dropped — they are not part of the Mini App embed schema.
 */
export function buildMiniAppEmbed({
  imageUrl,
  buttonTitle,
  url,
  name = "Skatehive",
  splashImageUrl,
  splashBackgroundColor,
}: MiniAppEmbedOptions): Record<string, string> {
  const buildEmbed = (type: "launch_miniapp" | "launch_frame") =>
    JSON.stringify({
      version: "1",
      imageUrl,
      button: {
        title: buttonTitle.slice(0, 32),
        action: {
          type,
          name,
          url,
          ...(splashImageUrl ? { splashImageUrl } : {}),
          ...(splashBackgroundColor ? { splashBackgroundColor } : {}),
        },
      },
    });

  return {
    "fc:miniapp": buildEmbed("launch_miniapp"),
    "fc:frame": buildEmbed("launch_frame"),
  };
}

interface AuctionMetadataProps {
  tokenName: string;
  tokenImage: string;
  currentBid: string;
  isActive: boolean;
  tokenId?: number;
}

export const DEFAULT_AUCTION_METADATA: Metadata = {
  title: "SkateHive Auction",
  description:
    "Participate in SkateHive auctions to acquire unique skateboarding art and voting rights.",
};

export const NO_AUCTION_METADATA: Metadata = {
  title: "SkateHive Auction - No Active Auction",
  description: "No active auction available at SkateHive",
};

export function generateAuctionMetadata({
  tokenName,
  tokenImage,
  currentBid,
  isActive,
  tokenId,
}: AuctionMetadataProps): Metadata {
  const status = isActive ? "Active" : "Ended";
  const bidText = isActive ? "Current bid" : "Final bid";
  
  const title = `${tokenName} - SkateHive Auction`;
  const description = tokenId 
    ? `${status} auction for ${tokenName}. ${bidText}: ${currentBid} ETH. View this unique skateboarding art NFT on SkateHive.`
    : `${status} auction for ${tokenName}. ${bidText}: ${currentBid} ETH. Participate in SkateHive auctions to acquire unique skateboarding art and voting rights.`;

  const baseUrl = APP_CONFIG.ORIGIN;
  const auctionUrl = tokenId 
    ? `${baseUrl}/auction/${tokenId}` 
    : `${baseUrl}/auction/`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        {
          url: tokenImage,
          width: 600,
          height: 600,
          alt: tokenName,
        },
      ],
      type: "website",
      siteName: "SkateHive",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [tokenImage],
    },
    other: buildMiniAppEmbed({
      imageUrl: tokenImage,
      buttonTitle: tokenId && isActive ? "Place Bid" : "View Auction",
      url: auctionUrl,
    }),
  };
}

export function formatBidAmount(amount: bigint): string {
  return Number(formatEther(amount)).toLocaleString(undefined, {
    maximumFractionDigits: 5,
  });
}
