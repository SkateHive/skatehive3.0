"use client";

import {
  Box,
  VStack,
  HStack,
  Text,
  Progress,
  Button,
  Badge,
  Skeleton,
  Divider,
  Image,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { fetchProposalByNumber } from "@/lib/dao/governance";
import { useVotingPower } from "@/hooks/dao/useVotingPower";
import { useVote, type VoteSupport } from "@/hooks/dao/useVote";
import { useAccount, useEnsName } from "wagmi";
import { getDaoByDomain, parseProposalUrl } from "@/lib/dao/config";
import { getProposalStatus } from "@/lib/dao/governance";
import { useMemo } from "react";
import type { Address } from "viem";
import { mainnet } from "viem/chains";

/**
 * Extract banner image from proposal description markdown
 */
function extractBannerImage(description: string): string | null {
  // Match ![Banner](url) or similar markdown image syntax
  const imageMatch = description.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
  return imageMatch ? imageMatch[1] : null;
}

/**
 * Strip markdown image syntax from description
 */
function stripImageMarkdown(description: string): string {
  return description.replace(/!\[.*?\]\([^\)]+\)/g, '').trim();
}

interface ProposalPreviewProps {
  url: string; // Full URL like "https://www.gnars.com/proposals/118"
}

/**
 * Proposal Preview Component
 * Mini-app for displaying Builder DAO proposals in markdown
 */
export default function ProposalPreview({ url }: ProposalPreviewProps) {
  // Parse URL to get domain and proposal ID
  const parsed = useMemo(() => parseProposalUrl(url), [url]);
  
  if (!parsed) {
    return (
      <Box border="1px" borderColor="red.500" p={3} my={4} borderRadius="none">
        <Text color="red.400" fontSize="sm">
          Invalid proposal URL
        </Text>
      </Box>
    );
  }

  const { domain, proposalId } = parsed;
  const dao = getDaoByDomain(domain);

  if (!dao) {
    return (
      <Box border="1px" borderColor="gray.600" p={3} my={4} borderRadius="none">
        <Text color="gray.400" fontSize="sm">
          DAO not supported: {domain}
        </Text>
      </Box>
    );
  }

  return <ProposalPreviewContent daoUrl={url} dao={dao} proposalId={proposalId} />;
}

interface ProposalPreviewContentProps {
  daoUrl: string;
  dao: any;
  proposalId: string;
}

