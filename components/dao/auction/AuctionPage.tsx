"use client";

import { AuctionBid, BidsModal } from "./";
import { AuctionHeader } from "./AuctionHeader";
import { AdminAuctionPage } from "./AdminAuctionPage";
import AuctionMobileNavbar from "./AuctionMobileNavbar";
import { fetchAuctionByTokenId, fetchAuction } from "@/services/auction";
import { useQuery } from "@tanstack/react-query";
import { DAO_ADDRESSES } from "@/lib/utils/constants";
import { formatEther } from "viem";
import { useMemo, useState } from "react";
import Countdown from "react-countdown";
import { useRouter } from "next/navigation";
import { useTranslations } from '@/lib/i18n/hooks';
import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Heading,
  Grid,
  GridItem,
  Badge,
  Flex,
  useBreakpointValue,
  Image,
  Spinner,
  List,
  ListItem,
  ListIcon,
  Center,
} from "@chakra-ui/react";
import { IconButton } from "@chakra-ui/react";
import { CheckCircleIcon, InfoIcon } from "@chakra-ui/icons";
import MatrixOverlay from "@/components/graphics/MatrixOverlay";
import { EnsName as Name, EnsAvatar as Avatar } from "@/components/shared/EnsIdentity";

const formatBidAmount = (amount: bigint) => {
  return Number(formatEther(amount)).toLocaleString(undefined, {
    maximumFractionDigits: 5,
  });
};

