'use client';

import { useReadContract } from 'wagmi';
import { formatEther } from 'viem';
import { POIDH_ABI, POIDH_CONTRACT_ADDRESS } from '@/lib/poidh-abi';

const contractBase = {
  address: POIDH_CONTRACT_ADDRESS,
  abi: POIDH_ABI,
} as const;

// ── Read participants + amounts for a bounty ──────────────────
export function usePoidhParticipants(chainId: number, bountyId: bigint | undefined) {
  const { data: participants, isLoading: participantsLoading } = useReadContract({
    ...contractBase,
    functionName: 'participants',
    args: bountyId !== undefined ? [bountyId] : undefined,
    chainId,
    query: { enabled: bountyId !== undefined },
  });

  return {
    participants: (participants as `0x${string}`[] | undefined) ?? [],
    participantsLoading,
  };
}

// ── Read a single participant's amount ────────────────────────
export function usePoidhParticipantAmount(chainId: number, bountyId: bigint | undefined, address: `0x${string}` | undefined) {
  const { data, isLoading } = useReadContract({
    ...contractBase,
    functionName: 'participantAmounts',
    args: bountyId !== undefined && address ? [bountyId, address] : undefined,
    chainId,
    query: { enabled: bountyId !== undefined && !!address },
  });

  const amount = data ? formatEther(data as bigint) : '0';
  return { amount, isLoading };
}

// ── Read voting state for a bounty ────────────────────────────
export function usePoidhVotingState(chainId: number, bountyId: bigint | undefined) {
  const { data: tracker, isLoading: trackerLoading } = useReadContract({
    ...contractBase,
    functionName: 'bountyVotingTracker',
    args: bountyId !== undefined ? [bountyId] : undefined,
    chainId,
    query: { enabled: bountyId !== undefined },
  });

  const { data: currentVotingClaim, isLoading: claimLoading } = useReadContract({
    ...contractBase,
    functionName: 'bountyCurrentVotingClaim',
    args: bountyId !== undefined ? [bountyId] : undefined,
    chainId,
    query: { enabled: bountyId !== undefined },
  });

  const { data: round, isLoading: roundLoading } = useReadContract({
    ...contractBase,
    functionName: 'voteRound',
    args: bountyId !== undefined ? [bountyId] : undefined,
    chainId,
    query: { enabled: bountyId !== undefined },
  });

  const trackerResult = tracker as [bigint, bigint, bigint] | undefined;

  return {
    yesVotes: trackerResult ? formatEther(trackerResult[0]) : '0',
    noVotes: trackerResult ? formatEther(trackerResult[1]) : '0',
    votingDeadline: trackerResult ? Number(trackerResult[2]) : 0,
    currentVotingClaimId: currentVotingClaim ? Number(currentVotingClaim as bigint) : 0,
    voteRound: round ? Number(round as bigint) : 0,
    isLoading: trackerLoading || claimLoading || roundLoading,
  };
}

// ── Read pending withdrawals for an address ───────────────────
export function usePoidhPendingWithdrawals(chainId: number, address: `0x${string}` | undefined) {
  const { data, isLoading } = useReadContract({
    ...contractBase,
    functionName: 'pendingWithdrawals',
    args: address ? [address] : undefined,
    chainId,
    query: { enabled: !!address },
  });

  return {
    pendingAmount: data ? formatEther(data as bigint) : '0',
    isLoading,
  };
}

// ── Check if bounty ever had external contributor ─────────────
export function usePoidhIsOpenBounty(chainId: number, bountyId: bigint | undefined) {
  const { data, isLoading } = useReadContract({
    ...contractBase,
    functionName: 'everHadExternalContributor',
    args: bountyId !== undefined ? [bountyId] : undefined,
    chainId,
    query: { enabled: bountyId !== undefined },
  });

  return {
    isOpenBounty: data as boolean | undefined,
    isLoading,
  };
}
