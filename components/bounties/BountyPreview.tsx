"use client";

import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Skeleton,
  Icon,
  Flex,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { FaEthereum, FaBolt, FaExternalLinkAlt } from "react-icons/fa";
import { formatEther } from "viem";
import NextLink from "next/link";
import NextImage from "next/image";
import { CHAIN_LABEL } from "@/lib/poidh-constants";
import type { PoidhBounty } from "@/types/poidh";

interface BountyPreviewProps {
  chainId: string;
  id: string;
}

function safeFormatEther(amount: string): string {
  try {
    return formatEther(BigInt(amount));
  } catch {
    return "0";
  }
}

/** Strip markdown/html noise from description for clean preview */
function cleanDescription(desc: string): string {
  return desc
    .replace(/<[^>]*>/g, "")           // HTML tags
    .replace(/!\[.*?\]\(.*?\)/g, "")    // markdown images
    .replace(/\[([^\]]*)\]\(.*?\)/g, "$1") // markdown links → text only
    .replace(/\*{1,2}(.*?)\*{1,2}/g, "$1") // bold/italic
    .replace(/#{1,6}\s*/g, "")          // headings
    .replace(/\n{2,}/g, " ")            // collapse newlines
    .trim();
}

/**
 * Bounty Preview Mini-App
 * Renders an inline card for POIDH bounty links in the feed.
 * Compact design with optional image, reward badge, and CTA.
 */
