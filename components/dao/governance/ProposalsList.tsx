"use client";

import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Skeleton,
  Grid,
  GridItem,
  Button,
  Divider,
} from "@chakra-ui/react";
import { useProposals } from "@/hooks/dao/useProposals";
import { getProposalStatus } from "@/lib/dao/governance";
import { useMemo } from "react";
import type { Proposal } from "@/lib/dao/types";
import NextLink from "next/link";

interface ProposalsListProps {
  daoAddress: string;
  limit?: number;
}

/**
 * Proposals List Component
 * Displays all proposals for a DAO
 */
export default function ProposalsList({ daoAddress, limit = 50 }: ProposalsListProps) {
  const { data: proposals, isLoading, error } = useProposals(daoAddress, limit);

  if (isLoading) {
    return (
      <VStack spacing={4} width="full">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} height="120px" width="full" borderRadius="none" />
        ))}
      </VStack>
    );
  }

  if (error) {
    return (
      <Box p={4} border="1px" borderColor="red.500" borderRadius="none">
        <Text color="red.400">Error loading proposals</Text>
      </Box>
    );
  }

  if (!proposals || proposals.length === 0) {
    return (
      <Box p={8} textAlign="center">
        <Text color="gray.400">No proposals found</Text>
      </Box>
    );
  }

  return (
    <VStack spacing={4} width="full">
      {proposals.map((proposal) => (
        <ProposalCard key={proposal.proposalId} proposal={proposal} />
      ))}
    </VStack>
  );
}

interface ProposalCardProps {
  proposal: Proposal;
}

function ProposalCard({ proposal }: ProposalCardProps) {
  const status = useMemo(() => getProposalStatus(proposal), [proposal]);

  const statusColor = useMemo(() => {
    switch (status) {
      case 'Active':
        return 'green';
      case 'Succeeded':
        return 'blue';
      case 'Executed':
        return 'purple';
      case 'Defeated':
      case 'Canceled':
      case 'Vetoed':
        return 'red';
      case 'Pending':
        return 'yellow';
      case 'Queued':
        return 'cyan';
      default:
        return 'gray';
    }
  }, [status]);

  const { forPercent, againstPercent, totalVotes } = useMemo(() => {
    const forVotes = BigInt(proposal.forVotes || '0');
    const againstVotes = BigInt(proposal.againstVotes || '0');
    const abstainVotes = BigInt(proposal.abstainVotes || '0');
    const total = forVotes + againstVotes + abstainVotes;

    if (total === 0n) {
      return { forPercent: 0, againstPercent: 0, totalVotes: total };
    }

    return {
      forPercent: Number((forVotes * 100n) / total),
      againstPercent: Number((againstVotes * 100n) / total),
      totalVotes: total,
    };
  }, [proposal]);

  return (
    <Box
      width="full"
      border="1px"
      borderColor="gray.600"
      borderRadius="none"
      p={4}
      _hover={{ borderColor: 'gray.500', bg: 'whiteAlpha.50' }}
      transition="all 0.2s"
    >
      <Grid templateColumns={{ base: '1fr', md: '1fr auto' }} gap={4}>
        <GridItem>
          <VStack align="start" spacing={2}>
            {/* Header */}
            <HStack spacing={3} flexWrap="wrap">
              <Text fontWeight="bold" fontSize="lg">
                Proposal #{proposal.proposalNumber || proposal.proposalId.slice(0, 6)}
              </Text>
              <Badge colorScheme={statusColor} borderRadius="none">
                {status}
              </Badge>
            </HStack>

            {/* Title */}
            <Text fontSize="md" fontWeight="semibold">
              {proposal.title}
            </Text>

            {/* Description Preview */}
            {proposal.description && (
              <Text fontSize="sm" color="gray.400" noOfLines={2}>
                {proposal.description}
              </Text>
            )}

            {/* Proposer */}
            <Text fontSize="xs" color="gray.500">
              Proposer: {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}
            </Text>
          </VStack>
        </GridItem>

        <GridItem>
          <VStack align="end" spacing={2} height="full" justify="space-between">
            {/* Vote Stats */}
            <VStack align="end" spacing={1}>
              <HStack spacing={2} fontSize="sm">
                <Text color="green.400">✅ {forPercent}%</Text>
                <Text color="red.400">❌ {againstPercent}%</Text>
              </HStack>
              <Text fontSize="xs" color="gray.500">
                {totalVotes.toString()} total votes
              </Text>
            </VStack>

            {/* View Button */}
            <Button
              as={NextLink}
              href={`/dao/proposals/${proposal.proposalId}`}
              size="sm"
              colorScheme="blue"
              variant="outline"
              borderRadius="none"
            >
              View Details
            </Button>
          </VStack>
        </GridItem>
      </Grid>
    </Box>
  );
}
