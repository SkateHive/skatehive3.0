import { Box, Text, Badge, HStack, VStack, Link, Tooltip, Button } from '@chakra-ui/react';
import { formatEther } from 'viem';
import type { PoidhBounty } from '@/types/poidh';

interface PoidhBountyCardProps {
  bounty: PoidhBounty;
}

const CHAIN_LABEL: Record<number, string> = {
  8453: 'Base',
  42161: 'Arbitrum',
};

const CHAIN_PATH: Record<number, string> = {
  8453: 'base',
  42161: 'arbitrum',
};

function getPoidhUrl(bounty: PoidhBounty) {
  const chainId = bounty.chainId;
  if (!chainId) return `https://poidh.xyz`; // fallback
  const path = CHAIN_PATH[chainId];
  if (!path) return `https://poidh.xyz`;
  return `https://poidh.xyz/${path}/bounty/${bounty.id}`;
}

export function PoidhBountyCard({ bounty }: PoidhBountyCardProps) {
  const amountInEth = formatEther(BigInt(bounty.amount));
  const isActive = !bounty.claimer;
  const createdDate = new Date(bounty.createdAt * 1000).toLocaleDateString();
  const chainId = bounty.chainId;

  return (
    <Box
      borderWidth="2px"
      borderColor="border"
      borderRadius="xl"
      p={5}
      bg="background"
      _hover={{
        borderColor: 'primary',
        transform: 'translateY(-4px)',
        shadow: 'lg',
      }}
      transition="all 0.2s"
      height="100%"
      display="flex"
      flexDirection="column"
    >
      <VStack align="stretch" gap={4} flex="1">
        {/* Header */}
        <HStack justify="space-between">
          <HStack gap={2}>
            <Badge
              colorScheme={isActive ? 'green' : 'gray'}
              fontSize="xs"
              px={2}
              py={1}
              borderRadius="md"
            >
              {isActive ? '🟢 Active' : '✅ Claimed'}
            </Badge>
            {chainId && CHAIN_LABEL[chainId] && (
              <Badge fontSize="xs" px={2} py={1} borderRadius="md" colorScheme="purple">
                {CHAIN_LABEL[chainId]}
              </Badge>
            )}
          </HStack>
          <Text fontSize="xs" color="textSecondary">
            {createdDate}
          </Text>
        </HStack>

        {/* Title */}
        <Text fontWeight="bold" fontSize="xl" noOfLines={2} color="text">
          {bounty.name}
        </Text>

        {/* Description */}
        <Text fontSize="sm" color="textSecondary" noOfLines={4} flex="1">
          {bounty.description}
        </Text>

        {/* Reward */}
        <Box bg="surfaceVariant" p={3} borderRadius="lg" borderWidth="1px" borderColor="border">
          <VStack align="start" gap={1}>
            <Text fontSize="xs" color="textSecondary" fontWeight="medium">
              Reward
            </Text>
            <HStack>
              <Text fontWeight="bold" fontSize="2xl" color="primary">
                {parseFloat(amountInEth).toFixed(4)}
              </Text>
              <Text fontSize="sm" color="textSecondary" fontWeight="medium">
                ETH
              </Text>
            </HStack>
          </VStack>
        </Box>

        {/* Footer */}
        <HStack justify="space-between" pt={2}>
          {bounty.claimCount !== undefined && bounty.claimCount > 0 && (
            <Tooltip label={`${bounty.claimCount} claim${bounty.claimCount > 1 ? 's' : ''} submitted`}>
              <Badge colorScheme="blue" fontSize="xs" px={2} py={1}>
                📋 {bounty.claimCount} {bounty.claimCount === 1 ? 'claim' : 'claims'}
              </Badge>
            </Tooltip>
          )}

          <Button
            as={Link}
            href={getPoidhUrl(bounty)}
            isExternal
            size="sm"
            colorScheme="brand"
            variant="outline"
            _hover={{ textDecor: 'none' }}
          >
            View on POIDH →
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}
