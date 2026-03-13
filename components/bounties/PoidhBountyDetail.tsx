'use client';

import {
  Box,
  Container,
  VStack,
  HStack,
  Text,
  Button,
  SimpleGrid,
  GridItem,
  Spinner,
  Tooltip,
  Link,
  Icon,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import Image from 'next/image';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { FaEthereum, FaCalendar, FaArrowLeft, FaBolt, FaFolder } from 'react-icons/fa';
import { formatEther } from 'viem';
import { useEffect, useState } from 'react';
import type { PoidhBounty } from '@/types/poidh';
import { CHAIN_LABEL, CHAIN_PATH } from '@/lib/poidh-constants';

interface PoidhBountyDetailProps {
  chainId: string;
  id: string;
}

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
          <Text color="dim" fontSize="sm" fontFamily="mono">loading bounty...</Text>
        </VStack>
      </Box>
    );
  }

  if (error || !bounty) {
    return (
      <Container maxW="container.md" py={20}>
        <Box border="1px solid" borderColor="error" borderRadius="none" bg="muted" p={6}>
          <Text fontWeight="bold" fontSize="sm" color="error" fontFamily="mono">
            ERROR: Could not load bounty
          </Text>
          <Text fontSize="xs" color="dim" mt={1} fontFamily="mono">{error || 'Bounty not found'}</Text>
        </Box>
        <Button
          as={NextLink}
          href="/bounties"
          mt={6}
          leftIcon={<FaArrowLeft />}
          variant="ghost"
          size="sm"
          borderRadius="none"
          fontFamily="mono"
        >
          Back to Bounties
        </Button>
      </Container>
    );
  }

  const amountInEth = safeFormatEther(bounty.amount);
  const amountFloat = parseFloat(amountInEth);
  const isActive = bounty.isActive ?? !bounty.claimer;
  const createdDate = bounty.createdAt > 0
    ? new Date(bounty.createdAt * 1000).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      }).toUpperCase()
    : null;
  const numericChainId = parseInt(chainId, 10);
  const poidhUrl = `https://poidh.xyz/${CHAIN_PATH[numericChainId]}/bounty/${bounty.id}`;
  const chainLabel = CHAIN_LABEL[numericChainId] ?? 'Unknown';
  const statusColor = isActive ? 'success' : 'error';
  const statusLabel = isActive ? 'OPEN' : 'CLOSED';

  return (
    <Box bg="background" minH="100vh">
      <Container maxW="container.lg" py={{ base: 4, md: 6 }}>
        {/* ── Header bar ──────────────────────── */}
        <Box
          border="1px solid"
          borderColor="primary"
          bg="muted"
          px={{ base: 4, md: 6 }}
          py={3}
          mb={6}
        >
          <HStack justify="space-between" align="center">
            <HStack spacing={2} align="center">
              <Link
                as={NextLink}
                href="/bounties"
                color="dim"
                _hover={{ color: 'primary' }}
                fontFamily="mono"
                fontSize="xs"
                fontWeight="bold"
                textTransform="uppercase"
              >
                BOUNTIES
              </Link>
              <Text color="dim" fontFamily="mono" fontSize="xs">/</Text>
              <Text
                color="primary"
                fontFamily="mono"
                fontSize="xs"
                fontWeight="bold"
                noOfLines={1}
                maxW={{ base: '200px', md: '400px' }}
              >
                {bounty.name.toUpperCase()}
              </Text>
            </HStack>
            <HStack spacing={2}>
              <Icon as={FaEthereum} boxSize="14px" color="#627EEA" />
              <Text fontSize="xs" fontFamily="mono" color="dim" fontWeight="bold">
                {chainLabel.toUpperCase()}
              </Text>
            </HStack>
          </HStack>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={6}>
          {/* ── Main content ──────────────────── */}
          <GridItem colSpan={{ base: 1, md: 2 }}>
            <VStack align="stretch" spacing={5}>
              {/* Status + meta */}
              <HStack spacing={3} flexWrap="wrap">
                <Box border="1px solid" borderColor={statusColor} px={2.5} py={0.5}>
                  <Text
                    fontSize="2xs"
                    fontWeight="bold"
                    fontFamily="mono"
                    color={statusColor}
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    {statusLabel}
                  </Text>
                </Box>
                <Box border="1px solid" borderColor="border" px={2.5} py={0.5}>
                  <Text fontSize="2xs" fontWeight="bold" fontFamily="mono" color="dim">
                    POIDH #{bounty.id}
                  </Text>
                </Box>
                {createdDate && (
                  <HStack spacing={1}>
                    <Icon as={FaCalendar} boxSize="10px" color="dim" />
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">
                      {createdDate}
                    </Text>
                  </HStack>
                )}
              </HStack>

              {/* Title */}
              <Text
                fontWeight="900"
                fontSize={{ base: 'xl', md: '2xl' }}
                color="text"
                lineHeight="shorter"
                textTransform="uppercase"
                fontFamily="mono"
              >
                {bounty.name}
              </Text>

              {/* Thumbnail */}
              {bounty.imageUrl && (
                <Box
                  borderRadius="none"
                  overflow="hidden"
                  border="1px solid"
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
              <Box
                border="1px solid"
                borderColor="border"
                bg="muted"
              >
                <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    fontFamily="mono"
                    color="text"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    DESCRIPTION
                  </Text>
                </Box>
                <Box px={4} py={4}>
                  <Text whiteSpace="pre-wrap" color="text" fontSize="sm" lineHeight="tall" fontFamily="mono">
                    {bounty.description}
                  </Text>
                </Box>
              </Box>

              {/* Claims / Proofs */}
              <Box>
                <HStack justify="space-between" align="center" mb={4}>
                  <HStack spacing={2}>
                    <Text fontWeight="bold" fontSize="sm" color="text" fontFamily="mono" textTransform="uppercase">
                      Claims
                    </Text>
                    <Box border="1px solid" borderColor="primary" px={2} py={0.5}>
                      <Text fontSize="2xs" fontWeight="bold" fontFamily="mono" color="primary">
                        {bounty.claims?.length ?? 0}
                      </Text>
                    </Box>
                  </HStack>
                  <Link
                    href={poidhUrl}
                    isExternal
                    fontSize="2xs"
                    color="dim"
                    _hover={{ color: 'primary' }}
                    fontFamily="mono"
                    fontWeight="bold"
                  >
                    VIEW ON POIDH.XYZ <ExternalLinkIcon mx="1px" />
                  </Link>
                </HStack>

                {bounty.claims && bounty.claims.length > 0 ? (
                  <VStack align="stretch" gap={2}>
                    {bounty.claims.map((claim) => (
                      <Box
                        key={claim.id}
                        border="1px solid"
                        borderColor={claim.accepted ? 'success' : 'border'}
                        bg="muted"
                        _hover={{ borderColor: 'primary' }}
                        transition="border-color 0.15s"
                      >
                        <HStack
                          justify="space-between"
                          px={4}
                          py={2}
                          borderBottom="1px solid"
                          borderColor="border"
                        >
                          <Tooltip label={claim.issuer} placement="top">
                            <Text
                              fontWeight="bold"
                              fontSize="xs"
                              color="primary"
                              fontFamily="mono"
                              cursor="default"
                            >
                              {shortenAddress(claim.issuer)}
                            </Text>
                          </Tooltip>
                          {claim.accepted && (
                            <Box border="1px solid" borderColor="success" px={2} py={0.5}>
                              <Text fontSize="2xs" fontWeight="bold" fontFamily="mono" color="success">
                                ACCEPTED
                              </Text>
                            </Box>
                          )}
                        </HStack>
                        <Box px={4} py={3}>
                          {claim.description && (
                            <Text fontSize="xs" color="dim" fontFamily="mono" mb={2} noOfLines={3}>
                              {claim.description}
                            </Text>
                          )}
                          {claim.createdAt > 0 && (
                            <Text fontSize="2xs" color="dim" fontFamily="mono">
                              {new Date(claim.createdAt * 1000).toLocaleDateString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                              }).toUpperCase()}
                            </Text>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </VStack>
                ) : (
                  <Box
                    border="1px dashed"
                    borderColor="border"
                    bg="muted"
                    p={8}
                    textAlign="center"
                  >
                    <Text color="dim" fontSize="sm" fontFamily="mono">
                      No claims submitted yet.
                    </Text>
                    {isActive && (
                      <Button
                        as="a"
                        href={poidhUrl}
                        target="_blank"
                        mt={4}
                        size="sm"
                        bg="primary"
                        color="background"
                        borderRadius="none"
                        _hover={{ bg: 'accent', textDecor: 'none' }}
                        rightIcon={<ExternalLinkIcon />}
                        textTransform="uppercase"
                        fontWeight="bold"
                        fontFamily="mono"
                        fontSize="xs"
                        letterSpacing="wider"
                      >
                        Submit on POIDH
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
            </VStack>
          </GridItem>

          {/* ── Sidebar ───────────────────────── */}
          <GridItem>
            <VStack align="stretch" gap={4} position="sticky" top="80px">
              {/* Reward card */}
              <Box
                border="1px solid"
                borderColor="primary"
                bg="muted"
                overflow="hidden"
              >
                <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    fontFamily="mono"
                    color="text"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    REWARD
                  </Text>
                </Box>
                <Box px={4} py={4}>
                  <Box
                    border="1px solid"
                    borderColor="primary"
                    px={4}
                    py={3}
                    bg="rgba(167, 255, 0, 0.03)"
                    mb={4}
                    w="100%"
                  >
                    <HStack spacing={2} align="center" justify="center">
                      <Icon as={FaEthereum} boxSize="18px" color="#627EEA" />
                      <Text fontSize="2xl" fontWeight="900" color="primary" fontFamily="mono" lineHeight="1">
                        {amountFloat < 0.001 ? amountFloat.toFixed(6) : amountFloat.toFixed(4)}
                      </Text>
                      <Text fontSize="sm" fontWeight="bold" color="dim" fontFamily="mono">
                        ETH
                      </Text>
                    </HStack>
                  </Box>

                  <Button
                    as="a"
                    href={poidhUrl}
                    target="_blank"
                    w="100%"
                    size="md"
                    bg="primary"
                    color="background"
                    borderRadius="none"
                    fontWeight="bold"
                    fontFamily="mono"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    fontSize="xs"
                    _hover={{ bg: 'accent', textDecor: 'none' }}
                    _active={{ transform: 'scale(0.98)' }}
                    rightIcon={<ExternalLinkIcon />}
                  >
                    {isActive ? 'SUBMIT PROOF' : 'VIEW ON POIDH'}
                  </Button>
                </Box>
              </Box>

              {/* Meta card */}
              <Box
                border="1px solid"
                borderColor="border"
                bg="muted"
              >
                <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    fontFamily="mono"
                    color="text"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    DETAILS
                  </Text>
                </Box>
                <VStack align="stretch" spacing={0} px={4} py={3}>
                  <HStack
                    justify="space-between"
                    py={2}
                    borderBottom="1px solid"
                    borderColor="border"
                  >
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">ISSUER</Text>
                    <Tooltip label={bounty.issuer} placement="top">
                      <Text fontSize="2xs" fontFamily="mono" color="primary" fontWeight="bold" cursor="default">
                        {shortenAddress(bounty.issuer)}
                      </Text>
                    </Tooltip>
                  </HStack>
                  <HStack
                    justify="space-between"
                    py={2}
                    borderBottom="1px solid"
                    borderColor="border"
                  >
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">CHAIN</Text>
                    <HStack spacing={1}>
                      <Icon as={FaEthereum} boxSize="10px" color="#627EEA" />
                      <Text fontSize="2xs" fontFamily="mono" color="text" fontWeight="bold">
                        {chainLabel.toUpperCase()}
                      </Text>
                    </HStack>
                  </HStack>
                  <HStack
                    justify="space-between"
                    py={2}
                    borderBottom="1px solid"
                    borderColor="border"
                  >
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">BOUNTY ID</Text>
                    <Text fontSize="2xs" fontFamily="mono" color="text" fontWeight="bold">#{bounty.id}</Text>
                  </HStack>
                  <HStack
                    justify="space-between"
                    py={2}
                  >
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">CLAIMS</Text>
                    <Text fontSize="2xs" fontFamily="mono" color="primary" fontWeight="bold">
                      {bounty.claims?.length ?? 0}
                    </Text>
                  </HStack>
                </VStack>
              </Box>

              {/* Back button */}
              <Button
                as={NextLink}
                href="/bounties"
                variant="outline"
                size="sm"
                borderRadius="none"
                borderColor="border"
                fontFamily="mono"
                fontWeight="bold"
                fontSize="xs"
                textTransform="uppercase"
                letterSpacing="wider"
                leftIcon={<FaArrowLeft />}
                _hover={{ borderColor: 'primary', color: 'primary' }}
                w="100%"
              >
                BACK TO BOUNTIES
              </Button>
            </VStack>
          </GridItem>
        </SimpleGrid>
      </Container>
    </Box>
  );
}
