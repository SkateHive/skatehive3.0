"use client";

import {
  Box,
  Badge,
  Heading,
  Text,
  VStack,
  Link,
  Button,
  Image,
  Skeleton,
  Container,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";
import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { DAO_ADDRESSES, SKATEHIVE_HOT_ADDRESS } from "@/lib/utils/constants";
import { AuctionHeader } from "./AuctionHeader";

interface AdminAuctionPageProps {
  tokenId: number;
  showNavigation?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

interface TokenData {
  image: string;
  name: string;
  owner: string;
}

export function AdminAuctionPage({
  tokenId,
  showNavigation = false,
  onPrev,
  onNext,
}: AdminAuctionPageProps) {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [loading, setLoading] = useState(true);

  // Read token URI from contract
  const {
    data: tokenURI,
    error: tokenURIError,
    isLoading: tokenURILoading,
  } = useReadContract({
    address: DAO_ADDRESSES.token,
    abi: [
      {
        name: "tokenURI",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "string" }],
      },
    ],
    functionName: "tokenURI",
    args: [BigInt(tokenId)],
  });

  // Read token owner from contract
  const {
    data: tokenOwner,
    error: tokenOwnerError,
    isLoading: tokenOwnerLoading,
  } = useReadContract({
    address: DAO_ADDRESSES.token,
    abi: [
      {
        name: "ownerOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "tokenId", type: "uint256" }],
        outputs: [{ name: "", type: "address" }],
      },
    ],
    functionName: "ownerOf",
    args: [BigInt(tokenId)],
  });

  useEffect(() => {
    const fetchTokenMetadata = async () => {
      if (tokenURIError || tokenOwnerError) {
        setTokenData({
          image: "",
          name: `SkateHive #${tokenId}`,
          owner: (tokenOwner as string) || "",
        });
        setLoading(false);
        return;
      }

      if (tokenURILoading || tokenOwnerLoading) {
        return;
      }

      if (!tokenURI) {
        setTokenData({
          image: "",
          name: `SkateHive #${tokenId}`,
          owner: (tokenOwner as string) || "",
        });
        setLoading(false);
        return;
      }

      try {
        // Handle base64 encoded metadata
        if (tokenURI.startsWith("data:application/json;base64,")) {
          const base64Data = tokenURI.split(",")[1];
          const decodedData = atob(base64Data);
          const metadata = JSON.parse(decodedData);

          setTokenData({
            image: metadata.image || "",
            name: metadata.name || `SkateHive #${tokenId}`,
            owner: (tokenOwner as string) || "",
          });
        } else if (tokenURI.startsWith("http")) {
          // Handle regular HTTP/IPFS URLs
          const response = await fetch(tokenURI);
          const metadata = await response.json();

          setTokenData({
            image: metadata.image || "",
            name: metadata.name || `SkateHive #${tokenId}`,
            owner: (tokenOwner as string) || "",
          });
        } else {
          // Handle other formats or plain JSON
          const metadata = JSON.parse(tokenURI);

          setTokenData({
            image: metadata.image || "",
            name: metadata.name || `SkateHive #${tokenId}`,
            owner: (tokenOwner as string) || "",
          });
        }
      } catch (error) {
        setTokenData({
          image: "",
          name: `SkateHive #${tokenId}`,
          owner: (tokenOwner as string) || "",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTokenMetadata();
  }, [
    tokenURI,
    tokenOwner,
    tokenId,
    tokenURIError,
    tokenOwnerError,
    tokenURILoading,
    tokenOwnerLoading,
  ]);

  const formatAddress = (address: string) => {
    if (!address) return "n/a";
    if (address.toLowerCase() === SKATEHIVE_HOT_ADDRESS.toLowerCase()) {
      return "skatehive.eth";
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <Box bg="background" minH="100vh" py={{ base: 4, md: 8 }}>
      <Container maxW="7xl" px={{ base: 4, md: 6 }}>
        <VStack spacing={{ base: 2, md: 3 }}>
          {/* Header Section */}
          <VStack
            spacing={{ base: 3, md: 4 }}
            textAlign="center"
            maxW="4xl"
            mx="auto"
          >
            <Heading
              size={{ base: "3xl", md: "4xl" }}
              color="primary"
              fontFamily="heading"
              textTransform="uppercase"
              letterSpacing="wide"
              lineHeight="tight"
              style={{
                fontFamily: "'Joystix', 'VT323', 'Fira Mono', monospace",
              }}
            >
              Skatehive Auction
            </Heading>
            <Text
              fontSize={{ base: "md", md: "lg" }}
              color="text"
              maxW="2xl"
              lineHeight="tall"
              px={{ base: 2, md: 0 }}
            >
              Admin/Referral Auction - Automatically Won
            </Text>
          </VStack>

          {/* Auction Header */}
          <Box maxW="4xl" mx="auto" w="full">
            <AuctionHeader
              tokenName={tokenData?.name || `SkateHive #${tokenId}`}
              tokenId={tokenId.toString()}
              startTime="0"
              showNavigation={showNavigation}
              currentTokenId={tokenId}
              isLatestAuction={false}
              onPrev={onPrev}
              onNext={onNext}
            />
          </Box>

          {/* Main Content Layout */}
          <Box maxW="4xl" mx="auto" w="full" mb={16} mt={6}>
            <Grid
              templateColumns={{ base: "1fr", lg: "0.25fr 0.75fr" }}
              gap={{ base: 6, md: 6 }}
              w="full"
              alignItems="center"
            >
              {/* Admin Info Panel */}
              <GridItem order={{ base: 2, lg: 2 }} ml={{ base: 0, lg: 4 }}>
                <Box
                  p={{ base: 6, lg: 6 }}
                  border="1px solid"
                  borderColor="border"
                  borderRadius="xl"
                >
                  <VStack spacing={6} align="center">
                    {/* Admin Badge */}
                    <Badge
                      colorScheme="purple"
                      fontSize="lg"
                      px={4}
                      py={2}
                      borderRadius="lg"
                      textTransform="uppercase"
                    >
                      Admin/Referral Auction
                    </Badge>

                    {/* Token Name */}
                    <Heading size="lg" textAlign="center" color="text">
                      {loading ? (
                        <Skeleton height="32px" width="200px" />
                      ) : (
                        tokenData?.name || `SkateHive #${tokenId}`
                      )}
                    </Heading>

                    {/* Holder Information */}
                    <VStack spacing={2}>
                      <Text fontSize="sm" color="muted" fontWeight="medium">
                        Held by
                      </Text>
                      {loading ? (
                        <Skeleton height="24px" width="120px" />
                      ) : (
                        <Text fontSize="lg" fontWeight="bold" color="primary">
                          {formatAddress(tokenData?.owner || "")}
                        </Text>
                      )}
                    </VStack>

                    {/* Explanation */}
                    <VStack spacing={3} textAlign="center">
                      <Text fontSize="md" color="text">
                        This auction was automatically won by admin or referral
                        wallets and may not appear in our standard auction data.
                      </Text>

                      <Text fontSize="sm" color="muted">
                        These auctions are part of the protocol&apos;s design to
                        ensure continuous operation and community growth.
                      </Text>
                    </VStack>

                    {/* Action Buttons */}
                    <VStack spacing={3} w="full">
                      <Link
                        href={`https://nouns.build/dao/base/${DAO_ADDRESSES.token}/auction/${tokenId}`}
                        isExternal
                        w="full"
                      >
                        <Button
                          w="full"
                          colorScheme="blue"
                          rightIcon={<ExternalLinkIcon />}
                          size="lg"
                        >
                          View on Nouns.build
                        </Button>
                      </Link>

                      <Link
                        href={`https://basescan.org/address/${DAO_ADDRESSES.token}`}
                        isExternal
                        w="full"
                      >
                        <Button
                          w="full"
                          variant="outline"
                          rightIcon={<ExternalLinkIcon />}
                          size="lg"
                        >
                          View Contract
                        </Button>
                      </Link>
                    </VStack>
                  </VStack>
                </Box>
              </GridItem>

              {/* NFT Image */}
              <GridItem order={{ base: 1, lg: 1 }}>
                <Box position="relative" h="full">
                  <VStack spacing={0}>
                    <Box
                      position="relative"
                      w={{ base: "full", md: "400px", lg: "600px" }}
                      h={{ base: "auto", md: "400px", lg: "600px" }}
                      mx="auto"
                    >
                      {loading ? (
                        <Skeleton
                          w={{ base: "full", md: "400px", lg: "600px" }}
                          h={{ base: "auto", md: "400px", lg: "600px" }}
                          aspectRatio="1"
                        />
                      ) : tokenData?.image ? (
                        <Image
                          src={tokenData.image}
                          alt={tokenData.name}
                          w={{ base: "full", md: "400px", lg: "600px" }}
                          h={{ base: "auto", md: "400px", lg: "600px" }}
                          aspectRatio="1"
                          objectFit="cover"
                          fallbackSrc="/images/placeholder.png"
                        />
                      ) : (
                        <Box
                          w={{ base: "full", md: "400px", lg: "600px" }}
                          h={{ base: "auto", md: "400px", lg: "600px" }}
                          aspectRatio="1"
                          bg="muted"
                          display="flex"
                          alignItems="center"
                          justifyContent="center"
                          borderRadius="lg"
                        >
                          <Text color="text" fontSize="lg">
                            No Image Available
                          </Text>
                        </Box>
                      )}
                    </Box>
                  </VStack>
                </Box>
              </GridItem>
            </Grid>
          </Box>
        </VStack>
      </Container>
    </Box>
  );
}
