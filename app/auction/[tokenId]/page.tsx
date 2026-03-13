import { Metadata } from "next";
import { fetchAuctionByTokenId } from "@/services/auction";
import { AuctionPage } from "@/components/auction";
import {
  generateAuctionMetadata,
  formatBidAmount,
  DEFAULT_AUCTION_METADATA,
} from "@/lib/utils/metadata";
import { DAO_ADDRESSES } from "@/lib/utils/constants";

interface PageProps {
  params: Promise<{
    tokenId: string;
  }>;
}

// Generate metadata for specific auction token pages
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  try {
    const { tokenId: tokenIdParam } = await params;
    const tokenId = Number(tokenIdParam);

    // Validate tokenId
    if (isNaN(tokenId) || tokenId <= 0) {
      return {
        title: `Invalid Token ID - SkateHive`,
        description: `The token ID "${tokenIdParam}" is not valid.`,
      };
    }

    const auction = await fetchAuctionByTokenId(DAO_ADDRESSES.token, tokenId);

    if (!auction) {
      // Check if this might be a missing admin/referral auction
      const isMultipleOf10 = tokenId % 10 === 0;

      return {
        title: `Auction #${tokenId} - ${
          isMultipleOf10 ? "Admin/Referral Auction" : "Not Found"
        }`,
        description: isMultipleOf10
          ? `Auction #${tokenId} appears to be an admin/referral auction that exists on-chain but is not indexed in our subgraph. These auctions are automatically won by the protocol.`
          : `Auction for token #${tokenId} was not found. This auction may not exist, may be from a different DAO, or may have indexing issues.`,
      };
    }

    const { name: tokenName, image: tokenImage } = auction.token;
    const currentBid = auction.highestBid
      ? formatBidAmount(BigInt(auction.highestBid.amount))
      : "0";

    const endTime = new Date(parseInt(auction.endTime) * 1000);
    const isActive = endTime.getTime() > Date.now();

    return generateAuctionMetadata({
      tokenName,
      tokenImage,
      currentBid: `${currentBid} ETH`,
      isActive,
      tokenId,
    });
  } catch (error) {
    console.error("Error generating metadata for auction:", error);
    return DEFAULT_AUCTION_METADATA;
  }
}

export default async function AuctionTokenPage({ params }: PageProps) {
  const { tokenId } = await params;
  const tokenIdNumber = Number(tokenId);

  // Validate that tokenId is a valid number
  if (isNaN(tokenIdNumber) || tokenIdNumber <= 0) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Invalid Token ID</h1>
        <p>The token ID &quot;{tokenId}&quot; is not a valid number.</p>
      </div>
    );
  }

  return <AuctionPage tokenId={tokenIdNumber} showNavigation={true} />;
}
