'use client';

import { useState, useMemo } from 'react';
import {
  Box,
  Container,
  HStack,
  VStack,
  Text,
  Button,
  Icon,
  Flex,
  Avatar,
} from '@chakra-ui/react';
import { FaHive, FaEthereum, FaPen, FaFolder, FaCheckCircle, FaTrophy } from 'react-icons/fa';
import useIsMobile from '@/hooks/useIsMobile';
import useEffectiveHiveUser from '@/hooks/useEffectiveHiveUser';
import SkateModal from '@/components/shared/SkateModal';
import BountyComposer from '@/components/bounties/BountyComposer';
import PoidhBountyComposer from '@/components/bounties/PoidhBountyComposer';
import UnifiedBountyList from '@/components/bounties/UnifiedBountyList';
import type { SourceFilter } from '@/components/bounties/UnifiedBountyList';
import type { Discussion } from '@hiveio/dhive';
import type { UnifiedBounty } from '@/types/unified-bounty';

type ModalStep = 'choice' | 'hive-form' | 'eth-form';

const SOURCE_FILTERS: { key: SourceFilter; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'hive', label: 'HIVE' },
  { key: 'poidh', label: 'POIDH' },
];

export default function BountiesHubClient() {
  const isMobile = useIsMobile();
  const { handle } = useEffectiveHiveUser();

  const [newBounty, setNewBounty] = useState<Partial<Discussion> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('choice');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [allBounties, setAllBounties] = useState<UnifiedBounty[]>([]);

  // Compute top winners leaderboard
  const topWinners = useMemo(() => {
    const winMap = new Map<string, { display: string; avatar: string | null; source: 'hive' | 'poidh'; wins: number }>();
    for (const b of allBounties) {
      if (!b.winnerDisplay) continue;
      const key = b.winnerDisplay.toLowerCase();
      const existing = winMap.get(key);
      if (existing) {
        existing.wins += 1;
      } else {
        winMap.set(key, {
          display: b.winnerDisplay,
          avatar: b.winnerAvatar,
          source: b.source,
          wins: 1,
        });
      }
    }
    return Array.from(winMap.values())
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 10);
  }, [allBounties]);

  const handleOpenModal = () => {
    setModalStep('choice');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalStep('choice');
  };

  const handleChooseHive = () => {
    setModalStep('hive-form');
  };

  const handleChooseEth = () => {
    setModalStep('eth-form');
  };

  return (
    <Container maxW="container.xl" px={{ base: 3, md: 4 }} py={{ base: 4, md: 6 }}>
      {/* ── Header bar ──────────────────────────── */}
      <Box
        border="1px solid"
        borderColor="primary"
        bg="muted"
        px={{ base: 3, md: 6 }}
        py={{ base: 2, md: 3 }}
        mb={{ base: 4, md: 6 }}
      >
        <HStack justify="space-between" align="center">
          <Text
            fontWeight="900"
            fontFamily="mono"
            color="primary"
            textTransform="uppercase"
            letterSpacing="wider"
            fontSize={{ base: 'md', md: '2xl' }}
          >
            SKATEHIVE BOUNTIES
          </Text>

          <HStack spacing={3} align="center">
            {handle && (
              <Text
                fontSize="xs"
                fontFamily="mono"
                color="dim"
                display={{ base: 'none', md: 'block' }}
              >
                WELCOME, <Text as="span" color="primary" fontWeight="bold">{handle.toUpperCase()}</Text>
              </Text>
            )}
            <HStack spacing={0.5} display={{ base: 'none', sm: 'flex' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <Box key={i} w="4px" h="4px" bg={i < 5 ? 'primary' : 'dim'} />
              ))}
            </HStack>
          </HStack>
        </HStack>
      </Box>

      {/* ── Two-column layout ────────────────────── */}
      <Flex
        gap={6}
        direction={{ base: 'column', lg: 'row' }}
        align="flex-start"
      >
        {/* ── Main content ───────────────────────── */}
        <Box flex={1} minW={0}>
          {/* Source filter tabs + create button */}
          <Flex
            justify="space-between"
            align={{ base: 'stretch', sm: 'center' }}
            mb={{ base: 4, md: 5 }}
            gap={3}
            direction={{ base: 'column', sm: 'row' }}
          >
            <HStack
              border="1px solid"
              borderColor="border"
              bg="muted"
              spacing={0}
            >
              {SOURCE_FILTERS.map((f) => (
                <Box
                  key={f.key}
                  as="button"
                  px={{ base: 3, md: 4 }}
                  py={2}
                  fontSize="xs"
                  fontWeight="bold"
                  fontFamily="mono"
                  textTransform="uppercase"
                  letterSpacing="wider"
                  color={sourceFilter === f.key ? 'background' : 'dim'}
                  bg={sourceFilter === f.key ? 'primary' : 'transparent'}
                  _hover={{ color: sourceFilter === f.key ? 'background' : 'text' }}
                  transition="all 0.15s"
                  onClick={() => setSourceFilter(f.key)}
                  borderRight="1px solid"
                  borderColor="border"
                  _last={{ borderRight: 'none' }}
                  flex={{ base: 1, sm: 'initial' }}
                  textAlign="center"
                >
                  {f.label}
                </Box>
              ))}
            </HStack>

            <Button
              size="sm"
              onClick={handleOpenModal}
              fontWeight="bold"
              fontFamily="mono"
              px={4}
              bg="primary"
              color="background"
              borderRadius="none"
              textTransform="uppercase"
              fontSize="xs"
              letterSpacing="wider"
              _hover={{ bg: 'accent', color: 'background' }}
              w={{ base: '100%', sm: 'auto' }}
            >
              + CREATE BOUNTY
            </Button>
          </Flex>

          {/* Bounty grid */}
          <UnifiedBountyList
            newBounty={newBounty as any}
            refreshTrigger={refreshTrigger}
            sourceFilter={sourceFilter}
            onBountiesLoaded={setAllBounties}
          />
        </Box>

        {/* ── Sidebar ────────────────────────────── */}
        <Box
          w={{ base: '100%', lg: '300px' }}
          flexShrink={0}
        >
          <VStack spacing={5} align="stretch">
            {/* About bounties */}
            <Box border="1px solid" borderColor="border" bg="muted">
              <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                <Text
                  fontSize="sm"
                  fontWeight="bold"
                  fontFamily="mono"
                  color="text"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  ABOUT BOUNTIES
                </Text>
              </Box>
              <VStack align="stretch" spacing={3} px={4} py={4}>
                <Text fontSize="xs" color="dim" fontFamily="mono" lineHeight="tall">
                  Complete challenges, upload proof, and earn rewards. Each bounty has a
                  specific task — follow instructions and submit your video to get paid
                  in ETH or HIVE.
                </Text>
                <Box borderTop="1px dashed" borderColor="border" pt={3}>
                  <VStack align="stretch" spacing={2}>
                    <HStack spacing={2} align="center">
                      <Icon as={FaPen} boxSize="11px" color="dim" />
                      <Text fontSize="xs" fontFamily="mono" color="text" fontWeight="bold">
                        1. PICK A BOUNTY
                      </Text>
                    </HStack>
                    <HStack spacing={2} align="center">
                      <Icon as={FaCheckCircle} boxSize="11px" color="dim" />
                      <Text fontSize="xs" fontFamily="mono" color="text" fontWeight="bold">
                        2. COMPLETE THE TASK
                      </Text>
                    </HStack>
                    <HStack spacing={2} align="center">
                      <Icon as={FaFolder} boxSize="11px" color="dim" />
                      <Text fontSize="xs" fontFamily="mono" color="text" fontWeight="bold">
                        3. UPLOAD YOUR PROOF
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
              </VStack>
            </Box>

            {/* Networks */}
            <Box border="1px solid" borderColor="border" bg="muted">
              <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                <Text
                  fontSize="sm"
                  fontWeight="bold"
                  fontFamily="mono"
                  color="text"
                  textTransform="uppercase"
                  letterSpacing="wider"
                >
                  NETWORKS
                </Text>
              </Box>
              <VStack align="stretch" spacing={0} px={4} py={3}>
                <HStack spacing={2} py={1.5} borderBottom="1px solid" borderColor="border">
                  <Icon as={FaHive} boxSize="14px" color="#E31337" />
                  <Text fontSize="xs" fontFamily="mono" color="text" fontWeight="bold">HIVE</Text>
                  <Text fontSize="2xs" fontFamily="mono" color="dim" ml="auto">BLOCKCHAIN</Text>
                </HStack>
                <HStack spacing={2} py={1.5} borderBottom="1px solid" borderColor="border">
                  <Icon as={FaEthereum} boxSize="14px" color="#627EEA" />
                  <Text fontSize="xs" fontFamily="mono" color="text" fontWeight="bold">BASE</Text>
                  <Text fontSize="2xs" fontFamily="mono" color="dim" ml="auto">CHAIN 8453</Text>
                </HStack>
                <HStack spacing={2} py={1.5}>
                  <Icon as={FaEthereum} boxSize="14px" color="#627EEA" />
                  <Text fontSize="xs" fontFamily="mono" color="text" fontWeight="bold">ARBITRUM</Text>
                  <Text fontSize="2xs" fontFamily="mono" color="dim" ml="auto">CHAIN 42161</Text>
                </HStack>
              </VStack>
            </Box>

            {/* Top Winners Leaderboard */}
            {topWinners.length > 0 && (
              <Box border="1px solid" borderColor="border" bg="muted">
                <Box borderBottom="1px solid" borderColor="primary" px={4} py={2}>
                  <HStack spacing={2} align="center">
                    <Icon as={FaTrophy} boxSize="12px" color="warning" />
                    <Text
                      fontSize="sm"
                      fontWeight="bold"
                      fontFamily="mono"
                      color="text"
                      textTransform="uppercase"
                      letterSpacing="wider"
                    >
                      TOP WINNERS
                    </Text>
                  </HStack>
                </Box>
                <VStack align="stretch" spacing={0} px={4} py={2}>
                  {topWinners.map((winner, idx) => (
                    <HStack
                      key={winner.display}
                      spacing={2}
                      py={1.5}
                      borderBottom={idx < topWinners.length - 1 ? '1px solid' : 'none'}
                      borderColor="border"
                    >
                      <Text
                        fontSize="2xs"
                        fontFamily="mono"
                        fontWeight="bold"
                        color="dim"
                        w="16px"
                        textAlign="right"
                      >
                        {idx + 1}.
                      </Text>
                      {winner.avatar ? (
                        <Avatar
                          src={winner.avatar}
                          name={winner.display}
                          size="2xs"
                          borderRadius="none"
                          border="1px solid"
                          borderColor="border"
                        />
                      ) : (
                        <Box w="20px" h="20px" bg="border" border="1px solid" borderColor="border" />
                      )}
                      <Text
                        fontSize="xs"
                        fontFamily="mono"
                        fontWeight="bold"
                        color="text"
                        noOfLines={1}
                        flex={1}
                      >
                        {winner.display}
                      </Text>
                      <HStack spacing={1} align="center">
                        <Icon as={FaTrophy} boxSize="9px" color="warning" />
                        <Text fontSize="2xs" fontFamily="mono" fontWeight="bold" color="warning">
                          {winner.wins}
                        </Text>
                      </HStack>
                    </HStack>
                  ))}
                </VStack>
              </Box>
            )}
          </VStack>
        </Box>
      </Flex>

      {/* ── Create bounty modal ──────────────────── */}
      <SkateModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalStep === 'choice' ? 'choose-your-chain' : modalStep === 'eth-form' ? 'create-eth-bounty' : 'create-bounty'}
        size={modalStep === 'choice' ? 'lg' : (isMobile ? 'full' : '2xl')}
      >
        {modalStep === 'eth-form' ? (
          /* ── ETH/POIDH native bounty form ────── */
          <PoidhBountyComposer
            onSuccess={() => {
              setRefreshTrigger((prev) => prev + 1);
            }}
            onClose={handleCloseModal}
          />
        ) : modalStep === 'choice' ? (
          /* ── Chain choice: Matrix pill style ──── */
          <VStack spacing={{ base: 4, md: 6 }} py={{ base: 4, md: 6 }} px={{ base: 2, md: 4 }}>
            <Text
              fontSize="sm"
              fontFamily="mono"
              color="dim"
              textAlign="center"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              CHOOSE YOUR BLOCKCHAIN
            </Text>

            <Flex
              gap={4}
              w="100%"
              justify="center"
              align="center"
              direction={{ base: 'column', sm: 'row' }}
            >
              {/* HIVE pill */}
              <Box
                as="button"
                onClick={handleChooseHive}
                flex={{ base: 'initial', sm: 1 }}
                w={{ base: '100%', sm: 'auto' }}
                maxW={{ sm: '220px' }}
                border="2px solid"
                borderColor="#E31337"
                bg="background"
                p={{ base: 4, md: 6 }}
                cursor="pointer"
                transition="all 0.2s"
                _hover={{
                  bg: 'rgba(227, 19, 55, 0.1)',
                  boxShadow: '0 0 20px rgba(227, 19, 55, 0.3)',
                  transform: 'translateY(-2px)',
                }}
              >
                <VStack spacing={3}>
                  <Icon as={FaHive} boxSize={{ base: '32px', md: '40px' }} color="#E31337" />
                  <Text
                    fontSize={{ base: 'md', md: 'lg' }}
                    fontWeight="900"
                    fontFamily="mono"
                    color="#E31337"
                    textTransform="uppercase"
                  >
                    HIVE
                  </Text>
                  <Text fontSize="2xs" fontFamily="mono" color="dim" textAlign="center">
                    PAY IN HBD OR HIVE
                  </Text>
                </VStack>
              </Box>

              {/* Divider */}
              <Flex
                align="center"
                gap={2}
                direction={{ base: 'row', sm: 'column' }}
              >
                <Box
                  w={{ base: '20px', sm: '1px' }}
                  h={{ base: '1px', sm: '20px' }}
                  bg="border"
                />
                <Text fontSize="xs" fontFamily="mono" color="dim" fontWeight="bold">
                  OR
                </Text>
                <Box
                  w={{ base: '20px', sm: '1px' }}
                  h={{ base: '1px', sm: '20px' }}
                  bg="border"
                />
              </Flex>

              {/* ETH pill */}
              <Box
                as="button"
                onClick={handleChooseEth}
                flex={{ base: 'initial', sm: 1 }}
                w={{ base: '100%', sm: 'auto' }}
                maxW={{ sm: '220px' }}
                border="2px solid"
                borderColor="#627EEA"
                bg="background"
                p={{ base: 4, md: 6 }}
                cursor="pointer"
                transition="all 0.2s"
                _hover={{
                  bg: 'rgba(98, 126, 234, 0.1)',
                  boxShadow: '0 0 20px rgba(98, 126, 234, 0.3)',
                  transform: 'translateY(-2px)',
                }}
              >
                <VStack spacing={3}>
                  <Icon as={FaEthereum} boxSize={{ base: '32px', md: '40px' }} color="#627EEA" />
                  <Text
                    fontSize={{ base: 'md', md: 'lg' }}
                    fontWeight="900"
                    fontFamily="mono"
                    color="#627EEA"
                    textTransform="uppercase"
                  >
                    ETH
                  </Text>
                  <Text fontSize="2xs" fontFamily="mono" color="dim" textAlign="center">
                    ONCHAIN VIA POIDH
                  </Text>
                </VStack>
              </Box>
            </Flex>

            <Text fontSize="2xs" fontFamily="mono" color="dim" textAlign="center" maxW="400px">
              HIVE BOUNTIES ARE MANAGED ON-CHAIN VIA SKATEHIVE. ETH BOUNTIES ARE
              CREATED ON POIDH (BASE + ARBITRUM).
            </Text>
          </VStack>
        ) : (
          /* ── Hive bounty form ────────────────── */
          <BountyComposer
            onNewBounty={(bounty) => {
              setNewBounty(bounty);
              handleCloseModal();
              setRefreshTrigger((prev) => prev + 1);
            }}
            onClose={handleCloseModal}
          />
        )}
      </SkateModal>

      {/* ── Bottom decoration ────────────────────── */}
      <HStack justify="space-between" mt={{ base: 4, md: 8 }} px={2} display={{ base: 'none', sm: 'flex' }}>
        <HStack spacing={0.5}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Box key={i} w="6px" h="6px" bg="primary" />
          ))}
        </HStack>
        <HStack spacing={0.5}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Box key={i} w="6px" h="6px" bg="primary" />
          ))}
        </HStack>
      </HStack>
    </Container>
  );
}
