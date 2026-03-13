"use client";

import {
  Box,
  VStack,
  HStack,
  Text,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import {
  ArrowBackIcon,
  ArrowForwardIcon,
} from "@chakra-ui/icons";
import { useTranslations } from '@/lib/i18n/hooks';

interface AuctionHeaderProps {
  tokenName: string;
  tokenId: string;
  startTime: string;
  showNavigation?: boolean;
  currentTokenId?: number;
  isLatestAuction?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}

export function AuctionHeader({
  tokenName,
  tokenId,
  startTime,
  showNavigation = false,
  currentTokenId,
  isLatestAuction = false,
  onPrev,
  onNext,
}: AuctionHeaderProps) {
  const t = useTranslations('ariaLabels');
  return (
    <VStack spacing={1}>
      {/* NFT Title with Navigation Arrows */}
      <HStack spacing={4} justify="center" w="full" align="center">
        {showNavigation && currentTokenId && (
          <IconButton
            aria-label={t('previousAuction')}
            icon={<ArrowBackIcon />}
            onClick={onPrev}
            isDisabled={!currentTokenId || currentTokenId <= 1}
            size="lg"
            variant="ghost"
            colorScheme="red"
            color="primary"
            bg="background"
            borderRadius="full"
            _hover={{
              bg: "primary",
              color: "background",
              transform: "scale(1.1)",
            }}
            _active={{ transform: "scale(0.95)" }}
            transition="all 0.2s ease"
          />
        )}

        <Text
          fontSize="2xl"
          fontWeight="bold"
          color="text"
          textAlign="center"
          pt={2}
          mb={0}
        >
          {tokenName.includes(`#${tokenId}`)
            ? tokenName
            : `${tokenName} #${tokenId}`}
        </Text>

        {showNavigation && currentTokenId && (
          <IconButton
            aria-label={t('nextAuction')}
            icon={<ArrowForwardIcon />}
            onClick={onNext}
            isDisabled={!!(!currentTokenId || !currentTokenId || isLatestAuction)}
            size="lg"
            variant="ghost"
            colorScheme="red"
            color="primary"
            bg="background"
            borderRadius="full"
            _hover={{
              bg: "primary",
              color: "background",
              transform: "scale(1.1)",
            }}
            _active={{ transform: "scale(0.95)" }}
            transition="all 0.2s ease"
          />
        )}
      </HStack>
      
      {/* Date */}
      <Text
        fontSize="xs"
        color="primary"
        textAlign="center"
        mt={0}
        mb={0}
      >
        {new Date(parseInt(startTime) * 1000).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
      </Text>
    </VStack>
  );
} 