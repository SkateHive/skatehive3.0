"use client";

import { useLastAuction } from "@/hooks/auction";
import { Auction } from "@/services/auction";
import { formatEther } from "viem";
import { AuctionBid } from "./AuctionBid";
import { useMemo } from "react";
import Countdown from "react-countdown";
import { DAO_ADDRESSES } from "@/lib/utils/constants";
import { useTranslations } from '@/lib/i18n/hooks';
import {
  Box,
  VStack,
  HStack,
  Text,
  Image,
  Badge,
  Spinner,
  Divider,
  Link,
} from "@chakra-ui/react";

interface AuctionCardProps {
  tokenAddress?: string;
  defaultAuction?: Auction;
}

const formatBidAmount = (amount: bigint) => {
  return Number(formatEther(amount)).toLocaleString(undefined, {
    maximumFractionDigits: 5,
  });
};

const formatAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const isAuctionActive = (endTime: string) => {
  return parseInt(endTime) * 1000 > Date.now();
};

export default function AuctionCard({
  tokenAddress = DAO_ADDRESSES.token,
  defaultAuction,
}: AuctionCardProps) {
  const t = useTranslations('auction');
  const {
    data: activeAuction,
    refetch,
    isLoading,
  } = useLastAuction(tokenAddress, defaultAuction);

  const auctionData = useMemo(() => {
    if (!activeAuction) return null;

    const endTime = parseInt(activeAuction.endTime) * 1000;
    const isRunning = isAuctionActive(activeAuction.endTime);
    const bidAmount = activeAuction.highestBid
      ? formatBidAmount(BigInt(activeAuction.highestBid.amount))
      : "0";

    return { endTime, isRunning, bidAmount };
  }, [activeAuction]);

  if (isLoading) {
    return (
      <Box
        bg="secondary"
        borderRadius="none"
        border="1px solid"
        borderColor="border"
        p={6}
        textAlign="center"
      >
        <VStack spacing={4}>
          <Spinner size="xl" color="primary" />
          <Text color="text">{t('loading')}</Text>
        </VStack>
      </Box>
    );
  }

  if (!activeAuction || !auctionData) {
    return (
      <Box
        bg="secondary"
        borderRadius="none"
        border="1px solid"
        borderColor="border"
        p={6}
        textAlign="center"
      >
        <Text color="muted">{t('noActiveAuction')}</Text>
      </Box>
    );
  }

  return (
    <Box p={{ base: 4, md: 6 }}>
      <VStack spacing={{ base: 4, md: 6 }} align="stretch">
        {/* Token Info - Centered artwork above details */}
        <VStack spacing={{ base: 3, md: 4 }} align="center">
          <Box 
            position="relative" 
            width={{ base: "100%", md: "500px", lg: "600px" }}
            height={{ base: "auto", md: "500px", lg: "600px" }}
            maxW="600px"
            maxH="600px"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <Image
              src={activeAuction.token.image}
              alt={activeAuction.token.name}
              width="100%"
              height="100%"
              aspectRatio="1"
              objectFit="cover"
              fallbackSrc="/images/placeholder.png"
            />
          </Box>
          <VStack align="center" spacing={2} textAlign="center">
            <Text 
              fontSize={{ base: "lg", md: "xl" }} 
              fontWeight="bold" 
              color="text"
              lineHeight="tight"
            >
              {activeAuction.token.name.includes(
                `#${activeAuction.token.tokenId.toString()}`
              )
                ? activeAuction.token.name
                : `${
                    activeAuction.token.name
                  } #${activeAuction.token.tokenId.toString()}`}
            </Text>
            {activeAuction.highestBid && (
              <VStack align="center" spacing={2}>
                <Text fontSize={{ base: "md", md: "lg" }} fontWeight="semibold" color="success">
                  {t('currentBid')} {auctionData.bidAmount} ETH
                </Text>
                <HStack spacing={2}>
                  <Text fontSize="sm" color="muted">
                    {t('by')}
                  </Text>
                  <Text fontSize="sm" fontWeight="medium" color="text">
                    {formatAddress(activeAuction.highestBid.bidder)}
                  </Text>
                </HStack>
              </VStack>
            )}
            {!activeAuction.highestBid && (
              <Text fontSize="sm" color="muted">
                {t('noBidsYet')}
              </Text>
            )}
          </VStack>
        </VStack>

        <Divider borderColor="border" />

        {/* Auction Status */}
        <VStack spacing={{ base: 3, md: 4 }}>
          <HStack justify="space-between" w="full">
            <Text fontSize="sm" fontWeight="medium" color="text">
              {auctionData.isRunning ? t('timeRemaining') : t('auctionHas')}
            </Text>
            {auctionData.isRunning && (
              <Countdown
                date={auctionData.endTime}
                renderer={({ days, hours, minutes, seconds, completed }) => {
                  if (completed) {
                    return (
                      <Text color="error" fontFamily="mono" fontSize={{ base: "sm", md: "md" }}>
                        {t('ended')}
                      </Text>
                    );
                  }

                  return (
                    <Text 
                      fontSize={{ base: "md", md: "lg" }} 
                      fontFamily="mono" 
                      color="primary"
                      fontWeight="bold"
                    >
                      {days > 0 && `${days}d `}
                      {String(hours).padStart(2, "0")}:
                      {String(minutes).padStart(2, "0")}:
                      {String(seconds).padStart(2, "0")}
                    </Text>
                  );
                }}
                onComplete={() => refetch()}
              />
            )}
          </HStack>

          {/* Bid Count */}
          <HStack justify="space-between" w="full">
            <Text fontSize="sm" color="text">
              {t('totalBids')} {activeAuction.bidCount}
            </Text>
            <Text fontSize="sm" color="text">
              {t('reservePrice')}{" "}
              {formatBidAmount(
                BigInt(activeAuction.dao.auctionConfig.reservePrice)
              )}{" "}
              ETH
            </Text>
          </HStack>
        </VStack>

        <Divider borderColor="border" />

        {/* Bidding Interface */}
        <Box>
          <AuctionBid
            tokenId={activeAuction.token.tokenId}
            winningBid={
              activeAuction.highestBid?.amount
                ? BigInt(activeAuction.highestBid.amount)
                : 0n
            }
            isAuctionRunning={auctionData.isRunning}
            reservePrice={activeAuction.dao.auctionConfig.reservePrice}
            minimumBidIncrement={
              activeAuction.dao.auctionConfig.minimumBidIncrement
            }
            onBid={refetch}
            onSettle={refetch}
            bids={activeAuction.bids || []}
          />
        </Box>

        {/* Auction History */}
        {activeAuction.bids && activeAuction.bids.length > 0 && (
          <>
            <Divider borderColor="border" />
            <VStack align="stretch" spacing={3}>
              <Text fontWeight="medium" color="text" fontSize={{ base: "sm", md: "md" }}>
                Recent Bids
              </Text>
              <VStack
                spacing={2}
                maxH={{ base: "120px", md: "160px" }}
                overflowY="auto"
                className="hide-scrollbar"
              >
                {activeAuction.bids
                  .slice(-5)
                  .reverse()
                  .map((bid, index) => (
                    <HStack
                      key={index}
                      justify="space-between"
                      w="full"
                      py={{ base: 2, md: 3 }}
                      px={{ base: 3, md: 4 }}
                      bg="muted"
                      borderRadius="none"
                    >
                      <HStack spacing={{ base: 2, md: 4 }}>
                        <Text fontSize="sm" fontWeight="bold" color="primary">
                          {formatAddress(bid.bidder)}
                        </Text>
                        <Text fontSize="sm" fontWeight="medium" color="text">
                          {formatBidAmount(BigInt(bid.amount))} ETH
                        </Text>
                      </HStack>
                      <Text fontSize="xs" color="muted">
                        {new Date(
                          parseInt(bid.bidTime) * 1000
                        ).toLocaleTimeString()}
                      </Text>
                    </HStack>
                  ))}
              </VStack>
            </VStack>
          </>
        )}
      </VStack>
    </Box>
  );
}
