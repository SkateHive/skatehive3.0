/**
 * Voting Power Hook
 * Check user's voting power for governance
 */

import { useReadContract } from 'wagmi';
import { type Address } from 'viem';
import GOVERNOR_ABI from '@/lib/utils/abis/governor';

/**
 * Hook to check voting power at a specific timestamp
 * @param governorAddress - Governor contract address
 * @param address - User address to check
 * @param timestamp - Timestamp to check (default: current time)
 * @returns Voting power (number of votes)
 */
export function useVotingPower(
  governorAddress: Address,
  address?: Address,
  timestamp?: number
) {
  const effectiveTimestamp = timestamp || Math.floor(Date.now() / 1000);

  return useReadContract({
    address: governorAddress,
    abi: GOVERNOR_ABI,
    functionName: 'getVotes',
    args: address ? [address, BigInt(effectiveTimestamp)] : undefined,
    query: {
      enabled: !!address,
    },
  });
}
