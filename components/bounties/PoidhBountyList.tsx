"use client";

import { useState } from "react";
import {
  Box,
  SimpleGrid,
  Text,
  Spinner,
  Center,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Select,
  HStack,
  Badge,
} from "@chakra-ui/react";
import { usePoidhBounties } from "@/hooks/usePoidhBounties";
import PoidhBountyCard from "./PoidhBountyCard";
import type { BountyStatus } from "@/types/poidh";

interface PoidhBountyListProps {
  initialFilter?: BountyStatus[];
}

export default function PoidhBountyList({
  initialFilter,
}: PoidhBountyListProps) {
  const [statusFilter, setStatusFilter] = useState<BountyStatus[]>(
    initialFilter || ["active"]
  );
  const [chainFilter, setChainFilter] = useState<number[]>([
    42161, 8453, 666666666,
  ]); // All chains

  const { bounties, isLoading, error } = usePoidhBounties({
    status: statusFilter,
    chains: chainFilter,
  });

  if (isLoading) {
    return (
      <Center py={10}>
        <Spinner size="xl" color="primary" />
        <Text ml={4} color="text">
          Loading POIDH bounties...
        </Text>
      </Center>
    );
  }

  if (error) {
    return (
      <Alert status="error" borderRadius="md">
        <AlertIcon />
        <Box>
          <AlertTitle>Failed to load POIDH bounties</AlertTitle>
          <AlertDescription fontSize="sm">
            {error.message || "Please try again later"}
          </AlertDescription>
        </Box>
      </Alert>
    );
  }

  return (
    <Box>
      {/* Filters */}
      <HStack mb={6} spacing={4} wrap="wrap">
        {/* Status Filter */}
        <Box>
          <Text fontSize="sm" color="muted" mb={2}>
            Status
          </Text>
          <Select
            value={statusFilter[0] || "active"}
            onChange={(e) =>
              setStatusFilter([e.target.value as BountyStatus])
            }
            size="sm"
            w="150px"
          >
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Box>

        {/* Chain Filter */}
        <Box>
          <Text fontSize="sm" color="muted" mb={2}>
            Chain
          </Text>
          <Select
            value={chainFilter.length === 3 ? "all" : chainFilter[0]}
            onChange={(e) => {
              const value = e.target.value;
              if (value === "all") {
                setChainFilter([42161, 8453, 666666666]);
              } else {
                setChainFilter([parseInt(value)]);
              }
            }}
            size="sm"
            w="150px"
          >
            <option value="all">All Chains</option>
            <option value="42161">Arbitrum</option>
            <option value="8453">Base</option>
            <option value="666666666">Degen</option>
          </Select>
        </Box>

        {/* Results Count */}
        <Box flex={1} textAlign="right">
          <Badge colorScheme="purple" fontSize="sm" px={3} py={1}>
            {bounties.length} skate bounties found
          </Badge>
        </Box>
      </HStack>

      {/* Empty State */}
      {bounties.length === 0 && (
        <Center py={10}>
          <Box textAlign="center">
            <Text fontSize="lg" color="muted" mb={2}>
              No skate bounties found
            </Text>
            <Text fontSize="sm" color="text">
              Try adjusting your filters or check back later
            </Text>
          </Box>
        </Center>
      )}

      {/* Bounty Grid */}
      {bounties.length > 0 && (
        <SimpleGrid
          columns={{ base: 1, md: 2, lg: 3 }}
          spacing={6}
          w="full"
        >
          {bounties.map((bounty) => (
            <PoidhBountyCard key={`${bounty.chainId}-${bounty.id}`} bounty={bounty} />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}