export default function BountyPreview({ chainId, id }: BountyPreviewProps) {
  const { data: bounty, isLoading } = useQuery<PoidhBounty>({
    queryKey: ["poidh-bounty", chainId, id],
    queryFn: async () => {
      const res = await fetch(`/api/poidh/bounties/${chainId}/${id}`);
      if (!res.ok) throw new Error("Failed to fetch bounty");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Shared ETH price query — deduped across all BountyPreview instances
  const { data: ethPrice } = useQuery<number>({
    queryKey: ["eth-price"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      if (!res.ok) return 2500;
      const data = await res.json();
      return data?.ethereum?.usd ?? 2500;
    },
    staleTime: 5 * 60 * 1000,
  });

  const detailHref = `/bounties/poidh/${chainId}/${id}`;
  const numericChainId = parseInt(chainId, 10);
  const chainLabel = CHAIN_LABEL[numericChainId] ?? "Unknown";

  if (isLoading) {
    return (
      <Box border="1px solid" borderColor="border" bg="muted" my={3} overflow="hidden">
        <Skeleton height="140px" width="100%" />
        <HStack p={3} spacing={3}>
          <Skeleton height="32px" width="100px" />
          <VStack align="start" flex={1} spacing={1}>
            <Skeleton height="14px" width="70%" />
            <Skeleton height="10px" width="50%" />
          </VStack>
        </HStack>
      </Box>
    );
  }

  if (!bounty) {
    return null;
  }

  const amountInEth = safeFormatEther(bounty.amount);
  const amountFloat = parseFloat(amountInEth);
  const isActive = bounty.isActive ?? !bounty.claimer;
  const isCancelled = bounty.isCanceled;
  const statusColor = isCancelled ? "warning" : isActive ? "success" : "error";
  const statusLabel = isCancelled ? "CANCELLED" : isActive ? "OPEN" : "CLOSED";
  const claimCount = bounty.claims?.length ?? bounty.claimCount ?? 0;
  const hasImage = !!bounty.imageUrl;
  const desc = bounty.description ? cleanDescription(bounty.description) : "";
  const usdValue = ethPrice ? (amountFloat * ethPrice).toFixed(2) : null;

  return (
    <Box
      as={NextLink}
      href={detailHref}
      display="block"
      border="1px solid"
      borderColor="primary"
      bg="muted"
      my={3}
      overflow="hidden"
      _hover={{
        borderColor: "accent",
        "& .bounty-cta": { bg: isActive ? "accent" : "rgba(167,255,0,0.1)" },
      }}
      transition="border-color 0.15s"
      cursor="pointer"
    >
      {/* Hero section: image with overlay OR compact text-only */}
      {hasImage ? (
        <Box position="relative" w="100%" h="160px" bg="black" overflow="hidden">
          <NextImage
            src={bounty.imageUrl!}
            alt={bounty.name}
            fill
            style={{ objectFit: "cover", opacity: 0.7 }}
            unoptimized
          />
          {/* Gradient overlay */}
          <Box
            position="absolute"
            inset={0}
            bgGradient="linear(to-t, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.5) 100%)"
          />
          {/* Top bar over image */}
          <HStack
            position="absolute"
            top={0}
            left={0}
            right={0}
            px={3}
            py={1.5}
            justify="space-between"
          >
            <Text fontSize="2xs" fontFamily="mono" fontWeight="bold" color="whiteAlpha.600" letterSpacing="wider">
              SKATEHIVE / BOUNTY
            </Text>
            <HStack spacing={1}>
              <Icon as={FaEthereum} boxSize="10px" color="#627EEA" />
              <Text fontSize="2xs" fontFamily="mono" color="whiteAlpha.600" fontWeight="bold">
                {chainLabel.toUpperCase()}
              </Text>
            </HStack>
          </HStack>
          {/* Title + reward over image */}
          <VStack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            px={3}
            pb={2.5}
            pt={1}
            align="start"
            spacing={1}
          >
            <Text
              fontSize="md"
              fontFamily="mono"
              fontWeight="900"
              color="white"
              noOfLines={2}
              lineHeight="short"
              textShadow="0 1px 3px rgba(0,0,0,0.8)"
            >
              {bounty.name}
            </Text>
            <HStack spacing={2}>
              <VStack
                spacing={0}
                bg="rgba(0,0,0,0.7)"
                border="1px solid"
                borderColor="primary"
                px={2}
                py={0.5}
                align="center"
              >
                <HStack spacing={1}>
                  <Icon as={FaEthereum} boxSize="12px" color="#627EEA" />
                  <Text fontSize="sm" fontWeight="900" color="primary" fontFamily="mono">
                    {amountFloat < 0.001 ? amountFloat.toFixed(6) : amountFloat.toFixed(4)}
                  </Text>
                  <Text fontSize="2xs" fontWeight="bold" color="dim" fontFamily="mono">
                    ETH
                  </Text>
                </HStack>
                {usdValue && (
                  <Text fontSize="2xs" fontFamily="mono" color="whiteAlpha.700" fontWeight="bold">
                    ${usdValue} USD
                  </Text>
                )}
              </VStack>
              <Box border="1px solid" borderColor={statusColor} px={1.5} py={0} bg="rgba(0,0,0,0.7)">
                <Text fontSize="2xs" fontWeight="bold" fontFamily="mono" color={statusColor}>
                  {statusLabel}
                </Text>
              </Box>
            </HStack>
          </VStack>
        </Box>
      ) : (
        /* No image — compact text layout */
        <>
          <HStack px={3} py={1.5} borderBottom="1px solid" borderColor="border" justify="space-between">
            <HStack spacing={2}>
              <Text fontSize="2xs" fontFamily="mono" fontWeight="bold" color="dim" letterSpacing="wider">
                SKATEHIVE / BOUNTY
              </Text>
              <Box border="1px solid" borderColor={statusColor} px={1.5} py={0}>
                <Text fontSize="2xs" fontWeight="bold" fontFamily="mono" color={statusColor}>
                  {statusLabel}
                </Text>
              </Box>
            </HStack>
            <HStack spacing={1}>
              <Icon as={FaEthereum} boxSize="10px" color="#627EEA" />
              <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">
                {chainLabel.toUpperCase()}
              </Text>
            </HStack>
          </HStack>
          <HStack px={3} py={3} spacing={3} align="center">
            <VStack
              spacing={0}
              border="1px solid"
              borderColor="primary"
              px={3}
              py={2}
              bg="rgba(167, 255, 0, 0.03)"
              flexShrink={0}
              align="center"
            >
              <HStack spacing={1.5}>
                <Icon as={FaEthereum} boxSize="14px" color="#627EEA" />
                <Text fontSize="lg" fontWeight="900" color="primary" fontFamily="mono" lineHeight="1">
                  {amountFloat < 0.001 ? amountFloat.toFixed(6) : amountFloat.toFixed(4)}
                </Text>
                <Text fontSize="xs" fontWeight="bold" color="dim" fontFamily="mono">
                  ETH
                </Text>
              </HStack>
              {usdValue && (
                <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mt={0.5}>
                  ${usdValue} USD
                </Text>
              )}
            </VStack>
            <VStack align="start" spacing={0} flex={1} minW={0}>
              <Text fontSize="sm" fontFamily="mono" fontWeight="bold" color="text" noOfLines={2}>
                {bounty.name}
              </Text>
            </VStack>
          </HStack>
        </>
      )}

      {/* Footer */}
      <Flex
        px={3}
        py={2}
        borderTop="1px solid"
        borderColor="border"
        justify="space-between"
        align="center"
      >
        <HStack spacing={2}>
          {desc && (
            <Text fontSize="2xs" fontFamily="mono" color="dim" noOfLines={1} maxW="200px">
              {desc}
            </Text>
          )}
        </HStack>
        <HStack spacing={3}>
          <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" flexShrink={0}>
            {claimCount} {claimCount === 1 ? "CLAIM" : "CLAIMS"}
          </Text>
          <Box
            className="bounty-cta"
            bg={isActive ? "primary" : "transparent"}
            color={isActive ? "background" : "primary"}
            border={isActive ? "none" : "1px solid"}
            borderColor="primary"
            px={3}
            py={1}
            fontFamily="mono"
            fontWeight="bold"
            fontSize="2xs"
            textTransform="uppercase"
            letterSpacing="wider"
            transition="background 0.15s"
            flexShrink={0}
          >
            <HStack spacing={1}>
              <Icon as={isActive ? FaBolt : FaExternalLinkAlt} boxSize="8px" />
              <Text>{isActive ? "CLAIM BOUNTY" : "VIEW"}</Text>
            </HStack>
          </Box>
        </HStack>
      </Flex>
    </Box>
  );
}
