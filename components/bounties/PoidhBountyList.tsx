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
  Link,
} from '@chakra-ui/react';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { usePoidhBounties } from '@/hooks/usePoidhBounties';
import { PoidhBountyCard } from './PoidhBountyCard';

interface BountyListContentProps {
  status: 'open' | 'past';
  embedded?: boolean;
}

function BountyListContent({ status, embedded }: BountyListContentProps) {
  const { bounties, loading, error, hasMore, loadMore } = usePoidhBounties({
    status,
    filterSkate: true,
  });

  if (loading && bounties.length === 0) {
    return (
      <VStack py={12} gap={3}>
        <Spinner size="lg" color="primary" thickness="3px" />
        <Text color="dim" fontSize="sm">
          Searching for skate bounties on Base &amp; Arbitrum...
        </Text>
      </VStack>
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="lg" variant="left-accent">
        <AlertIcon />
        <VStack align="start" gap={0}>
          <Text fontWeight="bold" fontSize="sm">Failed to load bounties</Text>
          <Text fontSize="xs" color="textSecondary">{error}</Text>
        </VStack>
      </Alert>
    );
  }

  if (bounties.length === 0) {
    return (
      <Box
        textAlign="center"
        py={16}
        px={4}
        borderRadius="2xl"
        border="2px dashed"
        borderColor="border"
      >
        <Text fontSize="3xl" mb={3}>🛹</Text>
        <Text fontSize="lg" fontWeight="bold" color="text" mb={1}>
          No skate bounties found
        </Text>
        <Text fontSize="sm" color="dim" mb={6}>
          {status === 'open'
            ? 'No active skateboarding bounties at the moment — be the first!'
            : 'No past skateboarding bounties matched our filter.'}
        </Text>
        <HStack justify="center" gap={3} flexWrap="wrap">
          <Button
            as={Link}
            href="https://poidh.xyz"
            isExternal
            size="sm"
            bg="primary"
            color="background"
            _hover={{ bg: 'accent', textDecor: 'none' }}
            rightIcon={<ExternalLinkIcon />}
          >
            Create on POIDH
          </Button>
          <Button
            as={Link}
            href={`https://poidh.xyz/explore?tab=bounties`}
            isExternal
            size="sm"
            variant="ghost"
            color="textSecondary"
            _hover={{ color: 'text', textDecor: 'none' }}
            rightIcon={<ExternalLinkIcon />}
          >
            Browse all on POIDH
          </Button>
        </HStack>
      </Box>
    );
  }

  return (
    <VStack gap={6} align="stretch">
      {/* Header — only when not embedded in the hub */}
      {!embedded && (
        <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
          <Text fontSize="sm" color="dim">
            <Text as="span" fontWeight="bold" color="text">{bounties.length}</Text>
            {' skate '}
            {bounties.length === 1 ? 'bounty' : 'bounties'}
          </Text>
          <Link
            href={`https://poidh.xyz/explore?tab=bounties`}
            isExternal
            fontSize="xs"
            color="dim"
            _hover={{ color: 'primary' }}
          >
            Show all on POIDH <ExternalLinkIcon mx="1px" />
          </Link>
        </HStack>
      )}

      {/* Grid */}
      <SimpleGrid columns={{ base: 1, sm: 2, md: 3, xl: 4 }} gap={5}>
        {bounties.map((bounty) => (
          <PoidhBountyCard key={bounty.id} bounty={bounty} />
        ))}
      </SimpleGrid>

      {/* Load more */}
      {hasMore && (
        <HStack justify="center" pt={2}>
          <Button
            onClick={loadMore}
            isLoading={loading}
            loadingText="Loading..."
            size="md"
            variant="outline"
            borderColor="border"
            color="text"
            _hover={{ borderColor: 'primary', color: 'primary' }}
            px={8}
          >
            Load more
          </Button>
        </HStack>
      )}

      {loading && bounties.length > 0 && (
        <HStack justify="center" py={2} gap={2}>
          <Spinner size="sm" color="primary" />
          <Text fontSize="sm" color="dim">Loading more...</Text>
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
        mb={6}
      >
        {(['Active', 'Past'] as const).map((label) => (
          <Tab
            key={label}
            px={5}
            py={2}
            borderRadius="full"
            fontWeight="bold"
            fontSize="sm"
            color="textSecondary"
            _selected={{ bg: 'primary', color: 'background', boxShadow: 'md' }}
            _hover={{ color: 'text' }}
          >
            {label}
          </Tab>
        ))}
      </TabList>

      <TabPanels>
        <TabPanel px={0} pt={0}>
          <BountyListContent status="open" embedded={embedded} />
        </TabPanel>
        <TabPanel px={0} pt={0}>
          <BountyListContent status="past" embedded={embedded} />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
}
