/**
 * Auction Hooks
 * React Query hooks for fetching auction data
 */

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { readContract } from 'wagmi/actions';
import { getConfig } from '@/lib/utils/wagmi';
import { fetchAuctions } from '@/lib/dao/auction';
import { DAO_ADDRESSES } from '@/lib/utils/constants';
import AUCTION_ABI from '@/lib/utils/abis/auction';
import type { Auction } from '@/lib/dao/types';

/**
 * Hook to fetch the last auction for a DAO
 * @param tokenAddress - DAO token contract address
 * @param initialData - Optional initial auction data
 * @returns Query result with the most recent auction
 */
export function useLastAuction(tokenAddress: string, initialData?: Auction) {
  return useQuery({
    queryKey: ['auction', tokenAddress],
    queryFn: () => fetchAuctions(tokenAddress),
    refetchOnMount: true,
    staleTime: 0,
    initialData: initialData ? [initialData] : undefined,
    select: (data) => data?.[0],
  });
}

/**
 * Hook to fetch current auction from contract
 * Reads directly from the auction contract
 * @returns Current auction data from contract
 */
export function useAuction() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const contractData = await readContract(getConfig(), {
          address: DAO_ADDRESSES.auction,
          abi: AUCTION_ABI,
          functionName: 'auction',
        });
        setData(contractData);
      } catch (error: any) {
        setError(error.message);
      }
    };

    fetchData();
  }, []);

  return { data, error };
}
