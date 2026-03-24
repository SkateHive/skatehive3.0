"use client";

import { Box, Text, HStack, VStack, Image, Badge } from "@chakra-ui/react";
import { ConsolidatedToken, getEnhancedTokenData, getCorrectedTotalUSD } from "../../../lib/utils/portfolioUtils";
import { blockchainDictionary, TokenDetail } from "../../../types/portfolio";
import { formatBalance, formatValue } from "../../../lib/utils/portfolioUtils";
import { useWalletSource } from "../utils/walletSource";

interface TokenChainBreakdownProps {
  consolidatedToken: ConsolidatedToken;
}

interface ChainTokenItemProps {
  chainToken: TokenDetail;
  totalBalanceUSD: number;
}

function ChainTokenItem({ chainToken, totalBalanceUSD }: ChainTokenItemProps) {
  const networkInfo = blockchainDictionary[chainToken.network];
  const walletSource = useWalletSource(chainToken);
  const { correctedBalanceUSD } = getEnhancedTokenData(chainToken);
  const displayBalanceUSD = correctedBalanceUSD ?? chainToken.token.balanceUSD;
  const percentage = totalBalanceUSD > 0 ? (displayBalanceUSD / totalBalanceUSD) * 100 : 0;

  return (
    <Box>
      <HStack justify="space-between" align="center" mb={2}>
        <HStack spacing={2}>
          {networkInfo?.logo && (
            <Image
              src={networkInfo.logo}
              alt={networkInfo?.alias || chainToken.network}
              w="20px"
              h="20px"
              borderRadius="full"
              objectFit="cover"
              flexShrink={0}
            />
          )}
          <VStack spacing={0} align="start">
            <Text fontSize="sm" fontWeight="medium" color="text">
              {walletSource.networkLabel}
            </Text>
            <Text fontSize="xs" color="dim">
              {walletSource.walletLabel}
            </Text>
          </VStack>
          <Badge
            colorScheme={
              walletSource.type === "ethereum"
                ? "blue"
                : walletSource.type === "farcaster"
                ? "purple"
                : "gray"
            }
            fontSize="xs"
          >
            {percentage.toFixed(1)}%
          </Badge>
        </HStack>

        <VStack spacing={0} align="end">
          <Text fontSize="sm" color="text">
            {formatBalance(chainToken.token.balance)} {chainToken.token.symbol}
          </Text>
          <Text fontSize="xs" color="dim">
            {formatValue(displayBalanceUSD)}
          </Text>
        </VStack>
      </HStack>

      {/* Progress bar */}
      <Box w="100%" bg="muted" h="4px" borderRadius="full">
        <Box
          w={`${percentage}%`}
          bg={
            walletSource.type === "ethereum"
              ? "blue.400"
              : walletSource.type === "farcaster"
              ? "purple.400"
              : "dim"
          }
          h="100%"
          borderRadius="full"
        />
      </Box>

      <Text fontSize="xs" color="dim" mt={1}>
        {chainToken.token.address.slice(0, 6)}...
        {chainToken.token.address.slice(-4)}
      </Text>
    </Box>
  );
}

export default function TokenChainBreakdown({
  consolidatedToken,
}: TokenChainBreakdownProps) {
  return (
    <Box
      p={4}
      bg="background"
      borderRadius="md"
      border="1px solid"
      borderColor="border"
      mt={2}
    >
      <VStack spacing={3} align="stretch">
        {consolidatedToken.chains.map((chainToken, index) => (
          <ChainTokenItem
            key={`${chainToken.network}-${index}`}
            chainToken={chainToken}
            totalBalanceUSD={getCorrectedTotalUSD(consolidatedToken)}
          />
        ))}
      </VStack>
    </Box>
  );
}
