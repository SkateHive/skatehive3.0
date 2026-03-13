import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Text,
  Box,
  Badge,
  Divider,
  useColorModeValue,
} from '@chakra-ui/react';
import { formatEther } from 'viem';
import { useTranslations } from '@/lib/i18n/hooks';

interface Bid {
  bidder: string;
  amount: string;
  bidTime: string;
}

interface BidsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bids: Bid[];
  tokenName: string;
  tokenId: string;
}

const formatBidAmount = (amount: bigint) => {
  return Number(formatEther(amount)).toLocaleString(undefined, {
    maximumFractionDigits: 5,
  });
};

const formatAddress = (address: string) => {
  if (!address) return '';
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
};

const formatDate = (timestamp: string) => {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export function BidsModal({ isOpen, onClose, bids, tokenName, tokenId }: BidsModalProps) {
  const t = useTranslations('auction');
  const bgColor = useColorModeValue('secondary', 'secondary');
  const borderColor = useColorModeValue('border', 'border');

  // Sort bids by amount (highest first)
  const sortedBids = [...bids].sort((a, b) => {
    const amountA = BigInt(a.amount);
    const amountB = BigInt(b.amount);
    return amountB > amountA ? 1 : amountB < amountA ? -1 : 0;
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent bg={bgColor} border="1px solid" borderColor={borderColor}>
        <ModalHeader>
          <VStack align="start" spacing={1}>
            <Text fontSize="xl" fontWeight="bold" color="text">
              {t('allBids')}
            </Text>
            <Text fontSize="sm" color="muted">
              {tokenName} #{tokenId}
            </Text>
            <Badge bg="primary" color="background" variant="solid">
              {bids.length} {t('totalBids').toLowerCase()}
            </Badge>
          </VStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={0} align="stretch">
            {sortedBids.map((bid, index) => (
              <Box key={index}>
                <HStack 
                  justify="space-between" 
                  w="full"
                  py={4} 
                  px={0}
                  spacing={4}
                >
                  <VStack align="start" spacing={1} flex={1}>
                    <HStack spacing={2}>
                      <Text fontSize="lg" fontWeight="bold" color="primary">
                        {formatBidAmount(BigInt(bid.amount))} ETH
                      </Text>
                      {index === 0 && (
                        <Badge bg="success" color="background" size="sm">
                          {t('highest')}
                        </Badge>
                      )}
                    </HStack>
                    <Text fontSize="sm" color="muted">
                      {t('by')} {formatAddress(bid.bidder)}
                    </Text>
                  </VStack>
                  <VStack align="end" spacing={1}>
                    <Text fontSize="xs" color="muted" textAlign="right">
                      {formatDate(bid.bidTime)}
                    </Text>
                    <Text fontSize="xs" color="muted">
                      #{index + 1}
                    </Text>
                  </VStack>
                </HStack>
                {index < sortedBids.length - 1 && (
                  <Divider borderColor={borderColor} />
                )}
              </Box>
            ))}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
} 