const formatAddress = (address: string) => {
  if (!address) return "";
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const formatBidDate = (timestamp: string) => {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isAuctionActive = (endTime: string) => {
  return parseInt(endTime) * 1000 > Date.now();
};

interface AuctionPageProps {
  tokenId?: number;
  showNavigation?: boolean;
}

export default function AuctionPage({
  tokenId,
  showNavigation = false,
}: AuctionPageProps) {
  const t = useTranslations('auction');
  const tCommon = useTranslations('common');
  const isMobile = useBreakpointValue({ base: true, md: false });
  const router = useRouter();

  // Use different queries based on whether we have a specific tokenId
  const {
    data: activeAuction,
    refetch,
    isLoading,
    error,
  } = useQuery({
    queryKey: tokenId ? ["auction", tokenId] : ["auction", "latest"],
    queryFn: async () => {
      if (tokenId !== undefined) {
        const result = await fetchAuctionByTokenId(DAO_ADDRESSES.token, tokenId);
        return result;
      } else {
        // Fetch latest auction for main page
        const auctions = await fetchAuction(DAO_ADDRESSES.token);
        return auctions[0] || null;
      }
    },
    staleTime: 0,
  });

  const [isBidsModalOpen, setIsBidsModalOpen] = useState(false);
  const [isHoveringBid, setIsHoveringBid] = useState(false);

  // Navigation logic
  const currentTokenId =
    tokenId ||
    (activeAuction ? Number(activeAuction.token.tokenId) : undefined);

  // Check if we're viewing the latest auction by comparing with fetched latest auction
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
    if (currentTokenId && currentTokenId > 1) {
      router.push(`/auction/${currentTokenId - 1}`);
    }
  };

  const handleNext = () => {
    if (currentTokenId) {
      router.push(`/auction/${currentTokenId + 1}`);
    }
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

  if (isLoading) {
    return (
      <Box bg="background" minH="100vh" py={{ base: 4, md: 8 }}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <VStack spacing={8} justify="center" minH="60vh">
            <Spinner size="xl" color="primary" />
            <Text color="text">{t('loading')}</Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (error) {
    console.error("Auction fetch error:", error);
    return (
      <Box bg="background" minH="100vh" py={{ base: 4, md: 8 }}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <VStack spacing={8} justify="center" minH="60vh">
            <Text color="error" fontSize="lg">
              {t('errorLoading')} {error.message}
            </Text>
          </VStack>
        </Container>
      </Box>
    );
  }

  if (!activeAuction || !auctionData) {
    const isMultipleOf10 = tokenId ? tokenId % 10 === 0 : false;

    // Show special admin auction page for multiples of 10
    if (tokenId && isMultipleOf10) {
      return (
        <AdminAuctionPage
          tokenId={tokenId}
          showNavigation={showNavigation}
          onPrev={handlePrev}
          onNext={handleNext}
        />
      );
    }

    return (
      <Box bg="background" minH="100vh" py={{ base: 4, md: 8 }}>
        <Container maxW="7xl" px={{ base: 4, md: 6 }}>
          <VStack spacing={8} justify="center" minH="60vh">
            <Text color="muted" fontSize="lg">
              {tokenId
                ? t('auctionNotFound').replace('{tokenId}', tokenId.toString())
                : t('noActiveAuction')}
            </Text>
            {tokenId && (
              <Text color="muted" fontSize="sm" textAlign="center" maxW="md">
                {t('onlySkateHiveAuctions')}
              </Text>
            )}
          </VStack>
        </Container>
      </Box>
    );
  }

  return (
    <>
      {/* Mobile Navbar */}
      <AuctionMobileNavbar />

      <Box bg="background" minH="100vh" py={{ base: 2, md: 4, lg: 8 }}>
        <Container maxW="7xl" px={{ base: 3, md: 4, lg: 6 }}>
          <VStack spacing={{ base: 4, md: 6, lg: 8 }}>
            {/* Header Section */}
            <Box textAlign="center" maxW="4xl" mx="auto" w="full">
              <Heading
                size={{ base: "2xl", md: "3xl", lg: "4xl" }}
                color="primary"
                fontFamily="heading"
                textTransform="uppercase"
                letterSpacing="wide"
                lineHeight="tight"
                style={{
                  fontFamily: "'Joystix', 'VT323', 'Fira Mono', monospace",
                }}
              >
                {t('title')}
              </Heading>
            </Box>

            {/* Auction Header - Name, Date, Navigation */}
            <Box maxW="4xl" mx="auto" w="full">
              <AuctionHeader
                tokenName={activeAuction.token.name}
                tokenId={activeAuction.token.tokenId.toString()}
                startTime={activeAuction.startTime}
                showNavigation={showNavigation}
                currentTokenId={currentTokenId}
                isLatestAuction={isLatestAuction ?? false}
                onPrev={handlePrev}
                onNext={handleNext}
              />
            </Box>

            {/* Main Auction Layout */}
            <Box maxW="6xl" mx="auto" w="full" mb={{ base: 8, md: 12, lg: 16 }} mt={{ base: 4, md: 6 }}>
              <VStack spacing={{ base: 6, md: 8, lg: 12 }} w="full">
                {/* Large NFT Image - Centered on its own line */}
                <Box position="relative" w="full" textAlign="center">
                  <VStack spacing={4}>
                    {/* NFT Image */}
                    <Box
                      position="relative"
                      w={{ base: "100%", md: "500px", lg: "600px" }}
                      h={{ base: "auto", md: "500px", lg: "600px" }}
                      maxW="600px"
                      maxH="600px"
                      mx="auto"
                    >
                      <Image
                        src={activeAuction.token.image}
                        alt={activeAuction.token.name}
                        w="full"
                        h="full"
                        aspectRatio="1"
                        objectFit="cover"
                        fallbackSrc="/images/placeholder.png"
                      />
                      {/* Stamped Latest Champ Box - Centered and Rotated */}
                      {!auctionData.isRunning && activeAuction.highestBid && (
                        <Box
                          position="absolute"
                          top="50%"
                          left="50%"
                          transform="translate(-50%, -50%) rotate(30deg)"
                          bg="background"
                          color="primary"
                          p={3}
                          borderRadius="none"
                          boxShadow="lg"
                          border="2px dashed"
                          borderColor="primary"
                          zIndex={2}
                          minW={{ base: "160px", md: "200px", lg: "220px" }}
                          opacity={0}
                          _hover={{
                            opacity: 1,
                            transition: "opacity 0.2s ease",
                            transform:
                              "translate(-50%, -50%) rotate(30deg) scale(1.05)",
                          }}
                        >
                          <VStack spacing={2} align="stretch" w="full">
                            <Text
                              fontSize="sm"
                              fontWeight="bold"
                              color="primary"
                              textAlign="center"
                              letterSpacing="wide"
                              textTransform="uppercase"
                            >
                              {t('proudWinner')}
                            </Text>
                            <Center>
                              <HStack color={"primary"} spacing={2}>
                                <Avatar
                                  address={activeAuction.highestBid.bidder}
                                />
                                <Name
                                  className="text-lg font-bold text-white"
                                  address={activeAuction.highestBid.bidder}
                                />
                              </HStack>
                            </Center>
                            <Text
                              fontSize="lg"
                              fontWeight="bold"
                              color="success"
                              textAlign="center"
                              w="full"
                            >
                              {auctionData.bidAmount} Ξ
                            </Text>
                          </VStack>
                        </Box>
                      )}
                    </Box>
                  </VStack>
                </Box>

                {/* Auction Details - Below the artwork */}
                <Box
                  w="full"
                  maxW={{ base: "100%", md: "600px", lg: "700px" }}
                  mx="auto"
                >
                  <Box
                    p={{ base: 4, md: 6, lg: 8 }}
                    position="relative"
                    overflow="hidden"
                    display="flex"
                    flexDirection="column"
                    justifyContent="space-between"
                  >
                    {isHoveringBid && <MatrixOverlay />}
                    <VStack
                      spacing={{ base: 4, md: 6 }}
                      align="stretch"
                      flex="1"
                      justifyContent="space-between"
                    >
                      {/* Time Remaining */}
                      <VStack spacing={3} position="relative" zIndex={1}>
                        <Text fontSize="sm" color="primary" fontWeight="medium" textAlign="center">
                          {t('auctionEndsIn')}
                        </Text>
                        {auctionData.isRunning ? (
                          <Countdown
                            date={auctionData.endTime}
                            renderer={({
                              days,
                              hours,
                              minutes,
                              seconds,
                              completed,
                            }) => {
                              if (completed) {
                                return (
                                  <Text
                                    fontSize={{ base: "2xl", md: "3xl" }}
                                    fontWeight="bold"
                                    color="error"
                                    fontFamily="mono"
                                    textAlign="center"
                                  >
                                    {t('ended')}
                                  </Text>
                                );
                              }
                              return (
                                <VStack spacing={2} align="center">
                                  <Image
                                    src="/images/clock.gif"
                                    alt="clock"
                                    boxSize={{ base: "24px", md: "32px" }}
                                    objectFit="contain"
                                  />
                                  <Text
                                    fontSize={{ base: "2xl", md: "3xl", lg: "4xl" }}
                                    fontWeight="bold"
                                    color="primary"
                                    fontFamily="mono"
                                    textAlign="center"
                                  >
                                    {days > 0 && `${days}d `}
                                    {String(hours).padStart(2, "0")}h{" "}
                                    {String(minutes).padStart(2, "0")}m{" "}
                                    {String(seconds).padStart(2, "0")}s
                                  </Text>
                                </VStack>
                              );
                            }}
                            onComplete={() => refetch()}
                          />
                        ) : (
                          <Text
                            fontSize={{ base: "2xl", md: "3xl" }}
                            fontWeight="bold"
                            color="error"
                            fontFamily="mono"
                            textAlign="center"
                          >
                            ENDED
                          </Text>
                        )}
                      </VStack>

                      {/* Bidding Interface */}
                      <Box
                        w="full"
                        display="flex"
                        flexDirection="column"
                        justifyContent="center"
                        flex="1"
                      >
                        <AuctionBid
                          tokenId={activeAuction.token.tokenId}
                          winningBid={
                            activeAuction.highestBid?.amount
                              ? BigInt(activeAuction.highestBid.amount)
                              : 0n
                          }
                          isAuctionRunning={auctionData.isRunning}
                          reservePrice={
                            activeAuction.dao.auctionConfig.reservePrice
                          }
                          minimumBidIncrement={
                            activeAuction.dao.auctionConfig.minimumBidIncrement
                          }
                          onBid={refetch}
                          onSettle={refetch}
                          alignContent="left"
                          bids={activeAuction.bids || []}
                          onBidSectionHover={setIsHoveringBid}
                          isLatestAuction={isLatestAuction ?? false}
                        />
                      </Box>
                    </VStack>
                  </Box>
                </Box>
              </VStack>
            </Box>

            {/* Widgets Row - Responsive Grid */}
            <Grid
              templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
              gap={{ base: 4, md: 6 }}
              w="full"
              maxW="6xl"
              mx="auto"
            >
              {/* How it works */}
              <GridItem>
                <Box
                  bg="muted"
                  borderRadius="xl"
                  border="1px solid"
                  borderColor="border"
                  p={{ base: 4, md: 6 }}
                  shadow="sm"
                  h="full"
                >
                  <Heading size="md" color="text" mb={4} fontSize={{ base: "md", md: "lg" }}>
                    How it works
                  </Heading>
                  <List spacing={3}>
                    <ListItem display="flex" alignItems="start">
                      <ListIcon as={CheckCircleIcon} color="primary" mt={1} />
                      <Text fontSize="sm" color="text">
                        {t('connectWallet')}
                      </Text>
                    </ListItem>
                    <ListItem display="flex" alignItems="start">
                      <ListIcon as={CheckCircleIcon} color="primary" mt={1} />
                      <Text fontSize="sm" color="text">
                        {t('placeBidHigher')}
                      </Text>
                    </ListItem>
                    <ListItem display="flex" alignItems="start">
                      <ListIcon as={CheckCircleIcon} color="primary" mt={1} />
                      <Text fontSize="sm" color="text">
                        {t('winIfHighest')}
                      </Text>
                    </ListItem>
                    <ListItem display="flex" alignItems="start">
                      <ListIcon as={CheckCircleIcon} color="primary" mt={1} />
                      <Text fontSize="sm" color="text">
                        {t('settleToClaimNFT')}
                      </Text>
                    </ListItem>
                  </List>
                </Box>
              </GridItem>

              {/* Auction Rules */}
              <GridItem>
                <Box
                  bg="muted"
                  borderRadius="xl"
                  border="1px solid"
                  borderColor="border"
                  p={{ base: 4, md: 6 }}
                  shadow="sm"
                  h="full"
                >
                  <Heading size="md" color="text" mb={4} fontSize={{ base: "md", md: "lg" }}>
                    {t('auctionRules')}
                  </Heading>
                  <VStack spacing={3}>
                    <Flex justify="space-between" w="full" align="center">
                      <Text fontSize="sm" color="text">
                        {t('auctionDuration')}
                      </Text>
                      <Badge
                        bg="success"
                        color="background"
                        variant="solid"
                        fontSize="xs"
                      >
                        {t('duration24h')}
                      </Badge>
                    </Flex>
                    <Flex justify="space-between" w="full" align="center">
                      <Text fontSize="sm" color="text">
                        {t('minimumIncrement')}
                      </Text>
                      <Badge
                        bg="success"
                        color="background"
                        variant="solid"
                        fontSize="xs"
                      >
                        {t('increment2Percent')}
                      </Badge>
                    </Flex>
                    <Flex justify="space-between" w="full" align="center">
                      <Text fontSize="sm" color="text">
                        {t('reservePrice')}
                      </Text>
                      <Badge
                        bg="success"
                        color="background"
                        variant="solid"
                        fontSize="xs"
                      >
                        {formatBidAmount(
                          BigInt(activeAuction.dao.auctionConfig.reservePrice)
                        )}{" "}
                        Ξ
                      </Badge>
                    </Flex>
                  </VStack>
                </Box>
              </GridItem>

              {/* Pro Tips */}
              <GridItem gridColumn={{ base: "1", md: "span 2", lg: "span 1" }}>
                <Box
                  bg="muted"
                  borderRadius="xl"
                  border="1px solid"
                  borderColor="primary"
                  p={{ base: 4, md: 6 }}
                  shadow="sm"
                  h="full"
                >
                  <HStack spacing={2} mb={3}>
                    <InfoIcon color="primary" />
                    <Heading size="md" color="primary" fontSize={{ base: "md", md: "lg" }}>
                      {t('proTips')}
                    </Heading>
                  </HStack>
                  <List spacing={2}>
                    <ListItem>
                      <Text fontSize="sm" color="text">
                        {t('tip1')}
                      </Text>
                    </ListItem>
                    <ListItem>
                      <Text fontSize="sm" color="text">
                        {t('tip2')}
                      </Text>
                    </ListItem>
                    <ListItem>
                      <Text fontSize="sm" color="text">
                        {t('tip3')}
                      </Text>
                    </ListItem>
                    <ListItem>
                      <Text fontSize="sm" color="text">
                        • Join our Discord for auction notifications
                      </Text>
                    </ListItem>
                  </List>
                </Box>
              </GridItem>
            </Grid>
          </VStack>
        </Container>

        {/* Bids Modal */}
        {activeAuction && activeAuction.bids && (
          <BidsModal
            isOpen={isBidsModalOpen}
            onClose={() => setIsBidsModalOpen(false)}
            bids={activeAuction.bids}
            tokenName={activeAuction.token.name}
            tokenId={activeAuction.token.tokenId.toString()}
          />
        )}
      </Box>
    </>
  );
}
