'use client';

import { 
  Box, 
  Button, 
  SimpleGrid, 
  Spinner, 
  Text, 
  VStack, 
  Alert, 
  AlertIcon,
  HStack,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Badge
} from '@chakra-ui/react';
import { usePoidhBounties } from '@/hooks/usePoidhBounties';
import { PoidhBountyCard } from './PoidhBountyCard';

function BountyListContent({ status, embedded }: { status: 'open' | 'past'; embedded?: boolean }) {
  const { bounties, loading, error, hasMore, loadMore } = usePoidhBounties({
    status,
    filterSkate: true
  });

  if (loading && bounties.length === 0) {
    return (
      <VStack py={12} gap={4}>
        <Spinner size="xl" color="primary" thickness="4px" />
        <Text color="textSecondary" fontSize="lg">
          Loading skateboarding bounties from Base & Arbitrum...
        </Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="md" variant="left-accent">
        <AlertIcon />
        <VStack align="start" gap={1}>
          <Text fontWeight="bold">Failed to load bounties</Text>
          <Text fontSize="sm">{error}</Text>
        </VStack>
      </Alert>
    );
  }

  if (bounties.length === 0) {
    return (
      <Box textAlign="center" py={16} px={4}>
        <Text fontSize="3xl" mb={2}>
          🎯
        </Text>
        <Text fontSize="xl" fontWeight="bold" color="text" mb={2}>
          No skateboarding bounties found
        </Text>
        <Text fontSize="md" color="textSecondary">
          {status === 'open' 
            ? 'No active skateboarding bounties at the moment'
            : 'No past skateboarding bounties found'
          }
        </Text>
        <Button
          as="a"
          href="https://poidh.xyz"
          target="_blank"
          mt={6}
          colorScheme="brand"
          size="lg"
        >
          Create Bounty on POIDH
        </Button>
      </Box>
    );
  }

  return (
    <VStack gap={6} align="stretch">
      {/* Header */}
      {!embedded && (
        <HStack justify="space-between" align="center">
          <Text fontSize="md" color="textSecondary">
            Showing <Text as="span" fontWeight="bold" color="text">{bounties.length}</Text>{' '}
            {bounties.length === 1 ? 'bounty' : 'bounties'}
          </Text>
          <Button
            as="a"
            href="https://poidh.xyz"
            target="_blank"
            size="sm"
            variant="ghost"
            colorScheme="brand"
          >
            + Create Bounty
          </Button>
        </HStack>
      )}

      {/* Grid */}
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={6}>
        {bounties.map((bounty) => (
          <PoidhBountyCard key={bounty.id} bounty={bounty} />
        ))}
      </SimpleGrid>

      {/* Pagination */}
      {hasMore && (
        <HStack justify="center" pt={4}>
          <Button 
            onClick={loadMore} 
            isLoading={loading}
            loadingText="Loading more..."
            colorScheme="brand"
            size="lg"
            px={8}
          >
            Load More Bounties
          </Button>
        </HStack>
      )}

      {loading && bounties.length > 0 && (
        <HStack justify="center" py={4}>
          <Spinner size="md" color="primary" />
          <Text color="textSecondary">Loading more...</Text>
        </HStack>
      )}
    </VStack>
  );
}

export function PoidhBountyList({ embedded = false }: { embedded?: boolean }) {
  return (
    <Tabs variant="unstyled">
      <TabList
        bg="surface"
        borderWidth={1}
        borderColor="border"
        borderRadius="full"
        p={1}
        w="fit-content"
      >
        <Tab
          px={5}
          py={2}
          borderRadius="full"
          fontWeight="bold"
          color="textSecondary"
          _selected={{
            bg: 'primary',
            color: 'background',
            boxShadow: 'md'
          }}
          _hover={{ color: 'text' }}
        >
          Active Bounties
        </Tab>
        <Tab
          px={5}
          py={2}
          borderRadius="full"
          fontWeight="bold"
          color="textSecondary"
          _selected={{
            bg: 'primary',
            color: 'background',
            boxShadow: 'md'
          }}
          _hover={{ color: 'text' }}
        >
          Past Bounties
        </Tab>
      </TabList>

      <TabPanels>
        <TabPanel px={0} pt={6}>
          <BountyListContent status="open" embedded={embedded} />
        </TabPanel>
        <TabPanel px={0} pt={6}>
          <BountyListContent status="past" embedded={embedded} />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
