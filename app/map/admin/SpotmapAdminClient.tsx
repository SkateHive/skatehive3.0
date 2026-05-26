"use client";

import React, { useEffect, useState } from "react";
import NextLink from "next/link";
import {
  Box,
  Button,
  Code,
  Container,
  Flex,
  Heading,
  HStack,
  Link,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";

interface AdminStatus {
  ok: boolean;
  hive_username?: string | null;
  totals?: { hive: number; google_my_maps: number; all: number };
  last_synced_at?: string | null;
  newest_hive_created?: string | null;
  error?: string;
}

// Trimmed-down shape of /api/admin/spotmap/sync's POST response.
interface SyncResponse {
  success: boolean;
  triggered_by?: string;
  started_at?: string;
  finished_at?: string;
  hive?: unknown;
  google_my_maps?: unknown;
  totals?: { hive: number; google_my_maps: number; all: number };
  error?: string;
}

export default function SpotmapAdminClient() {
  const toast = useToast();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResponse | null>(null);

  async function refreshStatus() {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/admin/spotmap/sync", { method: "GET" });
      const data = (await res.json()) as AdminStatus;
      if (!res.ok) {
        setStatus({ ok: false, error: data.error ?? `HTTP ${res.status}` });
      } else {
        setStatus(data);
      }
    } catch (err) {
      setStatus({
        ok: false,
        error: err instanceof Error ? err.message : "Network error",
      });
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  async function runSync(sources?: ("hive" | "google_my_maps")[]) {
    setSyncing(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/admin/spotmap/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sources ? { sources } : {}),
      });
      const data = (await res.json()) as SyncResponse;
      setLastResult(data);
      if (!res.ok || !data.success) {
        toast({
          title: "Sync finished with errors",
          description: data.error ?? "See result below",
          status: "warning",
          duration: 5000,
          isClosable: true,
        });
      } else {
        toast({
          title: "Sync complete",
          description: data.totals
            ? `Now ${data.totals.all} spots in the map`
            : undefined,
          status: "success",
          duration: 4000,
          isClosable: true,
        });
      }
      // Refresh the status counts after sync
      refreshStatus();
    } catch (err) {
      toast({
        title: "Sync request failed",
        description: err instanceof Error ? err.message : "Network error",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSyncing(false);
    }
  }

  // Auth gate display
  if (statusLoading) {
    return (
      <Container maxW="3xl" py={8}>
        <Flex justify="center" py={12}>
          <Spinner color="primary" />
        </Flex>
      </Container>
    );
  }

  if (!status?.ok) {
    return (
      <Container maxW="3xl" py={8}>
        <HStack mb={4} color="gray.400" fontSize="sm">
          <Link as={NextLink} href="/map" _hover={{ color: "primary" }}>
            <ArrowBackIcon /> Back to map
          </Link>
        </HStack>
        <Heading as="h1" size="lg" color="primary" mb={3}>
          Spot Map Admin
        </Heading>
        <Box
          p={4}
          bg="rgba(255, 80, 80, 0.08)"
          border="1px solid"
          borderColor="red.400"
          borderRadius="md"
        >
          <Text color="red.300" fontWeight="bold" mb={1}>
            Access denied
          </Text>
          <Text color="gray.300" fontSize="sm">
            {status?.error ?? "You do not have permission to use this page."}
          </Text>
          <Text color="gray.500" fontSize="xs" mt={2}>
            Admin access requires a logged-in account with a linked Hive identity
            listed in <Code fontSize="xs">ADMIN_USERS</Code>.
          </Text>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxW="3xl" py={8}>
      <HStack mb={4} color="gray.400" fontSize="sm">
        <Link as={NextLink} href="/map" _hover={{ color: "primary" }}>
          <ArrowBackIcon /> Back to map
        </Link>
      </HStack>

      <Heading as="h1" size="lg" color="primary" mb={1}>
        Spot Map Sync
      </Heading>
      <Text color="gray.400" fontSize="sm" mb={6}>
        Signed in as <Code fontSize="xs">@{status.hive_username}</Code>. Sync pulls new
        Hive skatespots since the last run, and re-pulls the Google My Maps KML feed.
      </Text>

      {/* Stats */}
      <HStack
        spacing={6}
        mb={6}
        p={4}
        bg="rgba(20,20,20,0.5)"
        border="1px solid"
        borderColor="whiteAlpha.100"
        borderRadius="md"
      >
        <Stat>
          <StatLabel color="gray.500">Hive spots</StatLabel>
          <StatNumber color="primary">{status.totals?.hive ?? 0}</StatNumber>
        </Stat>
        <Stat>
          <StatLabel color="gray.500">Google spots</StatLabel>
          <StatNumber color="primary">{status.totals?.google_my_maps ?? 0}</StatNumber>
        </Stat>
        <Stat>
          <StatLabel color="gray.500">Total</StatLabel>
          <StatNumber color="primary">{status.totals?.all ?? 0}</StatNumber>
        </Stat>
      </HStack>

      <Text fontSize="xs" color="gray.500" mb={4}>
        Last synced: {status.last_synced_at ? new Date(status.last_synced_at).toLocaleString() : "never"}
        {status.newest_hive_created && (
          <> · Newest Hive spot: {new Date(status.newest_hive_created).toLocaleDateString()}</>
        )}
      </Text>

      {/* Actions */}
      <VStack spacing={3} align="stretch" mb={6}>
        <Button
          bg="primary"
          color="background"
          _hover={{ bg: "accent", color: "text" }}
          onClick={() => runSync()}
          isLoading={syncing}
          loadingText="Syncing… (this can take a minute on the first run)"
          size="lg"
        >
          Sync now — Hive + Google
        </Button>
        <HStack>
          <Button
            flex={1}
            variant="outline"
            borderColor="primary"
            color="primary"
            _hover={{ bg: "primary", color: "background" }}
            onClick={() => runSync(["hive"])}
            isDisabled={syncing}
            size="sm"
          >
            Sync only Hive
          </Button>
          <Button
            flex={1}
            variant="outline"
            borderColor="primary"
            color="primary"
            _hover={{ bg: "primary", color: "background" }}
            onClick={() => runSync(["google_my_maps"])}
            isDisabled={syncing}
            size="sm"
          >
            Sync only Google
          </Button>
        </HStack>
      </VStack>

      {lastResult && (
        <Box
          p={4}
          bg="rgba(0,0,0,0.5)"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="md"
        >
          <Text fontSize="sm" fontWeight="bold" color="gray.300" mb={2}>
            Last sync result
          </Text>
          <Code
            display="block"
            whiteSpace="pre-wrap"
            wordBreak="break-word"
            fontSize="xs"
            color="gray.300"
            bg="transparent"
            p={0}
          >
            {JSON.stringify(lastResult, null, 2)}
          </Code>
        </Box>
      )}
    </Container>
  );
}
