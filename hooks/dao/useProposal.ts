/**
 * Single Proposal Hook
 * Fetch a single proposal by ID
 */

import { useQuery } from '@tanstack/react-query';
import { fetchProposal } from '@/lib/dao/governance';

/**
 * Hook to fetch a single proposal
 * @param proposalId - Proposal ID (bytes32 hash)
 * @returns Query result with proposal data
 */
export function useProposal(proposalId?: string) {
  return useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: () => fetchProposal(proposalId!),
    staleTime: 30000, // 30 seconds
    enabled: !!proposalId,
  });
}
