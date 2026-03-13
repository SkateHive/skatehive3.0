"use client";

import { AuctionBid } from "./AuctionBid";
import AuctionCard from "./AuctionCard";
import { useLastAuction } from "@/hooks/auction";
import { DAO_ADDRESSES } from "@/lib/utils/constants";
import {
  Box,
  VStack,
  HStack,
  Text,
  Heading,
  Image,
  Spinner,
} from "@chakra-ui/react";

// Simple integration example - can be used in any existing component
export function AuctionWidget() {
  const { data: auction, isLoading } = useLastAuction(DAO_ADDRESSES.token);

  if (isLoading) {
    return (
      <Box textAlign="center" py={8}>
        <Spinner size="xl" color="primary" />
      </Box>
    );
  }

  if (!auction) {
    return (
      <Box textAlign="center" p={8}>
        <Text color="muted">No auction available</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      <Heading size="xl" color="primary">
        Current Auction
      </Heading>
      <AuctionCard tokenAddress={DAO_ADDRESSES.token} />
    </VStack>
  );
}

// Minimal bid-only component for integration
export function QuickBidWidget() {
  const { data: auction, refetch } = useLastAuction(DAO_ADDRESSES.token);

  if (!auction) return null;

  const isRunning = parseInt(auction.endTime) * 1000 > Date.now();

  return (
    <Box
      bg="secondary"
      borderRadius="md"
      border="1px solid"
      borderColor="border"
      p={4}
      shadow="sm"
    >
      <VStack spacing={4}>
        <HStack spacing={4} align="center" w="full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <Image
            src={auction.token.image}
            alt={auction.token.name}
            boxSize="64px"
            borderRadius="none"
            objectFit="cover"
          />
          <VStack align="start" spacing={1}>
            <Text fontWeight="semibold" color="text">
              {auction.token.name}
            </Text>
            <Text fontSize="sm" color="muted">
              #{auction.token.tokenId.toString()}
            </Text>
          </VStack>
        </HStack>

        <AuctionBid
          tokenId={auction.token.tokenId}
          winningBid={
            auction.highestBid?.amount ? BigInt(auction.highestBid.amount) : 0n
          }
          isAuctionRunning={isRunning}
          reservePrice={auction.dao.auctionConfig.reservePrice}
          minimumBidIncrement={auction.dao.auctionConfig.minimumBidIncrement}
          onBid={refetch}
          onSettle={refetch}
          bids={auction.bids || []}
        />
      </VStack>
    </Box>
  );
}
