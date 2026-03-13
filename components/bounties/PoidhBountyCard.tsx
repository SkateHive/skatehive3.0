'use client';

import {
  Box,
  Text,
  Badge,
  HStack,
  VStack,
  Tooltip,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import Image from 'next/image';
import { formatEther } from 'viem';
import type { PoidhBounty } from '@/types/poidh';

const CHAIN_LABEL: Record<number, string> = {
  8453: 'Base',
  42161: 'Arb',
};

const CHAIN_COLOR: Record<number, string> = {
  8453: 'blue',
  42161: 'purple',
};

// Fallback gradient thumbnails by bounty id parity for visual variety
const FALLBACK_GRADIENTS = [
  'linear(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  'linear(135deg, #0d0d0d 0%, #1a0a2e 50%, #2d1b69 100%)',
  'linear(135deg, #0a0a0a 0%, #1a1a0a 50%, #2d3500 100%)',
  'linear(135deg, #0d1a0d 0%, #0a2a0a 50%, #003a00 100%)',
];

interface PoidhBountyCardProps {
  bounty: PoidhBounty;
}

export function PoidhBountyCard({ bounty }: PoidhBountyCardProps) {
  const amountInEth = (() => {
    try { return parseFloat(formatEther(BigInt(bounty.amount || '0'))); }
    catch { return 0; }
  })();
  // Use the isActive flag set by the API based on Poidh's status field
  // Don't derive from claimer — a past bounty can have claimer=null if unclaimed
  const isActive = bounty.isActive ?? false;
  const chainId = bounty.chainId ?? 8453;
  const createdDate = new Date(bounty.createdAt * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const gradientIndex = parseInt(bounty.id, 10) % FALLBACK_GRADIENTS.length;

  return (
    <Box
      as={NextLink}
      href={`/bounties/poidh/${chainId}/${bounty.id}`}
      display="block"
      borderRadius="2xl"
      overflow="hidden"
      borderWidth="1px"
      borderColor="border"
      bg="panel"
      _hover={{
        borderColor: 'primary',
        transform: 'translateY(-6px)',
        shadow: '0 20px 40px rgba(0,0,0,0.4)',
        textDecoration: 'none',
      }}
      transition="all 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
      cursor="pointer"
    >
      {/* Thumbnail */}
      <Box position="relative" h="160px" overflow="hidden">
        {bounty.imageUrl ? (
          <Image
            src={bounty.imageUrl}
            alt={bounty.name}
            fill
            style={{ objectFit: 'cover' }}
            unoptimized
          />
        ) : (
          <Box
            w="100%"
            h="100%"
            bgGradient={FALLBACK_GRADIENTS[gradientIndex]}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize="4xl" userSelect="none">🛹</Text>
          </Box>
        )}

        {/* Overlay gradient for text legibility */}
        <Box
          position="absolute"
          bottom={0}
          left={0}
          right={0}
          h="70px"
          bgGradient="linear(to-t, rgba(0,0,0,0.85), transparent)"
        />

        {/* Top badges */}
        <HStack position="absolute" top={3} left={3} gap={2}>
          <Badge
            bg={isActive ? 'green.400' : 'gray.600'}
            color="black"
            fontSize="2xs"
            fontWeight="black"
            px={2}
            py={0.5}
            borderRadius="full"
            letterSpacing="wide"
          >
            {isActive ? '● OPEN' : '✓ CLOSED'}
          </Badge>
          {CHAIN_LABEL[chainId] && (
            <Badge
              colorScheme={CHAIN_COLOR[chainId]}
              fontSize="2xs"
              fontWeight="bold"
              px={2}
              py={0.5}
              borderRadius="full"
            >
              {CHAIN_LABEL[chainId]}
            </Badge>
          )}
        </HStack>

        {/* Reward pill on bottom-right of image */}
        <Box position="absolute" bottom={3} right={3}>
          <Box
            bg="rgba(0,0,0,0.75)"
            backdropFilter="blur(8px)"
            borderRadius="full"
            px={3}
            py={1}
            borderWidth="1px"
            borderColor="rgba(255,255,255,0.15)"
          >
            <HStack gap={1} align="baseline">
              <Text fontWeight="black" fontSize="md" color="primary" lineHeight="1">
                {amountInEth < 0.001
                  ? amountInEth.toFixed(6)
                  : amountInEth.toFixed(4)}
              </Text>
              <Text fontSize="2xs" color="whiteAlpha.700" fontWeight="bold">ETH</Text>
            </HStack>
          </Box>
        </Box>
      </Box>

      {/* Content */}
      <VStack align="stretch" gap={2} p={4}>
        {/* Title */}
        <Text
          fontWeight="bold"
          fontSize="md"
          color="text"
          noOfLines={2}
          lineHeight="short"
        >
          {bounty.name}
        </Text>

        {/* Description snippet */}
        <Text fontSize="xs" color="dim" noOfLines={2} lineHeight="tall">
          {bounty.description}
        </Text>

        {/* Footer */}
        <HStack justify="space-between" align="center" pt={1}>
          <Text fontSize="2xs" color="dim" fontWeight="medium">
            {createdDate}
          </Text>

          {bounty.claimCount !== undefined && bounty.claimCount > 0 ? (
            <Tooltip label={`${bounty.claimCount} proof${bounty.claimCount > 1 ? 's' : ''} submitted`}>
              <Badge
                colorScheme="blue"
                fontSize="2xs"
                px={2}
                py={0.5}
                borderRadius="full"
                variant="subtle"
              >
                📋 {bounty.claimCount} {bounty.claimCount === 1 ? 'proof' : 'proofs'}
              </Badge>
            </Tooltip>
          ) : (
            <Text fontSize="2xs" color="dim" fontStyle="italic">No proofs yet</Text>
          )}
        </HStack>
      </VStack>
    </Box>
  );
}
