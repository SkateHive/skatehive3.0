import { Box, Text, Badge, HStack, VStack, Link, Tooltip } from '@chakra-ui/react';
import { formatEther } from 'viem';
import type { PoidhBounty } from '@/types/poidh';

interface PoidhBountyCardProps {
  bounty: PoidhBounty;
}

export function PoidhBountyCard({ bounty }: PoidhBountyCardProps) {
  const amountInEth = formatEther(BigInt(bounty.amount));
  const isActive = !bounty.claimer;
  const createdDate = new Date(bounty.createdAt * 1000).toLocaleDateString();

  return (
    <Box
      borderWidth="1px"
      borderRadius="lg"
      p={4}
      bg={isActive ? 'bg' : 'gray.50'}
      _hover={{ borderColor: 'primary', transform: 'translateY(-2px)' }}
      transition="all 0.2s"
    >
      <VStack align="stretch" gap={3}>
        {/* Header */}
        <HStack justify="space-between">
          <Badge colorScheme={isActive ? 'green' : 'gray'} fontSize="xs">
            {isActive ? 'Active' : 'Claimed'}
          </Badge>
          <Text fontSize="xs" color="textSecondary">
            {createdDate}
          </Text>
        </HStack>

        {/* Title */}
        <Text fontWeight="bold" fontSize="lg" noOfLines={2}>
          {bounty.name}
        </Text>

        {/* Description */}
        <Text fontSize="sm" color="textSecondary" noOfLines={3}>
          {bounty.description}
        </Text>

        {/* Footer */}
        <HStack justify="space-between" pt={2} borderTopWidth="1px">
          <VStack align="start" gap={0}>
            <Text fontSize="xs" color="textSecondary">
              Reward
            </Text>
            <HStack>
              <Text fontWeight="bold" fontSize="md" color="primary">
                {parseFloat(amountInEth).toFixed(4)} ETH
              </Text>
              <Text fontSize="xs" color="textSecondary">
                (Base)
              </Text>
            </HStack>
          </VStack>

          {bounty.claimCount !== undefined && bounty.claimCount > 0 && (
            <Tooltip label={`${bounty.claimCount} claim${bounty.claimCount > 1 ? 's' : ''} submitted`}>
              <Badge colorScheme="blue" fontSize="xs">
                {bounty.claimCount} {bounty.claimCount === 1 ? 'claim' : 'claims'}
              </Badge>
            </Tooltip>
          )}
        </HStack>

        {/* Link to POIDH */}
        <Link
          href={`https://poidh.xyz/bounty/${bounty.id}`}
          isExternal
          fontSize="sm"
          color="primary"
          textDecor="underline"
        >
          View on POIDH →
        </Link>
      </VStack>
    </Box>
  );
}
