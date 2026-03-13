"use client";

import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Skeleton,
  Grid,
  GridItem,
  Button,
  Image,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { fetchAuctions } from "@/lib/dao/auction";
import { DAO_ADDRESSES } from "@/lib/utils/constants";
import { formatEther } from "viem";
import NextLink from "next/link";
import type { Auction } from "@/lib/dao/types";

/**
 * Auction History Component
 * Displays historical auctions for the DAO
 */
export default function AuctionHistory() {
  const { data: auctions, isLoading, error } = useQuery({
    queryKey: ['auctions', DAO_ADDRESSES.token],
    queryFn: () => fetchAuctions(DAO_ADDRESSES.token),
    staleTime: 60000, // 1 minute
  });

  if (isLoading) {
    return (
      <VStack spacing={4} width="full">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} height="150px" width="full" borderRadius="none" />
        ))}
      </VStack>
    );
  }

  if (error) {
    return (
      <Box p={4} border="1px" borderColor="red.500" borderRadius="none">
        <Text color="red.400">Error loading auctions</Text>
      </Box>
    );
  }

  if (!auctions || auctions.length === 0) {
    return (
      <Box p={8} textAlign="center">
        <Text color="gray.400">No auctions found</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={4} width="full">
      {auctions.map((auction) => (
        <AuctionCard key={auction.token.id} auction={auction} />
      ))}
    </VStack>
  );
}

interface AuctionCardProps {
  auction: Auction;
}

function AuctionCard({ auction }: AuctionCardProps) {
  const isActive = parseInt(auction.endTime) * 1000 > Date.now();
  const hasWinner = auction.winningBid || auction.highestBid;
  const winningAmount = auction.winningBid?.amount || auction.highestBid?.amount || '0';
  const winner = auction.winningBid?.bidder || auction.highestBid?.bidder;

  return (
    <Box
      width="full"
      border="1px"
      borderColor="gray.600"
      borderRadius="none"
      p={4}
      _hover={{ borderColor: 'gray.500', bg: 'whiteAlpha.50' }}
      transition="all 0.2s"
    >
      <Grid templateColumns={{ base: '1fr', md: 'auto 1fr auto' }} gap={4}>
        {/* Token Image */}
        <GridItem>
          <Box
            width={{ base: '100%', md: '100px' }}
            height="100px"
            borderRadius="none"
            overflow="hidden"
            bg="gray.800"
          >
            {auction.token.image && (
              <Image
                src={auction.token.image}
                alt={auction.token.name}
                width="100%"
                height="100%"
                objectFit="cover"
              />
            )}
          </Box>
        </GridItem>

        {/* Auction Info */}
        <GridItem>
          <VStack align="start" spacing={2}>
            <HStack spacing={3} flexWrap="wrap">
              <Text fontWeight="bold" fontSize="lg">
                {auction.token.name}
              </Text>
              <Badge
                colorScheme={isActive ? 'green' : auction.settled ? 'blue' : 'gray'}
                borderRadius="none"
              >
                {isActive ? 'Active' : auction.settled ? 'Settled' : 'Ended'}
              </Badge>
            </HStack>

            <Text fontSize="sm" color="gray.400">
              Token #{auction.token.tokenId.toString()}
            </Text>

            {hasWinner && (
              <VStack align="start" spacing={1}>
                <Text fontSize="sm" color="gray.300">
                  Winning Bid: {Number(formatEther(BigInt(winningAmount))).toFixed(4)} ETH
                </Text>
                {winner && (
                  <Text fontSize="xs" color="gray.500">
                    Winner: {winner.slice(0, 6)}...{winner.slice(-4)}
                  </Text>
                )}
              </VStack>
            )}

            <Text fontSize="xs" color="gray.500">
              {auction.bidCount} bid{auction.bidCount !== 1 ? 's' : ''}
            </Text>
          </VStack>
        </GridItem>

        {/* View Button */}
        <GridItem display="flex" alignItems="center">
          <Button
            as={NextLink}
            href={`/auction/${auction.token.tokenId}`}
            size="sm"
            colorScheme="blue"
            variant="outline"
            borderRadius="none"
          >
            View Auction
          </Button>
        </GridItem>
      </Grid>
    </Box>
  );
}
