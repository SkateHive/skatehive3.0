'use client';

import { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Icon,
  Textarea,
  Input,
} from '@chakra-ui/react';
import { FaEthereum } from 'react-icons/fa';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { usePoidhWrite } from '@/hooks/usePoidhWrite';
import { CHAIN_LABEL } from '@/lib/poidh-constants';

interface PoidhBountyComposerProps {
  onSuccess?: () => void;
  onClose?: () => void;
}

type BountyType = 'solo' | 'open';

const SUPPORTED_CHAINS = [
  { id: 8453, label: 'BASE', color: '#627EEA' },
  { id: 42161, label: 'ARBITRUM', color: '#28A0F0' },
];

export default function PoidhBountyComposer({ onSuccess, onClose }: PoidhBountyComposerProps) {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const poidh = usePoidhWrite();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [chainId, setChainId] = useState(8453);
  const [bountyType, setBountyType] = useState<BountyType>('solo');

  const isValid = title.trim().length > 0 && parseFloat(amount) >= 0.001;
  const isBusy = poidh.status === 'switching-chain' || poidh.status === 'pending-approval' || poidh.status === 'pending-tx';

  const handleSubmit = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (!isValid) return;

    try {
      // Auto-tag skatehive bounties
      const taggedDescription = `[skatehive] ${description}`;

      if (bountyType === 'solo') {
        await poidh.createSoloBounty(chainId, title, taggedDescription, amount);
      } else {
        await poidh.createOpenBounty(chainId, title, taggedDescription, amount);
      }
      onSuccess?.();
    } catch {
      // error is handled by the hook
    }
  };

  const statusLabel = (() => {
    switch (poidh.status) {
      case 'switching-chain': return `SWITCHING TO ${CHAIN_LABEL[chainId]?.toUpperCase()}...`;
      case 'pending-approval': return 'CONFIRM IN WALLET...';
      case 'pending-tx': return 'WAITING FOR CONFIRMATION...';
      case 'confirmed': return 'BOUNTY CREATED!';
      case 'error': return poidh.error || 'TRANSACTION FAILED';
      default: return null;
    }
  })();

  if (poidh.status === 'confirmed') {
    return (
      <VStack spacing={4} py={6} px={4}>
        <Box border="1px solid" borderColor="success" px={6} py={4} w="100%">
          <VStack spacing={2}>
            <Text fontSize="lg" fontWeight="900" fontFamily="mono" color="success">
              BOUNTY CREATED!
            </Text>
            <Text fontSize="xs" fontFamily="mono" color="dim" textAlign="center">
              YOUR BOUNTY IS NOW LIVE ON {CHAIN_LABEL[chainId]?.toUpperCase()}.
              IT WILL APPEAR IN THE FEED SHORTLY.
            </Text>
          </VStack>
        </Box>
        <Button
          onClick={onClose}
          bg="primary"
          color="background"
          borderRadius="none"
          fontFamily="mono"
          fontWeight="bold"
          fontSize="xs"
          textTransform="uppercase"
          letterSpacing="wider"
          w="100%"
          _hover={{ bg: 'accent' }}
        >
          CLOSE
        </Button>
      </VStack>
    );
  }

  return (
    <VStack spacing={4} py={4} px={2} align="stretch">
      {/* Chain selector */}
      <Box>
        <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mb={2} textTransform="uppercase">
          CHAIN
        </Text>
        <HStack spacing={2}>
          {SUPPORTED_CHAINS.map((c) => (
            <Box
              key={c.id}
              as="button"
              flex={1}
              border="2px solid"
              borderColor={chainId === c.id ? c.color : 'border'}
              bg={chainId === c.id ? `${c.color}15` : 'transparent'}
              px={3}
              py={2}
              cursor="pointer"
              onClick={() => setChainId(c.id)}
              transition="all 0.15s"
            >
              <HStack spacing={2} justify="center">
                <Icon as={FaEthereum} boxSize="14px" color={c.color} />
                <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color={chainId === c.id ? 'text' : 'dim'}>
                  {c.label}
                </Text>
              </HStack>
            </Box>
          ))}
        </HStack>
      </Box>

      {/* Bounty type */}
      <Box>
        <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mb={2} textTransform="uppercase">
          TYPE
        </Text>
        <HStack spacing={2}>
          <Box
            as="button"
            flex={1}
            border="1px solid"
            borderColor={bountyType === 'solo' ? 'primary' : 'border'}
            bg={bountyType === 'solo' ? 'rgba(167, 255, 0, 0.05)' : 'transparent'}
            px={3}
            py={2}
            cursor="pointer"
            onClick={() => setBountyType('solo')}
          >
            <VStack spacing={0.5}>
              <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color={bountyType === 'solo' ? 'primary' : 'dim'}>
                SOLO
              </Text>
              <Text fontSize="2xs" fontFamily="mono" color="dim">
                YOU PICK THE WINNER
              </Text>
            </VStack>
          </Box>
          <Box
            as="button"
            flex={1}
            border="1px solid"
            borderColor={bountyType === 'open' ? 'primary' : 'border'}
            bg={bountyType === 'open' ? 'rgba(167, 255, 0, 0.05)' : 'transparent'}
            px={3}
            py={2}
            cursor="pointer"
            onClick={() => setBountyType('open')}
          >
            <VStack spacing={0.5}>
              <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color={bountyType === 'open' ? 'primary' : 'dim'}>
                OPEN
              </Text>
              <Text fontSize="2xs" fontFamily="mono" color="dim">
                COMMUNITY VOTES
              </Text>
            </VStack>
          </Box>
        </HStack>
      </Box>

      {/* Title */}
      <Box>
        <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mb={2} textTransform="uppercase">
          BOUNTY TITLE
        </Text>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Best Kickflip Down 5 Stairs"
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
      </Box>

      {/* Description */}
      <Box>
        <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mb={2} textTransform="uppercase">
          DESCRIPTION
        </Text>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you want to see..."
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
          resize="vertical"
        />
      </Box>

      {/* Amount */}
      <Box>
        <Text fontSize="2xs" fontFamily="mono" color="dim" fontWeight="bold" mb={2} textTransform="uppercase">
          REWARD (ETH)
        </Text>
        <HStack spacing={2}>
          <Input
            type="number"
            step="0.001"
            min="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
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
          <Box border="1px solid" borderColor="primary" px={3} py={2}>
            <HStack spacing={1}>
              <Icon as={FaEthereum} boxSize="12px" color="#627EEA" />
              <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="primary">ETH</Text>
            </HStack>
          </Box>
        </HStack>
        {amount && parseFloat(amount) < 0.001 && (
          <Text fontSize="2xs" fontFamily="mono" color="error" mt={1}>
            MIN: 0.001 ETH
          </Text>
        )}
      </Box>

      {/* Status message */}
      {statusLabel && (
        <Box
          border="1px solid"
          borderColor={poidh.status === 'error' ? 'error' : 'primary'}
          px={3}
          py={2}
        >
          <Text
            fontSize="xs"
            fontFamily="mono"
            fontWeight="bold"
            color={poidh.status === 'error' ? 'error' : 'primary'}
            textAlign="center"
          >
            {statusLabel}
          </Text>
        </Box>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        isLoading={isBusy}
        loadingText={statusLabel || 'PROCESSING...'}
        isDisabled={isConnected && !isValid}
        bg="primary"
        color="background"
        borderRadius="none"
        fontFamily="mono"
        fontWeight="bold"
        fontSize="sm"
        textTransform="uppercase"
        letterSpacing="wider"
        w="100%"
        _hover={{ bg: 'accent' }}
        _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
      >
        {!isConnected ? 'CONNECT WALLET' : `CREATE ${bountyType.toUpperCase()} BOUNTY`}
      </Button>

      {/* Info */}
      <Text fontSize="2xs" fontFamily="mono" color="dim" textAlign="center">
        2.5% PROTOCOL FEE ON PAYOUT. BOUNTY IS CREATED ON-CHAIN VIA POIDH.
      </Text>
    </VStack>
  );
}
