'use client';

import { Box, Button, SimpleGrid, Spinner, Text, VStack, Alert, AlertIcon } from '@chakra-ui/react';
import { usePoidhBounties } from '@/hooks/usePoidhBounties';
import { PoidhBountyCard } from './PoidhBountyCard';

export function PoidhBountyList() {
  const { bounties, loading, error, hasMore, loadMore } = usePoidhBounties();

  if (loading && bounties.length === 0) {
    return (
      <VStack py={12}>
        <Spinner size="xl" color="primary" />
        <Text color="textSecondary">Loading POIDH bounties from Base...</Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        {error}
      </Alert>
    );
  }

  if (bounties.length === 0) {
    return (
      <Box textAlign="center" py={12}>
        <Text fontSize="lg" color="textSecondary">
          No skate-related bounties found on POIDH (Base) yet.
        </Text>
        <Text fontSize="sm" color="textSecondary" mt={2}>
          Check back soon or create your own bounty!
        </Text>
      </Box>
    );
  }

  return (
    <VStack gap={6} align="stretch">
      <Text fontSize="sm" color="textSecondary">
        Showing {bounties.length} skate-related {bounties.length === 1 ? 'bounty' : 'bounties'} from POIDH on Base
      </Text>

      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={4}>
        {bounties.map((bounty) => (
          <PoidhBountyCard key={bounty.id} bounty={bounty} />
        ))}
      </SimpleGrid>

      {hasMore && (
        <Button onClick={loadMore} isLoading={loading} variant="outline" size="lg">
          Load More Bounties
        </Button>
      )}
    </VStack>
  );
}
