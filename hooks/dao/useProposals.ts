/**
 * Proposals Hook
 * Fetch proposals from DAO subgraph
 */

import { useQuery } from '@tanstack/react-query';
import { fetchProposals } from '@/lib/dao/governance';

/**
 * Hook to fetch proposals for a DAO
 * @param daoAddress - DAO token contract address
 * @param limit - Maximum number of proposals (default: 50)
 * @returns Query result with proposals
 */
export function useProposals(daoAddress: string, limit: number = 50) {
  return useQuery({
    queryKey: ['proposals', daoAddress, limit],
    queryFn: () => fetchProposals(daoAddress, limit),
    staleTime: 30000, // 30 seconds
    enabled: !!daoAddress,
  });
}