function ProposalPreviewContent({ daoUrl, dao, proposalId }: ProposalPreviewContentProps) {
  const proposalNumber = parseInt(proposalId, 10);
  
  const { data: proposal, isLoading } = useQuery({
    queryKey: ['proposal', dao.addresses.token, proposalNumber],
    queryFn: () => fetchProposalByNumber(dao.addresses.token, proposalNumber),
    enabled: !isNaN(proposalNumber),
  });
  
  const { address } = useAccount();
  const { data: votingPower } = useVotingPower(
    dao.addresses.governor as Address,
    address
  );
  const { vote, isPending, isConfirming, isConfirmed } = useVote(
    dao.addresses.governor as Address
  );

  // Resolve ENS name for proposer
  const { data: ensName } = useEnsName({
    address: proposal?.proposer as Address,
    chainId: mainnet.id,
  });

  // Extract banner image from description
  const bannerImage = useMemo(() => {
    return proposal?.description ? extractBannerImage(proposal.description) : null;
  }, [proposal?.description]);

  // Clean description (remove image markdown)
  const cleanDescription = useMemo(() => {
    return proposal?.description ? stripImageMarkdown(proposal.description) : '';
  }, [proposal?.description]);

  // Calculate vote percentages
  const { forPercent, againstPercent, abstainPercent, totalVotes } = useMemo(() => {
    if (!proposal) return { forPercent: 0, againstPercent: 0, abstainPercent: 0, totalVotes: 0n };

    const forVotes = BigInt(proposal.forVotes || '0');
    const againstVotes = BigInt(proposal.againstVotes || '0');
    const abstainVotes = BigInt(proposal.abstainVotes || '0');
    const total = forVotes + againstVotes + abstainVotes;

    if (total === 0n) {
      return { forPercent: 0, againstPercent: 0, abstainPercent: 0, totalVotes: total };
    }

    return {
      forPercent: Number((forVotes * 100n) / total),
      againstPercent: Number((againstVotes * 100n) / total),
      abstainPercent: Number((abstainVotes * 100n) / total),
      totalVotes: total,
    };
  }, [proposal]);

  // Get proposal status
  const status = useMemo(() => {
    if (!proposal) return 'Unknown';
    return getProposalStatus(proposal);
  }, [proposal]);

  // Status badge color
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

  // Check if user can vote
  const canVote = useMemo(() => {
    return (
      status === 'Active' &&
      votingPower &&
      votingPower > 0n &&
      address
    );
  }, [status, votingPower, address]);

  const handleVote = (support: VoteSupport) => {
    vote(proposalId, support);
  };

  if (isLoading) {
    return (
      <Box border="1px" borderColor="gray.600" p={4} my={4} borderRadius="none">
        <VStack align="start" spacing={3}>
          <Skeleton height="20px" width="70%" />
          <Skeleton height="15px" width="40%" />
          <Skeleton height="60px" width="100%" />
        </VStack>
      </Box>
    );
  }

  if (!proposal) {
    return (
      <Box border="1px" borderColor="gray.600" p={3} my={4} borderRadius="none">
        <Text color="gray.400" fontSize="sm">
          Proposal not found
        </Text>
      </Box>
    );
  }

  return (
    <Box
      border="1px"
      borderColor="gray.600"
      borderRadius="none"
      p={4}
      my={4}
      overflow="hidden"
      wordBreak="break-word"
    >
      <VStack align="start" spacing={3} width="full">
        {/* Header */}
        <HStack justify="space-between" width="full" flexWrap="wrap">
          <Text fontWeight="bold" fontSize="lg">
            🏛️ {dao.name} - Proposal #{proposal.proposalNumber || proposalId.slice(0, 6)}
          </Text>
          <Badge colorScheme={statusColor} borderRadius="none">
            {status}
          </Badge>
        </HStack>

        {/* Banner Image */}
        {bannerImage && (
          <Box width="full" overflow="hidden" borderRadius="none">
            <Image
              src={bannerImage}
              alt="Proposal banner"
              width="100%"
              height="auto"
              maxH="300px"
              objectFit="cover"
            />
          </Box>
        )}

        {/* Title */}
        <Text fontWeight="semibold" fontSize="md">
          {proposal.title}
        </Text>

        {/* Proposer */}
        <Text fontSize="sm" color="gray.400">
          👤 Proposer: {ensName || `${proposal.proposer.slice(0, 6)}...${proposal.proposer.slice(-4)}`}
        </Text>

        <Divider />

        {/* Voting Stats */}
        <VStack width="full" spacing={2}>
          <HStack width="full" justify="space-between" fontSize="sm">
            <Text color="green.400">✅ For: {forPercent}%</Text>
            <Text color="red.400">❌ Against: {againstPercent}%</Text>
          </HStack>
          
          <Progress
            value={forPercent}
            width="full"
            colorScheme="green"
            borderRadius="none"
            size="sm"
          />
          
          <HStack width="full" justify="space-between" fontSize="xs" color="gray.500">
            <Text>⚪ Abstain: {abstainPercent}%</Text>
            <Text>🎯 Threshold: {proposal.quorumVotes} votes</Text>
          </HStack>
        </VStack>

        {/* Description Preview */}
        {cleanDescription && (
          <Text fontSize="sm" color="gray.300" noOfLines={3}>
            {cleanDescription}
          </Text>
        )}

        <Divider />

        {/* Voting Buttons (always shown) */}
        <VStack width="full" spacing={2}>
          {address && votingPower !== undefined && (
            <Text fontSize="xs" color="gray.400">
              Your voting power: {votingPower.toString()} votes
            </Text>
          )}
          <HStack width="full" spacing={2}>
            <Button
              size="sm"
              colorScheme="green"
              onClick={() => handleVote(1)}
              isLoading={isPending || isConfirming}
              isDisabled={!canVote || isConfirmed}
              flex={1}
              borderRadius="none"
            >
              For
            </Button>
            <Button
              size="sm"
              colorScheme="red"
              onClick={() => handleVote(0)}
              isLoading={isPending || isConfirming}
              isDisabled={!canVote || isConfirmed}
              flex={1}
              borderRadius="none"
            >
              Against
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleVote(2)}
              isLoading={isPending || isConfirming}
              isDisabled={!canVote || isConfirmed}
              flex={1}
              borderRadius="none"
            >
              Abstain
            </Button>
          </HStack>
          {isConfirmed && (
            <Text fontSize="xs" color="green.400">
              ✅ Vote submitted successfully!
            </Text>
          )}
          {!canVote && !address && (
            <Text fontSize="xs" color="gray.500">
              Connect wallet to vote
            </Text>
          )}
          {!canVote && address && votingPower === 0n && (
            <Text fontSize="xs" color="gray.500">
              You need voting power to participate
            </Text>
          )}
          {!canVote && address && votingPower && votingPower > 0n && status !== 'Active' && (
            <Text fontSize="xs" color="gray.500">
              Voting is not active for this proposal
            </Text>
          )}
        </VStack>

        {/* View Full Link */}
        <Button
          as="a"
          href={daoUrl}
          target="_blank"
          rel="noopener noreferrer"
          size="sm"
          variant="link"
          colorScheme="blue"
          borderRadius="none"
        >
          🔗 View Full Proposal
        </Button>
      </VStack>
    </Box>
  );
}
