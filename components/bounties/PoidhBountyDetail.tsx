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
  Input,
  Textarea,
} from '@chakra-ui/react';
import NextLink from 'next/link';
import Image from 'next/image';
import { ExternalLinkIcon } from '@chakra-ui/icons';
import { FaEthereum, FaCalendar, FaArrowLeft, FaBolt, FaUsers, FaTrophy, FaVoteYea, FaTimes, FaCheck } from 'react-icons/fa';
import { formatEther } from 'viem';
import { useEffect, useState, useMemo, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import ImageCompressor, { ImageCompressorRef } from '@/lib/utils/ImageCompressor';
import VideoUploader, { VideoUploaderRef } from '@/components/homepage/VideoUploader';
import imageCompression from 'browser-image-compression';
import { uploadToIpfsSmart } from '@/lib/utils/ipfsUpload';
import type { PoidhBounty } from '@/types/poidh';
import { CHAIN_LABEL, CHAIN_PATH } from '@/lib/poidh-constants';
import { usePoidhWrite } from '@/hooks/usePoidhWrite';
import { usePoidhParticipants, usePoidhVotingState, usePoidhParticipantAmount, usePoidhPendingWithdrawals } from '@/hooks/usePoidhRead';

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

  // Wallet
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const poidh = usePoidhWrite();

  // Form states
  const [showContributeForm, setShowContributeForm] = useState(false);
  const [contributeAmount, setContributeAmount] = useState('');
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [claimTitle, setClaimTitle] = useState('');
  const [claimDescription, setClaimDescription] = useState('');
  const [claimUri, setClaimUri] = useState('');
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isDragOverProof, setIsDragOverProof] = useState(false);
  const imageCompressorRef = useRef<ImageCompressorRef>(null);
  const videoUploaderRef = useRef<VideoUploaderRef>(null);

  const numericChainId = parseInt(chainId, 10);
  // Use onChainId for all smart contract interactions (different from indexer id)
  const onChainBountyId = bounty ? BigInt(bounty.onChainId) : undefined;

  // On-chain reads — use onChainId, not indexer id
  const { participants, participantsLoading } = usePoidhParticipants(numericChainId, onChainBountyId);
  const votingState = usePoidhVotingState(numericChainId, onChainBountyId);
  // Use API-reported bounty type (from indexer's isMultiplayer flag)
  const isOpenBounty = bounty?.isOpenBounty ?? false;
  const { amount: userContribution } = usePoidhParticipantAmount(
    numericChainId,
    onChainBountyId,
    address as `0x${string}` | undefined,
  );
  const { pendingAmount } = usePoidhPendingWithdrawals(
    numericChainId,
    address as `0x${string}` | undefined,
  );

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

  const amountInEth = bounty ? safeFormatEther(bounty.amount) : '0';
  const amountFloat = parseFloat(amountInEth);
  const isActive = bounty ? (bounty.isActive ?? !bounty.claimer) : false;
  // Cancelled — use indexer's isCanceled flag, or fallback to claimer === issuer
  const isCancelled = bounty?.isCanceled
    || (bounty?.claimer && bounty?.issuer
      ? bounty.claimer.toLowerCase() === bounty.issuer.toLowerCase()
      : false);
  const hasPendingWithdrawal = parseFloat(pendingAmount) > 0;
  const createdDate = bounty && bounty.createdAt > 0
    ? new Date(bounty.createdAt * 1000).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric',
      }).toUpperCase()
    : null;
  const poidhUrl = bounty ? `https://poidh.xyz/${CHAIN_PATH[numericChainId]}/bounty/${bounty.id}` : '';
  const chainLabel = CHAIN_LABEL[numericChainId] ?? 'Unknown';
  const statusColor = isCancelled ? 'warning' : isActive ? 'success' : 'error';
  const statusLabel = isCancelled ? 'CANCELLED' : isActive ? 'OPEN' : 'CLOSED';

  const isIssuer = useMemo(() => {
    if (!bounty || !address) return false;
    return bounty.issuer.toLowerCase() === address.toLowerCase();
  }, [bounty, address]);

  const isContributor = parseFloat(userContribution) > 0;
  const hasVotingClaim = votingState.currentVotingClaimId > 0;
  const votingActive = votingState.votingDeadline > 0 && votingState.votingDeadline * 1000 > Date.now();
  const votingExpired = votingState.votingDeadline > 0 && votingState.votingDeadline * 1000 <= Date.now();

  // Participant amounts — read from API participants data if available
  const participantEntries = useMemo(() => {
    if (!bounty?.participants) return [];
    const { addresses, amounts } = bounty.participants;
    if (!addresses || !amounts) return [];
    return addresses.map((addr, i) => ({
      address: addr,
      amount: safeFormatEther(amounts[i] || '0'),
    }));
  }, [bounty?.participants]);

  const isBusy = poidh.status === 'switching-chain' || poidh.status === 'pending-approval' || poidh.status === 'pending-tx';

  const handleContribute = async () => {
    if (!isConnected) { openConnectModal?.(); return; }
    if (!onChainBountyId || !contributeAmount) return;
    try {
      await poidh.joinOpenBounty(numericChainId, onChainBountyId, contributeAmount);
      setShowContributeForm(false);
      setContributeAmount('');
      // Refresh bounty data
      window.location.reload();
    } catch { /* handled by hook */ }
  };

  const handleWithdrawContribution = async () => {
    if (!onChainBountyId) return;
    try {
      await poidh.withdrawFromOpenBounty(numericChainId, onChainBountyId);
      window.location.reload();
    } catch { /* handled by hook */ }
  };

  // ── Proof upload handlers ──
  const handleProofImageUpload = async (compressedUrl: string | null, fileName?: string) => {
    if (!compressedUrl) return;
    setIsUploadingProof(true);
    try {
      const blob = await fetch(compressedUrl).then(r => r.blob());
      const result = await uploadToIpfsSmart(blob, { fileName: fileName || 'proof.jpg' });
      if (result?.url) setClaimUri(result.url);
    } catch (e) {
      console.error('Image upload failed:', e);
    } finally {
      setIsUploadingProof(false);
    }
  };

  const handleProofVideoUpload = (result: { url?: string; hash?: string } | null) => {
    if (result?.url) setClaimUri(result.url);
  };

  const handleProofDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverProof(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        setIsUploadingProof(true);
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 2,
            maxWidthOrHeight: 1920,
            useWebWorker: true,
          });
          const url = URL.createObjectURL(compressed);
          await handleProofImageUpload(url, compressed.name);
          URL.revokeObjectURL(url);
        } catch { /* ignore */ } finally {
          setIsUploadingProof(false);
        }
      } else if (file.type.startsWith('video/')) {
        if (videoUploaderRef.current?.handleFile) {
          setIsUploadingProof(true);
          try {
            await videoUploaderRef.current.handleFile(file);
          } catch { /* ignore */ } finally {
            setIsUploadingProof(false);
          }
        }
      }
    }
  };

  const handleSubmitClaim = async () => {
    if (!isConnected) { openConnectModal?.(); return; }
    if (!onChainBountyId || !claimTitle.trim()) return;
    try {
      await poidh.createClaim(numericChainId, onChainBountyId, claimTitle, claimDescription, claimUri);
      setShowClaimForm(false);
      setClaimTitle('');
      setClaimDescription('');
      setClaimUri('');
      window.location.reload();
    } catch { /* handled by hook */ }
  };

  const handleAcceptClaim = async (claimId: string) => {
    if (!onChainBountyId) return;
    try {
      await poidh.acceptClaim(numericChainId, onChainBountyId, BigInt(claimId));
      window.location.reload();
    } catch { /* handled by hook */ }
  };

  const handleSubmitForVote = async (claimId: string) => {
    if (!onChainBountyId) return;
    try {
      await poidh.submitClaimForVote(numericChainId, onChainBountyId, BigInt(claimId));
      window.location.reload();
    } catch { /* handled by hook */ }
  };

  const handleVote = async (vote: boolean) => {
    if (!onChainBountyId) return;
    try {
      await poidh.voteClaim(numericChainId, onChainBountyId, vote);
      window.location.reload();
    } catch { /* handled by hook */ }
  };

  const handleResolveVote = async () => {
    if (!onChainBountyId) return;
    try {
      await poidh.resolveVote(numericChainId, onChainBountyId);
      window.location.reload();
    } catch { /* handled by hook */ }
  };

  const handleCancelBounty = async () => {
    if (!onChainBountyId) return;
    try {
      if (isOpenBounty) {
        await poidh.cancelOpenBounty(numericChainId, onChainBountyId);
      } else {
        await poidh.cancelSoloBounty(numericChainId, onChainBountyId);
      }
      window.location.reload();
    } catch { /* handled by hook */ }
  };

  const handleReclaimFunds = async () => {
    if (!isConnected) { openConnectModal?.(); return; }
    try {
      await poidh.withdraw(numericChainId);
      window.location.reload();
    } catch { /* handled by hook */ }
  };

  // ── Loading / Error states ──────────────────────────────────
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
                    {isOpenBounty ? 'OPEN BOUNTY' : 'SOLO BOUNTY'}
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

              {/* Thumbnail */}
              {bounty.imageUrl && (
                <Box
                  borderRadius="none"
                  overflow="hidden"
                  border="1px solid"
                  borderColor="border"
                  bg="background"
                >
                  <Image
                    src={bounty.imageUrl}
                    alt={bounty.name}
                    width={800}
                    height={600}
                    style={{ width: '100%', height: 'auto', maxHeight: '500px', objectFit: 'contain' }}
                    unoptimized
                  />
                </Box>
              )}

              {/* Description */}
              <Box border="1px solid" borderColor="border" bg="muted">
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

              {/* ── Contributors panel (open bounties) ──── */}
              {(isOpenBounty || participantEntries.length > 0 || participants.length > 0) && (
                <Box border="1px solid" borderColor="border" bg="muted">
                  <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                    <HStack spacing={2} align="center">
                      <Icon as={FaUsers} boxSize="12px" color="dim" />
                      <Text
                        fontSize="xs"
                        fontWeight="bold"
                        fontFamily="mono"
                        color="text"
                        textTransform="uppercase"
                        letterSpacing="wider"
                      >
                        CONTRIBUTORS ({participantEntries.length || participants.length})
                      </Text>
                    </HStack>
                  </Box>
                  <VStack align="stretch" spacing={0} px={4} py={2}>
                    {participantEntries.length > 0 ? (
                      participantEntries.map((p, idx) => {
                        const ethAmt = parseFloat(p.amount);
                        const pct = amountFloat > 0 ? ((ethAmt / amountFloat) * 100).toFixed(1) : '0';
                        return (
                          <HStack
                            key={p.address}
                            py={2}
                            borderBottom={idx < participantEntries.length - 1 ? '1px solid' : 'none'}
                            borderColor="border"
                            justify="space-between"
                          >
                            <Tooltip label={p.address} placement="top">
                              <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="primary" cursor="default">
                                {shortenAddress(p.address)}
                              </Text>
                            </Tooltip>
                            <HStack spacing={2}>
                              <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="text">
                                {ethAmt < 0.001 ? ethAmt.toFixed(6) : ethAmt.toFixed(4)} ETH
                              </Text>
                              <Text fontSize="2xs" fontFamily="mono" color="dim">
                                ({pct}%)
                              </Text>
                            </HStack>
                          </HStack>
                        );
                      })
                    ) : participants.length > 0 ? (
                      participants.map((addr, idx) => (
                        <HStack
                          key={addr}
                          py={2}
                          borderBottom={idx < participants.length - 1 ? '1px solid' : 'none'}
                          borderColor="border"
                          justify="space-between"
                        >
                          <Tooltip label={addr} placement="top">
                            <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="primary" cursor="default">
                              {shortenAddress(addr)}
                            </Text>
                          </Tooltip>
                        </HStack>
                      ))
                    ) : (
                      <Text fontSize="xs" fontFamily="mono" color="dim" py={2}>
                        No contributors yet.
                      </Text>
                    )}
                  </VStack>

                  {/* Contribute button */}
                  {isActive && isOpenBounty && (
                    <Box px={4} pb={3}>
                      {showContributeForm ? (
                        <VStack spacing={2} align="stretch">
                          <HStack>
                            <Input
                              type="number"
                              step="0.001"
                              min="0.001"
                              value={contributeAmount}
                              onChange={(e) => setContributeAmount(e.target.value)}
                              placeholder="0.01"
                              bg="background"
                              border="1px solid"
                              borderColor="border"
                              borderRadius="none"
                              fontFamily="mono"
                              fontSize="sm"
                              color="text"
                              _placeholder={{ color: 'dim' }}
                              _focus={{ borderColor: 'primary', boxShadow: 'none' }}
                            />
                            <Button
                              onClick={handleContribute}
                              isLoading={isBusy}
                              bg="primary"
                              color="background"
                              borderRadius="none"
                              fontFamily="mono"
                              fontWeight="bold"
                              fontSize="xs"
                              _hover={{ bg: 'accent' }}
                              isDisabled={!contributeAmount || parseFloat(contributeAmount) < 0.001}
                            >
                              SEND
                            </Button>
                            <Button
                              onClick={() => setShowContributeForm(false)}
                              variant="ghost"
                              borderRadius="none"
                              fontFamily="mono"
                              fontSize="xs"
                              color="dim"
                            >
                              CANCEL
                            </Button>
                          </HStack>
                        </VStack>
                      ) : (
                        <Button
                          onClick={() => {
                            if (!isConnected) { openConnectModal?.(); return; }
                            setShowContributeForm(true);
                          }}
                          w="100%"
                          bg="transparent"
                          border="1px solid"
                          borderColor="primary"
                          color="primary"
                          borderRadius="none"
                          fontFamily="mono"
                          fontWeight="bold"
                          fontSize="xs"
                          textTransform="uppercase"
                          letterSpacing="wider"
                          _hover={{ bg: 'rgba(167, 255, 0, 0.05)' }}
                          leftIcon={<Icon as={FaEthereum} boxSize="10px" />}
                        >
                          CONTRIBUTE ETH
                        </Button>
                      )}
                    </Box>
                  )}

                  {/* Withdraw contribution */}
                  {isActive && isContributor && !isIssuer && !hasVotingClaim && (
                    <Box px={4} pb={3}>
                      <Button
                        onClick={handleWithdrawContribution}
                        isLoading={isBusy}
                        w="100%"
                        bg="transparent"
                        border="1px solid"
                        borderColor="error"
                        color="error"
                        borderRadius="none"
                        fontFamily="mono"
                        fontWeight="bold"
                        fontSize="xs"
                        textTransform="uppercase"
                        _hover={{ bg: 'rgba(255, 0, 0, 0.05)' }}
                      >
                        WITHDRAW MY CONTRIBUTION ({userContribution} ETH)
                      </Button>
                    </Box>
                  )}
                </Box>
              )}

              {/* ── Voting panel ──────────────────── */}
              {hasVotingClaim && (
                <Box border="1px solid" borderColor="warning" bg="muted">
                  <Box borderBottom="1px solid" borderColor="warning" px={4} py={2}>
                    <HStack spacing={2} align="center">
                      <Icon as={FaVoteYea} boxSize="12px" color="warning" />
                      <Text
                        fontSize="xs"
                        fontWeight="bold"
                        fontFamily="mono"
                        color="warning"
                        textTransform="uppercase"
                        letterSpacing="wider"
                      >
                        VOTING IN PROGRESS
                      </Text>
                    </HStack>
                  </Box>
                  <VStack align="stretch" spacing={3} px={4} py={3}>
                    <HStack justify="space-between">
                      <Text fontSize="xs" fontFamily="mono" color="dim">CLAIM #{votingState.currentVotingClaimId}</Text>
                      <Text fontSize="xs" fontFamily="mono" color="dim">ROUND {votingState.voteRound}</Text>
                    </HStack>

                    {/* Vote tally */}
                    <Box>
                      <HStack justify="space-between" mb={1}>
                        <Text fontSize="2xs" fontFamily="mono" color="success" fontWeight="bold">
                          YES: {votingState.yesVotes} ETH
                        </Text>
                        <Text fontSize="2xs" fontFamily="mono" color="error" fontWeight="bold">
                          NO: {votingState.noVotes} ETH
                        </Text>
                      </HStack>
                      <Box bg="border" h="8px" w="100%">
                        <Box
                          bg="success"
                          h="100%"
                          w={`${
                            parseFloat(votingState.yesVotes) + parseFloat(votingState.noVotes) > 0
                              ? (parseFloat(votingState.yesVotes) / (parseFloat(votingState.yesVotes) + parseFloat(votingState.noVotes))) * 100
                              : 50
                          }%`}
                          transition="width 0.3s"
                        />
                      </Box>
                    </Box>

                    {/* Deadline */}
                    {votingState.votingDeadline > 0 && (
                      <Text fontSize="2xs" fontFamily="mono" color="dim">
                        {votingActive
                          ? `ENDS: ${new Date(votingState.votingDeadline * 1000).toLocaleString()}`
                          : 'VOTING PERIOD ENDED'}
                      </Text>
                    )}

                    {/* Vote buttons (for contributors who aren't the issuer) */}
                    {votingActive && isContributor && !isIssuer && (
                      <HStack spacing={2}>
                        <Button
                          onClick={() => handleVote(true)}
                          isLoading={isBusy}
                          flex={1}
                          bg="success"
                          color="background"
                          borderRadius="none"
                          fontFamily="mono"
                          fontWeight="bold"
                          fontSize="xs"
                          _hover={{ opacity: 0.9 }}
                          leftIcon={<Icon as={FaCheck} boxSize="10px" />}
                        >
                          VOTE YES
                        </Button>
                        <Button
                          onClick={() => handleVote(false)}
                          isLoading={isBusy}
                          flex={1}
                          bg="error"
                          color="background"
                          borderRadius="none"
                          fontFamily="mono"
                          fontWeight="bold"
                          fontSize="xs"
                          _hover={{ opacity: 0.9 }}
                          leftIcon={<Icon as={FaTimes} boxSize="10px" />}
                        >
                          VOTE NO
                        </Button>
                      </HStack>
                    )}

                    {/* Resolve button */}
                    {votingExpired && (
                      <Button
                        onClick={handleResolveVote}
                        isLoading={isBusy}
                        bg="warning"
                        color="background"
                        borderRadius="none"
                        fontFamily="mono"
                        fontWeight="bold"
                        fontSize="xs"
                        _hover={{ opacity: 0.9 }}
                        leftIcon={<Icon as={FaTrophy} boxSize="10px" />}
                      >
                        RESOLVE VOTE
                      </Button>
                    )}
                  </VStack>
                </Box>
              )}

              {/* ── Claims / Proofs ──────────────── */}
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
                          <HStack spacing={2}>
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
                            {claim.name && (
                              <Text fontSize="xs" fontFamily="mono" color="text" fontWeight="bold" noOfLines={1}>
                                {claim.name}
                              </Text>
                            )}
                          </HStack>
                          <HStack spacing={2}>
                            {claim.accepted && (
                              <Box border="1px solid" borderColor="success" px={2} py={0.5}>
                                <Text fontSize="2xs" fontWeight="bold" fontFamily="mono" color="success">
                                  ACCEPTED
                                </Text>
                              </Box>
                            )}
                            {/* Issuer actions on claims */}
                            {isIssuer && isActive && !claim.accepted && (
                              <>
                                {!isOpenBounty ? (
                                  <Button
                                    onClick={() => handleAcceptClaim(claim.id)}
                                    isLoading={isBusy}
                                    size="xs"
                                    bg="success"
                                    color="background"
                                    borderRadius="none"
                                    fontFamily="mono"
                                    fontWeight="bold"
                                    fontSize="2xs"
                                    _hover={{ opacity: 0.9 }}
                                  >
                                    ACCEPT
                                  </Button>
                                ) : !hasVotingClaim && (
                                  <Button
                                    onClick={() => handleSubmitForVote(claim.id)}
                                    isLoading={isBusy}
                                    size="xs"
                                    bg="warning"
                                    color="background"
                                    borderRadius="none"
                                    fontFamily="mono"
                                    fontWeight="bold"
                                    fontSize="2xs"
                                    _hover={{ opacity: 0.9 }}
                                  >
                                    NOMINATE
                                  </Button>
                                )}
                              </>
                            )}
                          </HStack>
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
                  </Box>
                )}

                {/* ── Submit claim form ──────────── */}
                {isActive && (
                  <Box mt={3}>
                    {showClaimForm ? (
                      <Box border="1px solid" borderColor="primary" bg="muted" p={4}>
                        <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="text" mb={3} textTransform="uppercase">
                          SUBMIT YOUR PROOF
                        </Text>
                        <VStack spacing={3} align="stretch">
                          <Input
                            value={claimTitle}
                            onChange={(e) => setClaimTitle(e.target.value)}
                            placeholder="Claim title"
                            bg="background"
                            border="1px solid"
                            borderColor="border"
                            borderRadius="none"
                            fontFamily="mono"
                            fontSize="sm"
                            color="text"
                            _placeholder={{ color: 'dim' }}
                            _focus={{ borderColor: 'primary', boxShadow: 'none' }}
                          />
                          <Textarea
                            value={claimDescription}
                            onChange={(e) => setClaimDescription(e.target.value)}
                            placeholder="Describe your proof..."
                            bg="background"
                            border="1px solid"
                            borderColor="border"
                            borderRadius="none"
                            fontFamily="mono"
                            fontSize="sm"
                            color="text"
                            rows={3}
                            _placeholder={{ color: 'dim' }}
                            _focus={{ borderColor: 'primary', boxShadow: 'none' }}
                          />
                          {/* Upload zone + URL input */}
                          {claimUri ? (
                            <Box position="relative" border="1px solid" borderColor="primary" bg="background" p={2}>
                              {claimUri.match(/\.(mp4|webm|mov)$/i) || claimUri.includes('video') ? (
                                <video src={claimUri} controls style={{ width: '100%', maxHeight: '180px' }} />
                              ) : (
                                <Box
                                  as="img"
                                  src={claimUri}
                                  alt="Proof"
                                  w="100%"
                                  maxH="180px"
                                  objectFit="contain"
                                />
                              )}
                              <Button
                                position="absolute"
                                top={1}
                                right={1}
                                size="xs"
                                bg="rgba(0,0,0,0.7)"
                                color="error"
                                borderRadius="none"
                                onClick={() => setClaimUri('')}
                                _hover={{ bg: 'rgba(0,0,0,0.9)' }}
                              >
                                <Icon as={FaTimes} />
                              </Button>
                            </Box>
                          ) : (
                            <Box
                              border="2px dashed"
                              borderColor={isDragOverProof ? 'primary' : 'border'}
                              bg={isDragOverProof ? 'rgba(167,255,0,0.05)' : 'background'}
                              p={4}
                              textAlign="center"
                              cursor="pointer"
                              transition="all 0.2s"
                              onDragOver={(e) => { e.preventDefault(); setIsDragOverProof(true); }}
                              onDragLeave={() => setIsDragOverProof(false)}
                              onDrop={handleProofDrop}
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = 'image/*,video/*';
                                input.onchange = async (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (!file) return;
                                  if (file.type.startsWith('image/')) {
                                    setIsUploadingProof(true);
                                    try {
                                      const compressed = await imageCompression(file, {
                                        maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true,
                                      });
                                      const url = URL.createObjectURL(compressed);
                                      await handleProofImageUpload(url, compressed.name);
                                      URL.revokeObjectURL(url);
                                    } catch { /* ignore */ } finally { setIsUploadingProof(false); }
                                  } else if (file.type.startsWith('video/')) {
                                    if (videoUploaderRef.current?.handleFile) {
                                      setIsUploadingProof(true);
                                      try { await videoUploaderRef.current.handleFile(file); }
                                      catch { /* ignore */ } finally { setIsUploadingProof(false); }
                                    }
                                  }
                                };
                                input.click();
                              }}
                            >
                              {isUploadingProof ? (
                                <VStack spacing={1}>
                                  <Spinner size="sm" color="primary" />
                                  <Text fontSize="xs" fontFamily="mono" color="primary">UPLOADING...</Text>
                                </VStack>
                              ) : (
                                <VStack spacing={1}>
                                  <Text fontSize="sm" fontFamily="mono" color="dim">
                                    DROP IMAGE/VIDEO OR CLICK TO UPLOAD
                                  </Text>
                                  <Text fontSize="2xs" fontFamily="mono" color="dim" opacity={0.5}>
                                    Auto-uploads to IPFS
                                  </Text>
                                </VStack>
                              )}
                            </Box>
                          )}
                          <Input
                            value={claimUri}
                            onChange={(e) => setClaimUri(e.target.value)}
                            placeholder="Or paste URL (image/video link or IPFS URI)"
                            bg="background"
                            border="1px solid"
                            borderColor="border"
                            borderRadius="none"
                            fontFamily="mono"
                            fontSize="xs"
                            color="text"
                            _placeholder={{ color: 'dim' }}
                            _focus={{ borderColor: 'primary', boxShadow: 'none' }}
                          />
                          {/* Hidden upload components */}
                          <Box display="none">
                            <ImageCompressor
                              ref={imageCompressorRef}
                              onUpload={handleProofImageUpload}
                            />
                            <VideoUploader
                              ref={videoUploaderRef}
                              onUpload={handleProofVideoUpload}
                            />
                          </Box>
                          <HStack spacing={2}>
                            <Button
                              onClick={handleSubmitClaim}
                              isLoading={isBusy}
                              flex={1}
                              bg="primary"
                              color="background"
                              borderRadius="none"
                              fontFamily="mono"
                              fontWeight="bold"
                              fontSize="xs"
                              textTransform="uppercase"
                              _hover={{ bg: 'accent' }}
                              isDisabled={!claimTitle.trim()}
                            >
                              SUBMIT CLAIM
                            </Button>
                            <Button
                              onClick={() => setShowClaimForm(false)}
                              variant="ghost"
                              borderRadius="none"
                              fontFamily="mono"
                              fontSize="xs"
                              color="dim"
                            >
                              CANCEL
                            </Button>
                          </HStack>
                        </VStack>
                      </Box>
                    ) : (
                      <Button
                        onClick={() => {
                          if (!isConnected) { openConnectModal?.(); return; }
                          setShowClaimForm(true);
                        }}
                        w="100%"
                        bg="primary"
                        color="background"
                        borderRadius="none"
                        fontFamily="mono"
                        fontWeight="bold"
                        fontSize="sm"
                        textTransform="uppercase"
                        letterSpacing="wider"
                        _hover={{ bg: 'accent' }}
                        leftIcon={<Icon as={FaBolt} boxSize="12px" />}
                      >
                        SUBMIT PROOF
                      </Button>
                    )}
                  </Box>
                )}
              </Box>

              {/* ── TX Status feedback ────────────── */}
              {poidh.status !== 'idle' && poidh.status !== 'confirmed' && (
                <Box
                  border="1px solid"
                  borderColor={poidh.status === 'error' ? 'error' : 'primary'}
                  px={4}
                  py={2}
                >
                  <Text
                    fontSize="xs"
                    fontFamily="mono"
                    fontWeight="bold"
                    color={poidh.status === 'error' ? 'error' : 'primary'}
                    textAlign="center"
                  >
                    {poidh.status === 'switching-chain' && `SWITCHING TO ${chainLabel.toUpperCase()}...`}
                    {poidh.status === 'pending-approval' && 'CONFIRM IN WALLET...'}
                    {poidh.status === 'pending-tx' && 'WAITING FOR CONFIRMATION...'}
                    {poidh.status === 'error' && (poidh.error || 'TRANSACTION FAILED')}
                  </Text>
                </Box>
              )}
            </VStack>
          </GridItem>

          {/* ── Sidebar ───────────────────────── */}
          <GridItem>
            <VStack align="stretch" gap={4} position="sticky" top="80px">
              {/* Reward card */}
              <Box border="1px solid" borderColor="primary" bg="muted" overflow="hidden">
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

                  {/* Your contribution */}
                  {isContributor && (
                    <Box
                      border="1px dashed"
                      borderColor="border"
                      px={3}
                      py={2}
                      mb={3}
                    >
                      <Text fontSize="2xs" fontFamily="mono" color="dim" mb={1}>YOUR CONTRIBUTION</Text>
                      <Text fontSize="sm" fontFamily="mono" fontWeight="bold" color="primary">
                        {userContribution} ETH
                      </Text>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Meta card */}
              <Box border="1px solid" borderColor="border" bg="muted">
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
                  <HStack justify="space-between" py={2} borderBottom="1px solid" borderColor="border">
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">ISSUER</Text>
                    <Tooltip label={bounty.issuer} placement="top">
                      <Text fontSize="2xs" fontFamily="mono" color="primary" fontWeight="bold" cursor="default">
                        {shortenAddress(bounty.issuer)}
                      </Text>
                    </Tooltip>
                  </HStack>
                  <HStack justify="space-between" py={2} borderBottom="1px solid" borderColor="border">
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">CHAIN</Text>
                    <HStack spacing={1}>
                      <Icon as={FaEthereum} boxSize="10px" color="#627EEA" />
                      <Text fontSize="2xs" fontFamily="mono" color="text" fontWeight="bold">
                        {chainLabel.toUpperCase()}
                      </Text>
                    </HStack>
                  </HStack>
                  <HStack justify="space-between" py={2} borderBottom="1px solid" borderColor="border">
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">TYPE</Text>
                    <Text fontSize="2xs" fontFamily="mono" color="text" fontWeight="bold">
                      {isOpenBounty ? 'OPEN' : 'SOLO'}
                    </Text>
                  </HStack>
                  <HStack justify="space-between" py={2} borderBottom="1px solid" borderColor="border">
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">BOUNTY ID</Text>
                    <Text fontSize="2xs" fontFamily="mono" color="text" fontWeight="bold">#{bounty.id}</Text>
                  </HStack>
                  <HStack justify="space-between" py={2} borderBottom="1px solid" borderColor="border">
                    <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">CLAIMS</Text>
                    <Text fontSize="2xs" fontFamily="mono" color="primary" fontWeight="bold">
                      {bounty.claims?.length ?? 0}
                    </Text>
                  </HStack>
                  {participants.length > 0 && (
                    <HStack justify="space-between" py={2}>
                      <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold">CONTRIBUTORS</Text>
                      <Text fontSize="2xs" fontFamily="mono" color="primary" fontWeight="bold">
                        {participants.length}
                      </Text>
                    </HStack>
                  )}
                </VStack>
              </Box>

              {/* Issuer actions: Cancel (active) or Reclaim (cancelled) */}
              {isIssuer && isActive && !isCancelled && (
                <Button
                  onClick={handleCancelBounty}
                  isLoading={isBusy}
                  w="100%"
                  size="sm"
                  bg="transparent"
                  border="1px solid"
                  borderColor="error"
                  color="error"
                  borderRadius="none"
                  fontFamily="mono"
                  fontWeight="bold"
                  fontSize="xs"
                  textTransform="uppercase"
                  _hover={{ bg: 'rgba(255, 0, 0, 0.05)' }}
                >
                  CANCEL BOUNTY
                </Button>
              )}
              {isIssuer && isCancelled && hasPendingWithdrawal && (
                <Button
                  onClick={handleReclaimFunds}
                  isLoading={isBusy}
                  w="100%"
                  size="sm"
                  bg="transparent"
                  border="1px solid"
                  borderColor="primary"
                  color="primary"
                  borderRadius="none"
                  fontFamily="mono"
                  fontWeight="bold"
                  fontSize="xs"
                  textTransform="uppercase"
                  _hover={{ bg: 'rgba(167, 255, 0, 0.05)' }}
                >
                  RECLAIM {pendingAmount} ETH
                </Button>
              )}

              {/* Explorer link */}
              <Link
                href={poidhUrl}
                isExternal
                display="block"
              >
                <Button
                  w="100%"
                  variant="outline"
                  size="sm"
                  borderRadius="none"
                  borderColor="border"
                  fontFamily="mono"
                  fontWeight="bold"
                  fontSize="xs"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  rightIcon={<ExternalLinkIcon />}
                  _hover={{ borderColor: 'primary', color: 'primary' }}
                >
                  VIEW ON POIDH.XYZ
                </Button>
              </Link>

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
