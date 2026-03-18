"use client";

import { AuctionBid, BidsModal } from "./";
import { AdminAuctionPage } from "./AdminAuctionPage";
import { fetchAuctionByTokenId, fetchAuction } from "@/services/auction";
import { fetchAuctions } from "@/lib/dao/auction";
import { useQuery } from "@tanstack/react-query";
import { DAO_ADDRESSES } from "@/lib/utils/constants";
import { formatEther } from "viem";
import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/hooks";
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Heading,
  Flex,
  useBreakpointValue,
  Image,
  Spinner,
  Button,
  Avatar,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaChevronLeft, FaChevronRight, FaEthereum, FaGavel, FaTrophy } from "react-icons/fa";
import NextLink from "next/link";
import {
  EnsName as Name,
  EnsAvatar,
} from "@/components/shared/EnsIdentity";

// ─── Animations ───
const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.85; transform: scale(1.02); }
`;

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(167,255,0,0.15); }
  50% { box-shadow: 0 0 40px rgba(167,255,0,0.35); }
`;

const urgentPulse = keyframes`
  0%, 100% { color: var(--chakra-colors-primary); }
  50% { color: var(--chakra-colors-error, #ff4444); }
`;

// ─── Helpers ───
const formatBidAmount = (amount: bigint) =>
  Number(formatEther(amount)).toLocaleString(undefined, { maximumFractionDigits: 5 });

const isAuctionActive = (endTime: string) =>
  parseInt(endTime) * 1000 > Date.now();

// ─── Countdown Timer Component ───
function AuctionCountdown({
  endTime,
  onComplete,
}: {
  endTime: number;
  onComplete: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, endTime - Date.now()));
  const completedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0 && !completedRef.current) {
        completedRef.current = true;
        clearInterval(interval);
        onComplete();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime, onComplete]);

  if (timeLeft <= 0) {
    return (
      <Text
        fontSize={{ base: "4xl", md: "6xl", lg: "7xl" }}
        fontWeight="900"
        color="error"
        fontFamily="mono"
        letterSpacing="wider"
        textAlign="center"
      >
        ENDED
      </Text>
    );
  }

  const totalSeconds = Math.floor(timeLeft / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Urgency: flash when < 5 minutes
  const isUrgent = totalSeconds < 300;
  // Very urgent: < 1 minute
  const isVeryUrgent = totalSeconds < 60;

  const digitStyle = {
    fontSize: { base: "3xl", md: "5xl", lg: "6xl" },
    fontWeight: "900",
    fontFamily: "'Joystix', 'VT323', 'Fira Mono', monospace",
    lineHeight: 1,
    minW: { base: "48px", md: "72px", lg: "88px" },
    textAlign: "center" as const,
  };

  const separatorStyle = {
    fontSize: { base: "2xl", md: "4xl", lg: "5xl" },
    fontWeight: "900",
    fontFamily: "'Joystix', 'VT323', 'Fira Mono', monospace",
    lineHeight: 1,
    color: "gray.600",
    alignSelf: "flex-start" as const,
  };

  const labelStyle = {
    fontSize: { base: "2xs", md: "xs" },
    color: "gray.500",
    fontFamily: "mono",
    textTransform: "uppercase" as const,
    letterSpacing: "widest",
  };

  return (
    <HStack
      spacing={{ base: 1, md: 3, lg: 4 }}
      justify="center"
      flexWrap="nowrap"
      animation={isVeryUrgent ? `${urgentPulse} 0.5s ease infinite` : isUrgent ? `${urgentPulse} 1s ease infinite` : undefined}
    >
      {days > 0 && (
        <>
          <VStack spacing={0}>
            <Text {...digitStyle} color="primary">{String(days).padStart(2, "0")}</Text>
            <Text {...labelStyle}>days</Text>
          </VStack>
          <Text {...separatorStyle}>:</Text>
        </>
      )}
      <VStack spacing={0}>
        <Text {...digitStyle} color="primary">{String(hours).padStart(2, "0")}</Text>
        <Text {...labelStyle}>hrs</Text>
      </VStack>
      <Text {...separatorStyle}>:</Text>
      <VStack spacing={0}>
        <Text {...digitStyle} color="primary">{String(minutes).padStart(2, "0")}</Text>
        <Text {...labelStyle}>min</Text>
      </VStack>
      <Text {...separatorStyle}>:</Text>
      <VStack spacing={0}>
        <Text
          {...digitStyle}
          color={isUrgent ? "error" : "primary"}
          animation={isUrgent ? `${pulse} 1s ease infinite` : undefined}
        >
          {String(seconds).padStart(2, "0")}
        </Text>
        <Text {...labelStyle}>sec</Text>
      </VStack>
    </HStack>
  );
}

