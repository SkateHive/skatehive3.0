"use client";

import {
  Container,
  VStack,
  HStack,
  Text,
  Heading,
  Badge,
  Progress,
  Button,
  Box,
  Skeleton,
  Divider,
  Grid,
  GridItem,
} from "@chakra-ui/react";
import { useProposal } from "@/hooks/dao/useProposal";
import { useVotingPower } from "@/hooks/dao/useVotingPower";
import { useVote, type VoteSupport } from "@/hooks/dao/useVote";
import { useAccount } from "wagmi";
import { DAO_ADDRESSES } from "@/lib/utils/constants";
import { getProposalStatus } from "@/lib/dao/governance";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { Address } from "viem";

interface ProposalDetailClientProps {
  proposalId: string;
}

/**
 * Proposal Detail Client Component
 * Full page view of a single proposal
 */
export default function ProposalDetailClient({ proposalId }: ProposalDetailClientProps) {
  const router = useRouter();
  const { data: proposal, isLoading } = useProposal(proposalId);
  const { address } = useAccount();
  const { data: votingPower } = useVotingPower(
    DAO_ADDRESSES.governor as Address,
    address
  );
  const { vote, isPending, isConfirming, isConfirmed } = useVote(
    DAO_ADDRESSES.governor as Address
  );

  const status = useMemo(() => {
    if (!proposal) return 'Unknown';
    return getProposalStatus(proposal);
  }, [proposal]);

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
      <Container maxW="5xl" py={8}>
        <VStack spacing={6} align="stretch">
          <Skeleton height="40px" width="60%" />
          <Skeleton height="200px" />
          <Skeleton height="300px" />
        </VStack>
      </Container>
    );
  }

  if (!proposal) {
    return (
      <Container maxW="5xl" py={8}>
        <Box p={8} textAlign="center">
          <Text color="red.400" fontSize="lg">
            Proposal not found
          </Text>
          <Button mt={4} onClick={() => router.push('/dao')} borderRadius="none">
            Back to DAO
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="5xl" py={8}>
      <VStack spacing={6} align="stretch">
        {/* Back Button */}
        <Button
          onClick={() => router.push('/dao')}
          variant="ghost"
          alignSelf="flex-start"
          borderRadius="none"
        >
          ← Back to Proposals
        </Button>

        {/* Header */}
        <HStack justify="space-between" flexWrap="wrap">
          <Heading size="lg">
            Proposal #{proposal.proposalNumber || proposalId.slice(0, 8)}
          </Heading>
          <Badge colorScheme={statusColor} fontSize="md" borderRadius="none" px={3} py={1}>
            {status}
          </Badge>
        </HStack>

        {/* Title */}
        <Heading size="md">{proposal.title}</Heading>

        {/* Proposer */}
        <Text fontSize="sm" color="gray.400">
          Proposed by: {proposal.proposer}
        </Text>

        <Divider />

        {/* Voting Section */}
        <Box
          border="1px"
          borderColor="gray.600"
          borderRadius="none"
          p={6}
        >
          <VStack spacing={4} align="stretch">
            <Heading size="sm">Voting</Heading>

            <Grid templateColumns="repeat(3, 1fr)" gap={4}>
              <GridItem>
                <VStack spacing={1}>
                  <Text fontSize="sm" color="green.400">
                    ✅ For
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold">
                    {forPercent}%
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {proposal.forVotes} votes
                  </Text>
                </VStack>
              </GridItem>

              <GridItem>
                <VStack spacing={1}>
                  <Text fontSize="sm" color="red.400">
                    ❌ Against
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold">
                    {againstPercent}%
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {proposal.againstVotes} votes
                  </Text>
                </VStack>
              </GridItem>

              <GridItem>
                <VStack spacing={1}>
                  <Text fontSize="sm" color="gray.400">
                    ⚪ Abstain
                  </Text>
                  <Text fontSize="2xl" fontWeight="bold">
                    {abstainPercent}%
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {proposal.abstainVotes} votes
                  </Text>
                </VStack>
              </GridItem>
            </Grid>

            <Progress
              value={forPercent}
              colorScheme="green"
              size="lg"
              borderRadius="none"
            />

            <HStack justify="space-between" fontSize="sm" color="gray.500">
              <Text>Total votes: {totalVotes.toString()}</Text>
              <Text>Quorum: {proposal.quorumVotes} votes</Text>
            </HStack>

            {/* Voting Buttons */}
            {canVote ? (
              <VStack spacing={3} pt={4}>
                <Text fontSize="sm" color="gray.400">
                  Your voting power: {votingPower?.toString()} votes
                </Text>
                <HStack width="full" spacing={3}>
                  <Button
                    flex={1}
                    size="lg"
                    colorScheme="green"
                    onClick={() => handleVote(1)}
                    isLoading={isPending || isConfirming}
                    isDisabled={isConfirmed}
                    borderRadius="none"
                  >
                    Vote For
                  </Button>
                  <Button
                    flex={1}
                    size="lg"
                    colorScheme="red"
                    onClick={() => handleVote(0)}
                    isLoading={isPending || isConfirming}
                    isDisabled={isConfirmed}
                    borderRadius="none"
                  >
                    Vote Against
                  </Button>
                  <Button
                    flex={1}
                    size="lg"
                    variant="outline"
                    onClick={() => handleVote(2)}
                    isLoading={isPending || isConfirming}
                    isDisabled={isConfirmed}
                    borderRadius="none"
                  >
                    Abstain
                  </Button>
                </HStack>
                {isConfirmed && (
                  <Text fontSize="sm" color="green.400">
                    ✅ Vote submitted successfully!
                  </Text>
                )}
              </VStack>
            ) : !address ? (
              <Text fontSize="sm" color="gray.500" textAlign="center" pt={4}>
                Connect your wallet to vote
              </Text>
            ) : votingPower === 0n ? (
              <Text fontSize="sm" color="gray.500" textAlign="center" pt={4}>
                You need voting power to participate in governance
              </Text>
            ) : (
              <Text fontSize="sm" color="gray.500" textAlign="center" pt={4}>
                Voting is not currently active for this proposal
              </Text>
            )}
          </VStack>
        </Box>

        <Divider />

        {/* Description */}
        <Box>
          <Heading size="sm" mb={4}>
            Description
          </Heading>
          <Text whiteSpace="pre-wrap" color="gray.300">
            {proposal.description}
          </Text>
        </Box>

        {/* Proposal Details */}
        {(proposal.targets && proposal.targets.length > 0) && (
          <>
            <Divider />
            <Box>
              <Heading size="sm" mb={4}>
                Proposed Transactions
              </Heading>
              <VStack spacing={3} align="stretch">
                {proposal.targets.map((target, idx) => (
                  <Box
                    key={idx}
                    p={4}
                    border="1px"
                    borderColor="gray.600"
                    borderRadius="none"
                  >
                    <Text fontSize="sm" fontFamily="mono">
                      <Text as="span" color="gray.500">
                        Target:
                      </Text>{' '}
                      {target}
                    </Text>
                    {proposal.values && proposal.values[idx] && (
                      <Text fontSize="sm" fontFamily="mono">
                        <Text as="span" color="gray.500">
                          Value:
                        </Text>{' '}
                        {proposal.values[idx]}
                      </Text>
                    )}
                    {proposal.calldatas && proposal.calldatas[idx] && (
                      <Text
                        fontSize="xs"
                        fontFamily="mono"
                        color="gray.400"
                        noOfLines={2}
                      >
                        <Text as="span" color="gray.500">
                          Calldata:
                        </Text>{' '}
                        {proposal.calldatas[idx]}
                      </Text>
                    )}
                  </Box>
                ))}
              </VStack>
            </Box>
          </>
        )}
      </VStack>
    </Container>
  );
}
