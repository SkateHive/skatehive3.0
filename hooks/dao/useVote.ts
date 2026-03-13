/**
 * Vote Hook
 * Submit votes on proposals
 */

import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { type Address } from 'viem';
import GOVERNOR_ABI from '@/lib/utils/abis/governor';

export type VoteSupport = 0 | 1 | 2; // 0=Against, 1=For, 2=Abstain

/**
 * Hook to cast votes on proposals
 * @returns Vote function and transaction state
 */
export function useVote(governorAddress: Address) {
  const { data: hash, writeContract, ...writeState } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
    });

  /**
   * Cast a vote on a proposal
   * @param proposalId - Proposal ID (bytes32)
   * @param support - Vote type (0=Against, 1=For, 2=Abstain)
   * @param reason - Optional vote reason
   */
  const vote = (proposalId: string, support: VoteSupport, reason?: string) => {
    if (reason && reason.trim()) {
      // Cast vote with reason
      writeContract({
        address: governorAddress,
        abi: GOVERNOR_ABI,
        functionName: 'castVoteWithReason',
        args: [proposalId as `0x${string}`, BigInt(support), reason],
      });
    } else {
      // Cast vote without reason
      writeContract({
        address: governorAddress,
        abi: GOVERNOR_ABI,
        functionName: 'castVote',
        args: [proposalId as `0x${string}`, BigInt(support)],
      });
    }
  };

  return {
    vote,
    hash,
    isConfirming,
    isConfirmed,
    ...writeState,
  };
}