// ─── Recent Winners Strip ───
function RecentWinners() {
  const { data: auctions } = useQuery({
    queryKey: ["auctions-history", DAO_ADDRESSES.token],
    queryFn: () => fetchAuctions(DAO_ADDRESSES.token),
    staleTime: 60000,
  });

  const settledAuctions = useMemo(() => {
    if (!auctions) return [];
    return auctions
      .filter((a: any) => a.settled && a.winningBid?.bidder)
      .slice(0, 5);
  }, [auctions]);

  if (settledAuctions.length === 0) return null;

  return (
    <Box w="full" maxW="6xl" mx="auto">
      <HStack spacing={2} mb={3}>
        <FaTrophy color="var(--chakra-colors-primary)" />
        <Text fontFamily="mono" fontSize="xs" color="primary" textTransform="uppercase" letterSpacing="widest">
          Recent Winners
        </Text>
      </HStack>
      <HStack
        spacing={3}
        overflowX="auto"
        pb={2}
        sx={{
          "&::-webkit-scrollbar": { height: "2px" },
          "&::-webkit-scrollbar-thumb": { background: "var(--chakra-colors-primary)" },
        }}
      >
        {settledAuctions.map((auction: any) => (
          <Box
            key={auction.token.tokenId.toString()}
            as={NextLink}
            href={`/auction/${auction.token.tokenId}`}
            minW="160px"
            border="1px solid"
            borderColor="border"
            p={3}
            _hover={{ borderColor: "primary", bg: "rgba(167,255,0,0.03)" }}
            transition="all 0.15s"
            cursor="pointer"
          >
            <HStack spacing={2} mb={2}>
              <Image
                src={auction.token.image}
                alt={auction.token.name}
                w="32px"
                h="32px"
                objectFit="cover"
              />
              <VStack spacing={0} align="start" flex={1}>
                <Text fontFamily="mono" fontSize="2xs" color="gray.500">
                  #{auction.token.tokenId.toString()}
                </Text>
                <Text fontFamily="mono" fontSize="xs" color="primary" fontWeight="bold">
                  {formatBidAmount(BigInt(auction.winningBid.amount))} Ξ
                </Text>
              </VStack>
            </HStack>
            <HStack spacing={1}>
              <EnsAvatar address={auction.winningBid.bidder} size={16} />
              <Text fontFamily="mono" fontSize="2xs" color="text" noOfLines={1}>
                <Name address={auction.winningBid.bidder} />
              </Text>
            </HStack>
          </Box>
        ))}
      </HStack>
    </Box>
  );
}

// ─── Main Auction Page ───
interface AuctionPageProps {
  tokenId?: number;
  showNavigation?: boolean;
}

