"use client";

import {
  Box,
  Text,
  Badge,
  HStack,
  VStack,
  Button,
  Link,
} from "@chakra-ui/react";
import type { PoidhBounty } from "@/types/poidh";
import {
  getChainName,
  formatBountyAmount,
} from "@/hooks/usePoidhBounties";
import { ExternalLinkIcon } from "@chakra-ui/icons";

interface PoidhBountyCardProps {
  bounty: PoidhBounty;
}

export default function PoidhBountyCard({ bounty }: PoidhBountyCardProps) {
  const chainName = getChainName(bounty.chainId);
  const amountFormatted = formatBountyAmount(bounty.amount);
  const explorerUrl = getExplorerUrl(bounty.chainId, bounty.id);
  const createdDate = new Date(bounty.createdAt * 1000).toLocaleDateString();

  const getStatusColor = () => {
    if (bounty.isCancelled) return "red";
    if (bounty.hasActiveClaim || bounty.amount === 0n) return "green";
    return "yellow";
  };

  const getStatusLabel = () => {
    if (bounty.isCancelled) return "Cancelled";
    if (bounty.hasActiveClaim) return "Active Claim";
    if (bounty.amount === 0n) return "Completed";
    return "Active";
  };

  return (
    <Box
      borderWidth="2px"
      borderColor="primary"
      borderRadius="lg"
      p={4}
      bg="background"
      _hover={{
        borderColor: "accent",
        transform: "translateY(-2px)",
        transition: "all 0.2s",
      }}
    >
      <VStack align="stretch" spacing={3}>
        {/* Header */}
        <HStack justify="space-between">
          <Badge colorScheme="purple" fontSize="xs">
            {chainName}
          </Badge>
          <Badge colorScheme={getStatusColor()} fontSize="xs">
            {getStatusLabel()}
          </Badge>
        </HStack>

        {/* Title */}
        <Text
          fontSize="xl"
          fontWeight="bold"
          color="primary"
          noOfLines={2}
        >
          {bounty.name}
        </Text>

        {/* Description */}
        <Text
          fontSize="sm"
          color="text"
          noOfLines={3}
          minHeight="60px"
        >
          {bounty.description || "No description provided"}
        </Text>

        {/* Amount & Info */}
        <HStack justify="space-between" wrap="wrap" spacing={2}>
          <Box>
            <Text fontSize="xs" color="muted">
              Reward
            </Text>
            <Text fontSize="lg" fontWeight="bold" color="accent">
              {amountFormatted}
            </Text>
          </Box>
          <Box>
            <Text fontSize="xs" color="muted">
              Created
            </Text>
            <Text fontSize="sm" color="text">
              {createdDate}
            </Text>
          </Box>
          {bounty.claimIds && bounty.claimIds.length > 0 && (
            <Box>
              <Text fontSize="xs" color="muted">
                Claims
              </Text>
              <Text fontSize="sm" color="text">
                {bounty.claimIds.length}
              </Text>
            </Box>
          )}
        </HStack>

        {/* Type Badge */}
        <Badge
          alignSelf="flex-start"
          colorScheme={bounty.isOpen ? "blue" : "orange"}
          fontSize="xs"
        >
          {bounty.isOpen ? "Open Bounty" : "Solo Bounty"}
        </Badge>

        {/* Actions */}
        <HStack spacing={2}>
          <Button
            as={Link}
            href={explorerUrl}
            isExternal
            size="sm"
            variant="outline"
            colorScheme="primary"
            rightIcon={<ExternalLinkIcon />}
            flex={1}
          >
            View on Explorer
          </Button>
          {!bounty.isCancelled && bounty.amount > 0n && (
            <Button
              size="sm"
              colorScheme="green"
              flex={1}
              onClick={() => {
                // TODO: Implement claim submission
                alert("Claim submission coming soon!");
              }}
            >
              Submit Claim
            </Button>
          )}
        </HStack>
      </VStack>
    </Box>
  );
}

// Helper: Get block explorer URL
function getExplorerUrl(chainId: number, bountyId: number): string {
  const contractAddress = "0xdffe8a4a4103f968ffd61fd082d08c41dcf9b940";
  
  switch (chainId) {
    case 42161: // Arbitrum
      return `https://arbiscan.io/address/${contractAddress}`;
    case 8453: // Base
      return `https://basescan.org/address/${contractAddress}`;
    case 666666666: // Degen
      return `https://explorer.degen.tips/address/${contractAddress}`;
    default:
      return "#";
  }
}
