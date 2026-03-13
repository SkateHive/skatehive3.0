'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Box,
  SimpleGrid,
  Text,
  Spinner,
  Button,
  HStack,
  VStack,
} from '@chakra-ui/react';
import { useComments } from '@/hooks/useComments';
import { usePoidhBounties } from '@/hooks/usePoidhBounties';
import HiveClient from '@/lib/hive/hiveclient';
import { useMarketPrices } from '@/hooks/useMarketPrices';
import { normalizeHiveBounty, normalizePoidhBounty } from '@/lib/bounty-normalizers';
import { UnifiedBountyCard } from './UnifiedBountyCard';
import type { UnifiedBounty } from '@/types/unified-bounty';
import type { Discussion } from '@hiveio/dhive';

export type SourceFilter = 'all' | 'hive' | 'poidh';

interface UnifiedBountyListProps {
  newBounty?: Discussion | null;
  refreshTrigger?: number;
  sourceFilter?: SourceFilter;
  onBountiesLoaded?: (bounties: UnifiedBounty[]) => void;
}

export default function UnifiedBountyList({
  newBounty,
  refreshTrigger,
  sourceFilter = 'all',
  onBountiesLoaded,
}: UnifiedBountyListProps) {
  const [visibleCount, setVisibleCount] = useState(12);
  const { hivePrice, hbdPrice, ethPrice } = useMarketPrices();

  // Convert bounty reward to USD for sorting
  const toUsd = useCallback((b: UnifiedBounty): number => {
    switch (b.rewardCurrency) {
      case 'ETH': return b.rewardAmount * (ethPrice ?? 2500);
      case 'HBD': return b.rewardAmount * (hbdPrice ?? 1);
      case 'HIVE': return b.rewardAmount * (hivePrice ?? 0.21);
      default: return b.rewardAmount;
    }
  }, [hivePrice, hbdPrice, ethPrice]);

  // ── Hive data ─────────────────────────────────────────────
  const { comments, isLoading: hiveLoading, updateComments } = useComments(
    'skatehive',
    'skatehive-bounties',
    false
  );

  // Hive bounty metadata (submission counts + rewarded status + winners)
  const [hiveMeta, setHiveMeta] = useState<{
    submissionCounts: Record<string, number>;
    rewardedSet: Set<string>;
    winners: Record<string, string>;
  }>({ submissionCounts: {}, rewardedSet: new Set(), winners: {} });

  // Prepend newBounty if exists
  const hiveDiscussions = useMemo(() => {
    let bounties = [...comments];
    if (newBounty) {
      const exists = bounties.some((c) => c.permlink === newBounty.permlink);
      if (!exists) bounties = [newBounty, ...bounties];
    }
    return bounties;
  }, [comments, newBounty]);

  // Refresh on trigger
  useEffect(() => {
    if (refreshTrigger !== undefined) updateComments();
  }, [refreshTrigger, updateComments]);

  // Fetch submission counts + rewarded status for all Hive bounties
  useEffect(() => {
    let cancelled = false;
    async function fetchMeta() {
      const submissionCounts: Record<string, number> = {};
      const rewardedSet = new Set<string>();
      const winners: Record<string, string> = {};

      await Promise.all(
        hiveDiscussions.map(async (bounty) => {
          const key = `${bounty.author}-${bounty.permlink}`;
          try {
            const replies = await HiveClient.database.call(
              'get_content_replies',
              [bounty.author, bounty.permlink]
            );
            if (replies && Array.isArray(replies)) {
              const rewardReply = replies.find(
                (r: any) =>
                  r.author === bounty.author &&
                  r.body.includes('\u{1F3C6} Bounty Winners! \u{1F3C6}')
              );
              if (rewardReply) {
                rewardedSet.add(key);
                // Extract first winner: "🥇 @username - 5.000 HBD"
                const winnerMatch = (rewardReply as any).body.match(/@(\w[\w.-]*)/);
                if (winnerMatch) winners[key] = winnerMatch[1];
              }

              const deadlineMatch = bounty.body.match(/Deadline:\s*(\d{2}-\d{2}-\d{4})/);
              let deadline: Date | null = null;
              if (deadlineMatch) {
                const [mm, dd, yyyy] = deadlineMatch[1].split('-');
                deadline = new Date(`${yyyy}-${mm}-${dd}T23:59:59`);
              }
              let count = 0;
              replies.forEach((r: any) => {
                if (r.author && deadline && r.created) {
                  if (new Date(r.created) < deadline) count++;
                }
              });
              submissionCounts[key] = count;
            } else {
              submissionCounts[key] = 0;
            }
          } catch {
            submissionCounts[key] = 0;
          }
        })
      );
      if (!cancelled) {
        setHiveMeta({ submissionCounts, rewardedSet, winners });
      }
    }
    if (hiveDiscussions.length > 0) fetchMeta();
    return () => { cancelled = true; };
  }, [hiveDiscussions]);

  // Normalize Hive bounties (filter out 0-reward entries)
  const hiveBounties: UnifiedBounty[] = useMemo(() => {
    return hiveDiscussions
      .map((d) => {
        const key = `${d.author}-${d.permlink}`;
        return normalizeHiveBounty(
          d,
          hiveMeta.submissionCounts[key] ?? 0,
          hiveMeta.rewardedSet.has(key),
          hiveMeta.winners[key] ?? null
        );
      })
      .filter((b) => b.rewardAmount >= 1);
  }, [hiveDiscussions, hiveMeta]);

  // ── POIDH data ────────────────────────────────────────────
  const {
    bounties: poidhOpenRaw,
    loading: poidhOpenLoading,
    hasMore: poidhOpenHasMore,
    loadMore: poidhOpenLoadMore,
  } = usePoidhBounties({ status: 'open', filterSkate: true });

  const {
    bounties: poidhPastRaw,
    loading: poidhPastLoading,
    hasMore: poidhPastHasMore,
    loadMore: poidhPastLoadMore,
  } = usePoidhBounties({ status: 'past', filterSkate: true });

  const poidhBounties: UnifiedBounty[] = useMemo(() => {
    const all = [...poidhOpenRaw, ...poidhPastRaw];
    const seen = new Set<string>();
    return all
      .filter((b) => {
        const key = `${b.chainId}-${b.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(normalizePoidhBounty);
  }, [poidhOpenRaw, poidhPastRaw]);

  // ── Merge + filter ────────────────────────────────────────
  const allBounties = useMemo(() => {
    return [...hiveBounties, ...poidhBounties];
  }, [hiveBounties, poidhBounties]);

  // Notify parent of loaded bounties
  useEffect(() => {
    if (onBountiesLoaded && allBounties.length > 0) {
      onBountiesLoaded(allBounties);
    }
  }, [allBounties, onBountiesLoaded]);

  const filteredBounties = useMemo(() => {
    if (sourceFilter === 'all') return allBounties;
    return allBounties.filter((b) => b.source === sourceFilter);
  }, [allBounties, sourceFilter]);

  // Split into open and closed, sorted by date
  const openBounties = useMemo(() => {
    return filteredBounties
      .filter((b) => b.isActive)
      .sort((a, b) => toUsd(b) - toUsd(a));
  }, [filteredBounties, toUsd]);

  const closedBounties = useMemo(() => {
    return filteredBounties
      .filter((b) => !b.isActive)
      .sort((a, b) => toUsd(b) - toUsd(a));
  }, [filteredBounties, toUsd]);

  const visibleClosed = closedBounties.slice(0, visibleCount);
  const hasMore = visibleCount < closedBounties.length || poidhOpenHasMore || poidhPastHasMore;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + 12);
    if (poidhOpenHasMore) poidhOpenLoadMore();
    if (poidhPastHasMore) poidhPastLoadMore();
  }, [poidhOpenHasMore, poidhOpenLoadMore, poidhPastHasMore, poidhPastLoadMore]);

  const isLoading = hiveLoading || poidhOpenLoading || poidhPastLoading;

  // Reset visible count on filter change
  useEffect(() => {
    setVisibleCount(12);
  }, [sourceFilter]);

  return (
    <VStack align="stretch" spacing={6}>
      {/* Loading state */}
      {isLoading && allBounties.length === 0 && (
        <VStack py={12} gap={3}>
          <Spinner size="lg" color="primary" thickness="3px" />
          <Text color="dim" fontSize="sm" fontFamily="mono">
            loading bounties...
          </Text>
        </VStack>
      )}

      {/* Empty state */}
      {!isLoading && filteredBounties.length === 0 && (
        <Box
          textAlign="center"
          py={12}
          px={4}
          borderRadius="none"
          border="1px solid"
          borderColor="border"
          bg="muted"
        >
          <Text fontSize="sm" fontWeight="bold" color="text" mb={2} fontFamily="mono">
            {sourceFilter === 'hive'
              ? 'No Hive bounties found'
              : sourceFilter === 'poidh'
                ? 'No POIDH bounties found'
                : 'No bounties found'}
          </Text>
          <Text fontSize="xs" color="dim" fontFamily="mono">
            Create a bounty on Hive or POIDH to get started
          </Text>
        </Box>
      )}

      {/* ── Open bounties: horizontal slider ──── */}
      {openBounties.length > 0 && (
        <Box>
          <Text
            fontSize="xs"
            fontWeight="bold"
            fontFamily="mono"
            color="success"
            textTransform="uppercase"
            letterSpacing="wider"
            mb={3}
          >
            OPEN BOUNTIES ({openBounties.length})
          </Text>
          <Box
            overflowX="auto"
            mx={-1}
            px={1}
            pb={2}
            css={{
              '&::-webkit-scrollbar': { height: '4px' },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': { background: 'var(--chakra-colors-primary)', borderRadius: '0' },
            }}
          >
            <HStack spacing={{ base: 3, md: 4 }} align="stretch" minW="min-content">
              {openBounties.map((bounty) => (
                <Box
                  key={bounty.id}
                  w={{ base: '240px', sm: '280px', md: '320px' }}
                  flexShrink={0}
                >
                  <UnifiedBountyCard bounty={bounty} hivePrice={hivePrice} hbdPrice={hbdPrice} ethPrice={ethPrice} />
                </Box>
              ))}
            </HStack>
          </Box>
        </Box>
      )}

      {/* ── Closed bounties: grid ─────────────── */}
      {visibleClosed.length > 0 && (
        <Box>
          <Text
            fontSize="xs"
            fontWeight="bold"
            fontFamily="mono"
            color="dim"
            textTransform="uppercase"
            letterSpacing="wider"
            mb={3}
          >
            CLOSED BOUNTIES ({closedBounties.length})
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={4}>
            {visibleClosed.map((bounty) => (
              <UnifiedBountyCard key={bounty.id} bounty={bounty} hivePrice={hivePrice} hbdPrice={hbdPrice} ethPrice={ethPrice} />
            ))}
          </SimpleGrid>
        </Box>
      )}

      {/* Load more */}
      {hasMore && visibleClosed.length > 0 && (
        <Box
          textAlign="center"
          py={3}
          borderTop="1px solid"
          borderBottom="1px solid"
          borderColor="border"
        >
          <Button
            onClick={handleLoadMore}
            isLoading={isLoading && allBounties.length > 0}
            loadingText="LOADING..."
            size="sm"
            variant="unstyled"
            color="text"
            fontWeight="bold"
            fontFamily="mono"
            textTransform="uppercase"
            letterSpacing="wider"
            fontSize="xs"
            _hover={{ color: 'primary' }}
          >
            + LOAD MORE BOUNTIES
          </Button>
        </Box>
      )}

      {/* Inline loading indicator */}
      {isLoading && allBounties.length > 0 && (
        <HStack justify="center" py={2} gap={2}>
          <Spinner size="sm" color="primary" />
          <Text fontSize="sm" color="dim" fontFamily="mono">loading...</Text>
        </HStack>
      )}
    </VStack>
  );
}
