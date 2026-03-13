'use client';

import { useMemo } from 'react';
import {
  Box,
  Text,
  HStack,
  VStack,
  Icon,
  Avatar,
  Tooltip,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import { FaHive, FaEthereum, FaCalendar, FaFolder, FaBolt, FaTrophy } from 'react-icons/fa';
import type { UnifiedBounty } from '@/types/unified-bounty';

interface UnifiedBountyCardProps {
  bounty: UnifiedBounty;
  hivePrice?: number | null;
  hbdPrice?: number | null;
  ethPrice?: number | null;
}

/** Format a deadline countdown string like "3d 12h" or "2h 30m" */
function deadlineCountdown(deadlineUnix: number): string | null {
  const diffMs = deadlineUnix * 1000 - Date.now();
  if (diffMs <= 0) return null;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function UnifiedBountyCard({ bounty, hivePrice, hbdPrice, ethPrice }: UnifiedBountyCardProps) {
  const createdDate = bounty.createdAt > 0
    ? new Date(bounty.createdAt * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }).toUpperCase()
    : null;

  const countdown = bounty.deadline ? deadlineCountdown(bounty.deadline) : null;

  // Source icon + color
  const sourceIcon = bounty.source === 'hive' ? FaHive : FaEthereum;
  const sourceIconColor = bounty.source === 'hive' ? '#E31337' : '#627EEA';

  // Reward formatting
  const rewardStr = bounty.rewardAmount < 0.001 && bounty.rewardAmount > 0
    ? bounty.rewardAmount.toFixed(6)
    : bounty.rewardAmount % 1 === 0
      ? bounty.rewardAmount.toString()
      : bounty.rewardAmount.toFixed(4);

  // USD value for tooltip
  const usdValue = useMemo(() => {
    let price: number | null = null;
    switch (bounty.rewardCurrency) {
      case 'ETH': price = ethPrice ?? null; break;
      case 'HBD': price = hbdPrice ?? null; break;
      case 'HIVE': price = hivePrice ?? null; break;
    }
    if (price === null) return null;
    const val = bounty.rewardAmount * price;
    return val < 0.01 ? `$${val.toFixed(4)}` : `$${val.toFixed(2)}`;
  }, [bounty.rewardAmount, bounty.rewardCurrency, hivePrice, hbdPrice, ethPrice]);

  // Proof dots
  const proofCount = bounty.submissionCount;
  const maxDots = 6;
  const filledDots = Math.min(proofCount, maxDots);

  // CTA based on status
  const ctaLabel = bounty.isActive ? 'CLAIM IT' : 'PROOF';
  const ctaIcon = bounty.isActive ? FaBolt : FaFolder;

  // Winner info for closed bounties
  const hasWinner = !bounty.isActive && bounty.winnerDisplay;

  return (
    <Box
      as={NextLink}
      href={bounty.detailHref}
      display="flex"
      flexDirection="column"
      borderRadius="none"
      overflow="hidden"
      border="1px solid"
      borderColor="primary"
      bg="background"
      h="100%"
      _hover={{
        boxShadow: '0 0 20px rgba(167, 255, 0, 0.3), inset 0 0 40px rgba(167, 255, 0, 0.05)',
        textDecoration: 'none',
      }}
      transition="box-shadow 0.25s"
      cursor="pointer"
    >
      {/* ── Status bar ────────────────────────── */}
      <HStack
        px={3}
        py={2}
        justify="space-between"
        align="center"
        borderBottom="1px solid"
        borderColor="border"
      >
        {hasWinner ? (
          /* Winner display for closed bounties */
          <HStack spacing={2} align="center">
            <Avatar
              src={bounty.winnerAvatar ?? undefined}
              name={bounty.winnerDisplay ?? ''}
              size="2xs"
              borderRadius="none"
              border="1px solid"
              borderColor="warning"
            />
            <Icon as={FaTrophy} boxSize="10px" color="warning" />
            <Text
              fontSize="2xs"
              fontWeight="bold"
              fontFamily="mono"
              color="warning"
              noOfLines={1}
              maxW="120px"
            >
              {bounty.winnerDisplay}
            </Text>
          </HStack>
        ) : (
          /* Status badge for open/closed without winner */
          <Box
            border="1px solid"
            borderColor={bounty.isActive ? 'success' : 'error'}
            px={2.5}
            py={0.5}
          >
            <Text
              fontSize="2xs"
              fontWeight="bold"
              fontFamily="mono"
              color={bounty.isActive ? 'success' : 'error'}
              textTransform="uppercase"
              letterSpacing="wider"
            >
              {bounty.statusLabel}
            </Text>
          </Box>
        )}

        {/* Proof dots */}
        <HStack spacing={1} align="center">
          {Array.from({ length: maxDots }).map((_, i) => (
            <Box
              key={i}
              w="5px"
              h="5px"
              bg={i < filledDots ? 'primary' : 'border'}
              opacity={i < filledDots ? 1 : 0.25}
            />
          ))}
        </HStack>
      </HStack>

      {/* ── Reward display (full width, centered) ── */}
      <Box px={3} py={3}>
        <Tooltip
          label={usdValue ? `~ ${usdValue} USD` : undefined}
          isDisabled={!usdValue}
          placement="top"
          bg="background"
          color="primary"
          border="1px solid"
          borderColor="primary"
          fontFamily="mono"
          fontSize="xs"
          fontWeight="bold"
          borderRadius="none"
          px={3}
          py={1}
        >
          <Box
            border="1px solid"
            borderColor="primary"
            px={4}
            py={2}
            bg="rgba(167, 255, 0, 0.03)"
            w="100%"
          >
            <HStack spacing={2} align="center" justify="center">
              <Icon as={sourceIcon} boxSize="16px" color={sourceIconColor} />
              <Text
                fontWeight="900"
                fontSize="xl"
                color="primary"
                fontFamily="mono"
                lineHeight="1"
              >
                {rewardStr}
              </Text>
              <Text fontSize="sm" color="dim" fontWeight="bold" fontFamily="mono">
                {bounty.rewardCurrency}
              </Text>
            </HStack>
          </Box>
        </Tooltip>
      </Box>

      {/* ── Content (fixed height for uniform cards) ── */}
      <VStack align="stretch" spacing={1.5} px={3} pb={3} flex={1}>
        <Box minH="36px">
          <Text
            fontWeight="bold"
            fontSize="sm"
            color="text"
            noOfLines={2}
            lineHeight="short"
            textTransform="uppercase"
          >
            {bounty.title}
          </Text>
        </Box>

        <Box minH="32px">
          <Text fontSize="xs" color="dim" noOfLines={2} lineHeight="tall" fontFamily="mono">
            {bounty.description}
          </Text>
        </Box>
      </VStack>

      {/* ── Deadline countdown (if active) ────── */}
      {countdown && (
        <HStack
          px={3}
          py={1}
          borderTop="1px solid"
          borderColor="border"
          bg="rgba(167, 255, 0, 0.03)"
          spacing={2}
        >
          <Text fontSize="2xs" color="warning" fontFamily="mono" fontWeight="bold">
            ENDS IN {countdown}
          </Text>
        </HStack>
      )}

      {/* ── Footer: date + CTA button ─────────── */}
      <HStack
        px={3}
        py={2}
        justify="space-between"
        align="center"
        borderTop="1px solid"
        borderColor="border"
        mt="auto"
      >
        <HStack spacing={1.5} align="center">
          {createdDate && (
            <>
              <Icon as={FaCalendar} boxSize="10px" color="dim" />
              <Text fontSize="2xs" color="dim" fontFamily="mono" fontWeight="bold">
                {createdDate}
              </Text>
            </>
          )}
        </HStack>

        <HStack
          spacing={1.5}
          align="center"
          border="1px solid"
          borderColor="primary"
          px={2.5}
          py={1}
        >
          <Icon as={ctaIcon} boxSize="10px" color="primary" />
          <Text fontSize="2xs" color="primary" fontFamily="mono" fontWeight="bold" textTransform="uppercase">
            {ctaLabel}
          </Text>
        </HStack>
      </HStack>
    </Box>
  );
}
