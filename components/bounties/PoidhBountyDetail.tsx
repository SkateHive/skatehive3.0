'use client';

import {
  Box,
  Container,
  VStack,
  HStack,
  Heading,
  Text,
  Badge,
  Button,
  Divider,
  SimpleGrid,
  Spinner,
  Alert,
  AlertIcon,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  GridItem,
  ScaleFade,
  Tooltip,
  Link,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import Image from 'next/image';
import { ChevronLeftIcon, ExternalLinkIcon } from '@chakra-ui/icons';
import { formatEther } from 'viem';
import { useEffect, useState } from 'react';
import type { PoidhBounty } from '@/types/poidh';

interface PoidhBountyDetailProps {
  chainId: string;
  id: string;
}

const CHAIN_LABEL: Record<number, string> = {
  8453: 'Base',
  42161: 'Arbitrum',
};

const CHAIN_PATH: Record<number, string> = {
  8453: 'base',
  42161: 'arbitrum',
};

function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function safeFormatEther(amount: string): string {
  try {
    return formatEther(BigInt(amount));
  } catch {
    return '0';
  }
}

export function PoidhBountyDetail({ chainId, id }: PoidhBountyDetailProps) {
  const [bounty, setBounty] = useState<PoidhBounty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchBounty() {
      try {
        setLoading(true);
        const res = await fetch(`/api/poidh/bounties/${chainId}/${id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Error ${res.status}`);
        }
        const data = await res.json();
        setBounty(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bounty');
      } finally {
        setLoading(false);
      }
    }
    fetchBounty();
  }, [chainId, id]);

  if (loading) {
    return (
      <Box minH="60vh" display="flex" alignItems="center" justifyContent="center">
        <VStack gap={3}>
          <Spinner size="lg" color="primary" thickness="3px" />
          <Text color="dim" fontSize="sm">Loading bounty...</Text>
        </VStack>
      </Box>
    );
  }

  if (error || !bounty) {
    return (
      <Container maxW="container.md" py={20}>
        <Alert status="error" variant="left-accent" borderRadius="xl">
          <AlertIcon />
          <VStack align="start" gap={0}>
            <Text fontWeight="bold" fontSize="sm">Could not load bounty</Text>
            <Text fontSize="xs">{error || 'Bounty not found'}</Text>
          </VStack>
        </Alert>
        <Button
          as={NextLink}
          href="/bounties"
          mt={6}
          leftIcon={<ChevronLeftIcon />}
          variant="ghost"
          size="sm"
        >
          Back to Bounties
        </Button>
      </Container>
    );
  }

  const amountInEth = safeFormatEther(bounty.amount);
  // Use the isActive field from the API (based on claimer presence)
  const isActive = bounty.isActive ?? !bounty.claimer;
  const createdDate = new Date(bounty.createdAt * 1000).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const numericChainId = parseInt(chainId, 10);
  const poidhUrl = `https://poidh.xyz/${CHAIN_PATH[numericChainId]}/bounty/${bounty.id}`;

  return (
    <Box bg="background" minH="100vh">
      <Container maxW="container.lg" py={8}>
        <ScaleFade initialScale={0.95} in={true}>
          {/* Breadcrumb */}
          <Breadcrumb mb={6} color="dim" fontSize="sm" separator="/">
            <BreadcrumbItem>
              <BreadcrumbLink as={NextLink} href="/bounties" _hover={{ color: 'primary' }}>
                Bounties
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>
              <BreadcrumbLink color="text" noOfLines={1} maxW="300px">
                {bounty.name}
              </BreadcrumbLink>
            </BreadcrumbItem>
          </Breadcrumb>

          <VStack align="stretch" gap={8}>
            {/* Header */}
            <Box>
              <HStack gap={2} mb={3} flexWrap="wrap">
                <Badge
                  bg={isActive ? 'green.400' : 'gray.600'}
                  color={isActive ? 'black' : 'white'}
                  px={3}
                  py={0.5}
                  borderRadius="full"
                  fontSize="2xs"
                  fontWeight="black"
                  letterSpacing="wider"
                >
                  {isActive ? '● OPEN' : '✓ CLOSED'}
                </Badge>
                <Badge
                  colorScheme={numericChainId === 8453 ? 'blue' : 'purple'}
                  fontSize="2xs"
                  px={3}
                  py={0.5}
                  borderRadius="full"
                >
                  {CHAIN_LABEL[numericChainId] ?? 'Unknown Chain'}
                </Badge>
                <Text color="dim" fontSize="xs">{createdDate}</Text>
              </HStack>

              <Heading size="xl" color="text" lineHeight="shorter" mb={2}>
                {bounty.name}
              </Heading>
            </Box>

            <SimpleGrid columns={{ base: 1, md: 3 }} gap={8}>
              {/* ── Main Content ─────────────────── */}
              <GridItem colSpan={{ base: 1, md: 2 }}>
                <VStack align="stretch" gap={6}>

                  {/* Thumbnail */}
                  {bounty.imageUrl && (
                    <Box
                      borderRadius="xl"
                      overflow="hidden"
                      borderWidth="1px"
                      borderColor="border"
                      h="240px"
                      position="relative"
                    >
                      <Image
                        src={bounty.imageUrl}
                        alt={bounty.name}
                        fill
                        style={{ objectFit: 'cover' }}
                        unoptimized
                      />
                    </Box>
                  )}

                  {/* Description */}
                  <Box bg="panel" p={6} borderRadius="xl" borderWidth="1px" borderColor="border">
                    <Text
                      fontSize="xs"
                      fontWeight="bold"
                      color="dim"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      mb={3}
                    >
                      Description
                    </Text>
                    <Text whiteSpace="pre-wrap" color="text" fontSize="sm" lineHeight="tall">
                      {bounty.description}
                    </Text>
                  </Box>

                  {/* Claims / Proofs */}
                  <Box>
                    <HStack justify="space-between" align="center" mb={4}>
                      <HStack gap={2}>
                        <Text fontWeight="bold" fontSize="md" color="text">Proofs</Text>
                        <Badge colorScheme="blue" borderRadius="full" fontSize="2xs">
                          {bounty.claims?.length ?? 0}
                        </Badge>
                      </HStack>
                      <Link
                        href={poidhUrl}
                        isExternal
                        fontSize="xs"
                        color="dim"
                        _hover={{ color: 'primary' }}
                      >
                        View on POIDH <ExternalLinkIcon mx="1px" />
                      </Link>
                    </HStack>

                    {bounty.claims && bounty.claims.length > 0 ? (
                      <VStack align="stretch" gap={3}>
                        {bounty.claims.map((claim) => (
                          <Box
                            key={claim.id}
                            p={4}
                            borderRadius="xl"
                            bg="panel"
                            borderWidth="1px"
                            borderColor={claim.accepted ? 'green.500' : 'border'}
                            _hover={{ borderColor: 'primary' }}
                            transition="border-color 0.15s"
                          >
                            <HStack justify="space-between" mb={2}>
                              <Tooltip label={claim.issuer} placement="top">
                                <Text
                                  fontWeight="bold"
                                  fontSize="sm"
                                  color="primary"
                                  fontFamily="mono"
                                  cursor="default"
                                >
                                  {shortenAddress(claim.issuer)}
                                </Text>
                              </Tooltip>
                              {claim.accepted && (
                                <Badge colorScheme="green" variant="solid" fontSize="2xs" px={2} borderRadius="md">
                                  ACCEPTED
                                </Badge>
                              )}
                            </HStack>
                            {claim.description && (
                              <Text fontSize="xs" color="textSecondary" mb={2} noOfLines={3}>
                                {claim.description}
                              </Text>
                            )}
                            <Text fontSize="2xs" color="dim">
                              {new Date(claim.createdAt * 1000).toLocaleString()}
                            </Text>
                          </Box>
                        ))}
                      </VStack>
                    ) : (
                      <Box
                        p={10}
                        textAlign="center"
                        borderRadius="xl"
                        border="2px dashed"
                        borderColor="border"
                      >
                        <Text color="dim" fontSize="sm">No proofs submitted yet.</Text>
                        {isActive && (
                          <Button
                            as="a"
                            href={poidhUrl}
                            target="_blank"
                            mt={4}
                            size="sm"
                            bg="primary"
                            color="background"
                            _hover={{ bg: 'accent', textDecor: 'none' }}
                            rightIcon={<ExternalLinkIcon />}
                          >
                            Be the first — submit on POIDH
                          </Button>
                        )}
                      </Box>
                    )}
                  </Box>
                </VStack>
              </GridItem>

              {/* ── Sidebar ──────────────────────── */}
              <GridItem>
                <VStack align="stretch" gap={5} position="sticky" top="80px">
                  {/* Reward card */}
                  <Box
                    bgGradient="linear(to-br, primary, accent)"
                    p={6}
                    borderRadius="2xl"
                    boxShadow="xl"
                    position="relative"
                    overflow="hidden"
                  >
                    <Box
                      position="absolute"
                      top="-8%"
                      right="-8%"
                      opacity={0.1}
                      fontSize="7xl"
                      fontWeight="black"
                      color="background"
                      userSelect="none"
                      transform="rotate(15deg)"
                    >
                      ETH
                    </Box>
                    <VStack align="start" gap={0} position="relative">
                      <Text fontSize="2xs" fontWeight="bold" color="background" opacity={0.85} letterSpacing="widest" mb={1}>
                        REWARD
                      </Text>
                      <HStack align="baseline" gap={1}>
                        <Text fontSize="4xl" fontWeight="900" color="background" letterSpacing="tighter">
                          {parseFloat(amountInEth).toFixed(4)}
                        </Text>
                        <Text fontSize="lg" fontWeight="bold" color="background" opacity={0.85}>ETH</Text>
                      </HStack>
                      <Divider my={4} borderColor="rgba(0,0,0,0.2)" />
                      <Button
                        as="a"
                        href={poidhUrl}
                        target="_blank"
                        w="100%"
                        size="md"
                        bg="background"
                        color="primary"
                        fontWeight="bold"
                        _hover={{ bg: 'white', transform: 'scale(1.02)', textDecor: 'none' }}
                        _active={{ transform: 'scale(0.98)' }}
                        rightIcon={<ExternalLinkIcon />}
                      >
                        {isActive ? 'Submit Proof' : 'View on POIDH'}
                      </Button>
                    </VStack>
                  </Box>

                  {/* Meta card */}
                  <Box bg="panel" p={5} borderRadius="xl" borderWidth="1px" borderColor="border">
                    <VStack align="stretch" gap={4}>
                      <Box>
                        <Text fontSize="2xs" fontWeight="bold" color="dim" textTransform="uppercase" letterSpacing="wider" mb={1}>
                          Issuer
                        </Text>
                        <Tooltip label={bounty.issuer} placement="top">
                          <Text
                            fontSize="xs"
                            color="text"
                            fontFamily="mono"
                            bg="surface"
                            p={2}
                            borderRadius="md"
                            wordBreak="break-all"
                            cursor="default"
                          >
                            {shortenAddress(bounty.issuer)}
                          </Text>
                        </Tooltip>
                      </Box>

                      <Box>
                        <Text fontSize="2xs" fontWeight="bold" color="dim" textTransform="uppercase" letterSpacing="wider" mb={1}>
                          Chain
                        </Text>
                        <Text fontSize="xs" color="text">{CHAIN_LABEL[numericChainId]}</Text>
                      </Box>

                      <Box>
                        <Text fontSize="2xs" fontWeight="bold" color="dim" textTransform="uppercase" letterSpacing="wider" mb={1}>
                          Bounty ID
                        </Text>
                        <Text fontSize="xs" color="text" fontFamily="mono">#{bounty.id}</Text>
                      </Box>

                      <Divider borderColor="border" />

                      <Button
                        as={NextLink}
                        href="/bounties"
                        variant="ghost"
                        size="sm"
                        leftIcon={<ChevronLeftIcon />}
                        _hover={{ bg: 'surface' }}
                        justifyContent="flex-start"
                      >
                        Back to Hub
                      </Button>
                    </VStack>
                  </Box>
                </VStack>
              </GridItem>
            </SimpleGrid>
          </VStack>
        </ScaleFade>
      </Container>
    </Box>
  );
}
