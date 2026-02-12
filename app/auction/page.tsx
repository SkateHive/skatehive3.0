import { Metadata } from "next";
import { fetchAuction } from "@/services/auction";
import { DAO_ADDRESSES } from "@/lib/utils/constants";
import { AuctionPage } from "@/components/auction";
import {
  formatBidAmount,
  NO_AUCTION_METADATA,
  DEFAULT_AUCTION_METADATA,
} from "@/lib/utils/metadata";
import { APP_CONFIG } from "@/config/app.config";

// Generate metadata for the main auction page
export async function generateMetadata(): Promise<Metadata> {
  try {
    // Fetch the latest auction for metadata
    const auctions = await fetchAuction(DAO_ADDRESSES.token);
    const latestAuction = auctions?.[0];

    if (!latestAuction) {
      return NO_AUCTION_METADATA;
    }

    const { name: tokenName, image: tokenImage } = latestAuction.token;
    const currentBid = latestAuction.highestBid
      ? formatBidAmount(BigInt(latestAuction.highestBid.amount))
      : "0";

    const endTime = new Date(parseInt(latestAuction.endTime) * 1000);
    const isActive = endTime.getTime() > Date.now();
    const status = isActive ? "Active" : "Ended";

    const title = `${tokenName} - SkateHive Auction`;
    const description = `${status} auction for ${tokenName}. Current bid: ${currentBid} ETH. Participate in SkateHive auctions to acquire unique skateboarding art and voting rights.`;

    return {
      title,
      description,
      alternates: {
        canonical: `${APP_CONFIG.BASE_URL}/auction`,
      },
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
      other: {
        "fc:frame": JSON.stringify({
          version: "next",
          imageUrl: tokenImage,
          button: {
            title: "Collect Art",
            action: {
              type: "launch_frame",
              name: "Skatehive",
              url: `${APP_CONFIG.ORIGIN}/auction/`,
            },
          },
          postUrl: `${APP_CONFIG.ORIGIN}/auction/`,
        }),
        "fc:frame:image": tokenImage,
        "fc:frame:post_url": `${APP_CONFIG.ORIGIN}/auction/`,
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return DEFAULT_AUCTION_METADATA;
  }
}

export default function MainAuctionPage() {
  return <AuctionPage showNavigation={true} />;
}
