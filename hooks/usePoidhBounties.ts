import { useState, useEffect, useCallback } from 'react';
import type { PoidhBounty } from '@/types/poidh';

interface UsePoidhBountiesOptions {
  status?: 'open' | 'past' | 'progress';
  filterSkate?: boolean;
}

interface UsePoidhBountiesReturn {
  bounties: PoidhBounty[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePoidhBounties(options: UsePoidhBountiesOptions = {}): UsePoidhBountiesReturn {
  const { status = 'past', filterSkate = true } = options;
  
  const [bounties, setBounties] = useState<PoidhBounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const loadBounties = useCallback(
    async (currentOffset: number, append: boolean = false) => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          offset: currentOffset.toString(),
          limit: '20',
          status,
          filterSkate: filterSkate.toString()
        });

        const res = await fetch(`/api/poidh/bounties?${params}`);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setBounties((prev) => (append ? [...prev, ...data.bounties] : data.bounties));
        const nextOffset = currentOffset + data.bounties.length;
        setHasMore(nextOffset < data.total);
        setOffset(nextOffset);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load POIDH bounties';
        setError(message);
        console.error('usePoidhBounties error:', err);
      } finally {
        setLoading(false);
      }
    },
    [status, filterSkate]
  );

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) {
      await loadBounties(offset, true);
    }
  }, [loading, hasMore, offset, loadBounties]);

  const refresh = useCallback(async () => {
    setOffset(0);
    await loadBounties(0, false);
  }, [loadBounties]);

  // Initial load
  useEffect(() => {
    loadBounties(0);
  }, [loadBounties]);

  return {
    bounties,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  };
}