export default function AuctionPage({
  tokenId,
  showNavigation = false,
}: AuctionPageProps) {
  const t = useTranslations("auction");
  const isMobile = useBreakpointValue({ base: true, md: false });
  const router = useRouter();

  const {
    data: activeAuction,
    refetch,
    isLoading,
    error,
  } = useQuery({
    queryKey: tokenId ? ["auction", tokenId] : ["auction", "latest"],
    queryFn: async () => {
      if (tokenId !== undefined) {
        return await fetchAuctionByTokenId(DAO_ADDRESSES.token, tokenId);
      }
      const auctions = await fetchAuction(DAO_ADDRESSES.token);
      return auctions[0] || null;
    },
    staleTime: 0,
  });

  const [isBidsModalOpen, setIsBidsModalOpen] = useState(false);

  const currentTokenId =
    tokenId || (activeAuction ? Number(activeAuction.token.tokenId) : undefined);

  const { data: latestAuction } = useQuery({
    queryKey: ["auction", "latest-check"],
    queryFn: async () => {
      const auctions = await fetchAuction(DAO_ADDRESSES.token);
      return auctions[0] || null;
    },
    staleTime: 0,
  });

  const isLatestAuction =
    latestAuction &&
    activeAuction &&
    Number(latestAuction.token.tokenId) === Number(activeAuction.token.tokenId);

  const handlePrev = () => {
    if (currentTokenId && currentTokenId > 1) router.push(`/auction/${currentTokenId - 1}`);
  };
  const handleNext = () => {
    if (currentTokenId) router.push(`/auction/${currentTokenId + 1}`);
  };

  const auctionData = useMemo(() => {
    if (!activeAuction) return null;
    const endTime = parseInt(activeAuction.endTime) * 1000;
    const isRunning = isAuctionActive(activeAuction.endTime);
    const bidAmount = activeAuction.highestBid
      ? formatBidAmount(BigInt(activeAuction.highestBid.amount))
      : "0";
    return { endTime, isRunning, bidAmount };
  }, [activeAuction]);

  // ─── Loading / Error / Not Found ───
  if (isLoading) {
    return (
      <Box bg="background" minH="100vh" display="flex" alignItems="center" justifyContent="center">
        <VStack spacing={4}>
          <Spinner size="xl" color="primary" />
          <Text color="text" fontFamily="mono">{t("loading")}</Text>
        </VStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box bg="background" minH="100vh" display="flex" alignItems="center" justifyContent="center">
        <Text color="error" fontFamily="mono">{t("errorLoading")}</Text>
      </Box>
    );
  }

  if (!activeAuction || !auctionData) {
    if (tokenId && tokenId % 10 === 0) {
      return <AdminAuctionPage tokenId={tokenId} showNavigation={showNavigation} onPrev={handlePrev} onNext={handleNext} />;
    }
    return (
      <Box bg="background" minH="100vh" display="flex" alignItems="center" justifyContent="center">
        <Text color="gray.500" fontFamily="mono">{t("noActiveAuction")}</Text>
      </Box>
    );
  }

  return (
    <Box bg="background" minH="100vh" py={{ base: 4, md: 8 }}>
      <Container maxW="6xl" px={{ base: 3, md: 6 }}>
        <VStack spacing={{ base: 6, md: 10 }}>

          {/* ── Header with Navigation ── */}
          <HStack w="full" justify="space-between" align="center">
            {showNavigation && (
              <Button
                variant="ghost"
                size="sm"
                color="primary"
                onClick={handlePrev}
                isDisabled={!currentTokenId || currentTokenId <= 1}
                fontFamily="mono"
              >
                <FaChevronLeft />
              </Button>
            )}
            <VStack spacing={0} flex={1}>
              <Heading
                fontSize={{ base: "2xl", md: "4xl" }}
                color="primary"
                fontFamily="'Joystix', 'VT323', 'Fira Mono', monospace"
                textTransform="uppercase"
                textAlign="center"
              >
                AUCTION #{activeAuction.token.tokenId.toString()}
              </Heading>
              <Text fontFamily="mono" fontSize="xs" color="gray.500">
                {activeAuction.token.name}
              </Text>
            </VStack>
            {showNavigation && (
              <Button
                variant="ghost"
                size="sm"
                color="primary"
                onClick={handleNext}
                isDisabled={isLatestAuction ?? false}
                fontFamily="mono"
              >
                <FaChevronRight />
              </Button>
            )}
          </HStack>

          {/* ── Main Hero: Artwork + Timer + Bid ── */}
          <Flex
            direction={{ base: "column", lg: "row" }}
            gap={{ base: 6, lg: 10 }}
            w="full"
            align={{ base: "center", lg: "start" }}
          >
            {/* Artwork */}
            <Box
              position="relative"
              w={{ base: "100%", md: "340px", lg: "440px" }}
              flexShrink={0}
              animation={`${glowPulse} 3s ease infinite`}
              border="1px solid"
              borderColor="border"
            >
              <Image
                src={activeAuction.token.image}
                alt={activeAuction.token.name}
                w="full"
                aspectRatio="1"
                objectFit="cover"
                fallbackSrc="/images/placeholder.png"
              />
              {/* Winner stamp on ended auctions */}
              {!auctionData.isRunning && activeAuction.highestBid && (
                <Box
                  position="absolute"
                  bottom={3}
                  left={3}
                  right={3}
                  bg="rgba(0,0,0,0.85)"
                  border="1px solid"
                  borderColor="primary"
                  p={3}
                >
                  <HStack justify="space-between">
                    <HStack spacing={2}>
                      <FaTrophy color="var(--chakra-colors-primary)" />
                      <Text fontFamily="mono" fontSize="xs" color="primary">WINNER</Text>
                    </HStack>
                    <HStack spacing={2}>
                      <EnsAvatar address={activeAuction.highestBid.bidder} size={20} />
                      <Name
                        address={activeAuction.highestBid.bidder}
                        style={{ color: "var(--chakra-colors-text)", fontFamily: "monospace", fontSize: "12px" }}
                      />
                    </HStack>
                    <Text fontFamily="mono" fontSize="sm" color="primary" fontWeight="bold">
                      {auctionData.bidAmount} Ξ
                    </Text>
                  </HStack>
                </Box>
              )}
            </Box>

            {/* Right side: Timer + Current Bid + Bid Form */}
            <VStack flex={1} spacing={{ base: 5, md: 8 }} align="stretch" w="full" overflow="hidden" minW={0}>

              {/* Countdown Timer — THE STAR */}
              <VStack spacing={2}>
                <Text fontFamily="mono" fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="widest">
                  {auctionData.isRunning ? "Auction ends in" : "Auction ended"}
                </Text>
                {auctionData.isRunning ? (
                  <AuctionCountdown endTime={auctionData.endTime} onComplete={() => refetch()} />
                ) : (
                  <Text
                    fontSize={{ base: "4xl", md: "6xl" }}
                    fontWeight="900"
                    color="error"
                    fontFamily="'Joystix', 'VT323', 'Fira Mono', monospace"
                  >
                    ENDED
                  </Text>
                )}
              </VStack>

              {/* Current Bid Display */}
              <Box
                border="1px solid"
                borderColor="primary"
                p={{ base: 4, md: 6 }}
                bg="rgba(167,255,0,0.03)"
              >
                <VStack spacing={1}>
                  <Text fontFamily="mono" fontSize="xs" color="gray.500" textTransform="uppercase" letterSpacing="widest">
                    {auctionData.isRunning ? "Current Bid" : "Winning Bid"}
                  </Text>
                  <HStack spacing={2} align="baseline">
                    <FaEthereum color="#627EEA" size={24} />
                    <Text
                      fontSize={{ base: "3xl", md: "5xl" }}
                      fontWeight="900"
                      color="text"
                      fontFamily="mono"
                      lineHeight={1}
                    >
                      {auctionData.bidAmount}
                    </Text>
                    <Text fontSize={{ base: "lg", md: "2xl" }} color="gray.500" fontFamily="mono">
                      ETH
                    </Text>
                  </HStack>
                  <Text fontFamily="mono" fontSize="xs" color="gray.500">
                    {activeAuction.bidCount || activeAuction.bids?.length || 0} bid{(activeAuction.bidCount || activeAuction.bids?.length || 0) !== 1 ? "s" : ""}
                  </Text>
                </VStack>
              </Box>

              {/* Bid Form */}
              <AuctionBid
                tokenId={activeAuction.token.tokenId}
                winningBid={
                  activeAuction.highestBid?.amount
                    ? BigInt(activeAuction.highestBid.amount)
                    : 0n
                }
                isAuctionRunning={auctionData.isRunning}
                reservePrice={activeAuction.dao.auctionConfig.reservePrice}
                minimumBidIncrement={activeAuction.dao.auctionConfig.minimumBidIncrement}
                onBid={refetch}
                onSettle={refetch}
                alignContent="left"
                bids={activeAuction.bids || []}
                isLatestAuction={isLatestAuction ?? false}
              />
            </VStack>
          </Flex>

          {/* ── Recent Winners ── */}
          <RecentWinners />

        </VStack>
      </Container>

      {/* Bids Modal */}
      {activeAuction?.bids && (
        <BidsModal
          isOpen={isBidsModalOpen}
          onClose={() => setIsBidsModalOpen(false)}
          bids={activeAuction.bids}
          tokenName={activeAuction.token.name}
          tokenId={activeAuction.token.tokenId.toString()}
        />
      )}
    </Box>
  );
}
