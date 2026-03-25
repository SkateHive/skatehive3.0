"use client";

import {
  Box,
  Text,
  VStack,
  HStack,
  Image,
  Spinner,
  Badge,
  Divider,
  SimpleGrid,
} from "@chakra-ui/react";
import { ZoraHeldCoin, ZoraCreatedCoin } from "@/hooks/useZoraWalletData";

interface ZoraCoinsSectionProps {
  heldCoins: ZoraHeldCoin[];
  createdCoins: ZoraCreatedCoin[];
  isLoading: boolean;
}

function formatUSD(value: string | null): string {
  if (!value) return "—";
  const n = parseFloat(value);
  if (isNaN(n)) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function formatBalance(balance: string): string {
  const n = parseFloat(balance);
  if (isNaN(n)) return balance;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n < 0.0001) return n.toExponential(2);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function Change24h({ value }: { value: number | null }) {
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <Text
      fontSize="xs"
      fontFamily="mono"
      color={positive ? "success" : "error"}
      fontWeight="500"
    >
      {positive ? "+" : ""}
      {value.toFixed(2)}%
    </Text>
  );
}

function CoinLogo({ logo, symbol, size = "40px" }: { logo: string | null; symbol: string; size?: string }) {
  if (logo) {
    return (
      <Image
        src={logo}
        alt={symbol}
        w={size}
        h={size}
        borderRadius="full"
        objectFit="cover"
        flexShrink={0}
        fallback={<CoinLogoFallback symbol={symbol} size={size} />}
      />
    );
  }
  return <CoinLogoFallback symbol={symbol} size={size} />;
}

function CoinLogoFallback({ symbol, size }: { symbol: string; size: string }) {
  return (
    <Box
      w={size}
      h={size}
      borderRadius="full"
      bg="panel"
      border="1px solid"
      borderColor="border"
      display="flex"
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
    >
      <Text fontSize="sm" fontWeight="bold" color="text">
        {symbol.charAt(0).toUpperCase()}
      </Text>
    </Box>
  );
}

function HeldCoinRow({ coin }: { coin: ZoraHeldCoin }) {
  return (
    <HStack
      justify="space-between"
      py={3}
      px={4}
      borderBottom="1px solid"
      borderColor="border"
      _hover={{ bg: "subtle" }}
      transition="background 0.15s"
    >
      <HStack spacing={3} flex={1}>
        <CoinLogo logo={coin.logo} symbol={coin.symbol} />
        <VStack spacing={0} align="start">
          <Text fontWeight="600" fontSize="sm" color="text" fontFamily="mono">
            {coin.symbol}
          </Text>
          {coin.name !== coin.symbol && (
            <Text fontSize="xs" color="dim" noOfLines={1} maxW="160px">
              {coin.name}
            </Text>
          )}
          <Text fontSize="xs" color="dim" fontFamily="mono">
            {formatBalance(coin.balance)}
          </Text>
        </VStack>
      </HStack>

      <VStack spacing={0} align="end">
        <Text fontSize="sm" fontWeight="600" color="text" fontFamily="mono">
          {formatUSD(coin.valueUsd)}
        </Text>
        <Change24h value={coin.change24h} />
        {coin.marketCap && (
          <Text fontSize="xs" color="dim" fontFamily="mono">
            MC {formatUSD(coin.marketCap)}
          </Text>
        )}
      </VStack>
    </HStack>
  );
}

function CreatedCoinCard({ coin }: { coin: ZoraCreatedCoin }) {
  return (
    <Box
      border="1px solid"
      borderColor="border"
      p={4}
      _hover={{ borderColor: "primary", bg: "subtle" }}
      transition="all 0.15s"
    >
      <HStack spacing={3} mb={3}>
        <CoinLogo logo={coin.logo} symbol={coin.symbol} size="36px" />
        <VStack spacing={0} align="start" flex={1}>
          <Text fontWeight="700" fontSize="sm" color="primary" fontFamily="mono">
            {coin.symbol}
          </Text>
          <Text fontSize="xs" color="dim" noOfLines={1}>
            {coin.name}
          </Text>
        </VStack>
        <Change24h value={coin.change24h} />
      </HStack>

      <SimpleGrid columns={2} spacing={2}>
        <Box>
          <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase">
            Market Cap
          </Text>
          <Text fontSize="sm" color="text" fontFamily="mono" fontWeight="600">
            {formatUSD(coin.marketCap)}
          </Text>
        </Box>
        <Box>
          <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase">
            Holders
          </Text>
          <Text fontSize="sm" color="text" fontFamily="mono" fontWeight="600">
            {coin.uniqueHolders.toLocaleString()}
          </Text>
        </Box>
        {coin.volume24h && parseFloat(coin.volume24h) > 0 && (
          <Box>
            <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase">
              Vol 24h
            </Text>
            <Text fontSize="sm" color="text" fontFamily="mono" fontWeight="600">
              {formatUSD(coin.volume24h)}
            </Text>
          </Box>
        )}
      </SimpleGrid>
    </Box>
  );
}

export default function ZoraCoinsSection({
  heldCoins,
  createdCoins,
  isLoading,
}: ZoraCoinsSectionProps) {
  if (isLoading) {
    return (
      <Box py={12} textAlign="center">
        <Spinner size="md" color="primary" />
        <Text mt={3} fontSize="sm" color="dim" fontFamily="mono">
          Loading Zora data...
        </Text>
      </Box>
    );
  }

  const hasData = heldCoins.length > 0 || createdCoins.length > 0;

  if (!hasData) {
    return (
      <Box py={12} textAlign="center">
        <Text fontSize="sm" color="dim" fontFamily="mono">
          No Zora coins found for linked addresses.
        </Text>
      </Box>
    );
  }

  return (
    <VStack spacing={0} align="stretch">
      {/* Held Coins */}
      {heldCoins.length > 0 && (
        <Box>
          <HStack
            px={4}
            py={2}
            bg="muted"
            borderBottom="1px solid"
            borderColor="border"
          >
            <Text
              fontSize="xs"
              fontFamily="mono"
              fontWeight="black"
              textTransform="uppercase"
              letterSpacing="widest"
              color="dim"
            >
              Holdings
            </Text>
            <Badge colorScheme="purple" fontSize="xs">
              {heldCoins.length}
            </Badge>
          </HStack>
          {heldCoins.map((coin) => (
            <HeldCoinRow key={coin.address} coin={coin} />
          ))}
        </Box>
      )}

      {/* Created Coins */}
      {createdCoins.length > 0 && (
        <Box>
          {heldCoins.length > 0 && <Divider borderColor="border" my={2} />}
          <HStack
            px={4}
            py={2}
            bg="muted"
            borderBottom="1px solid"
            borderColor="border"
          >
            <Text
              fontSize="xs"
              fontFamily="mono"
              fontWeight="black"
              textTransform="uppercase"
              letterSpacing="widest"
              color="dim"
            >
              Created
            </Text>
            <Badge colorScheme="orange" fontSize="xs">
              {createdCoins.length}
            </Badge>
          </HStack>
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={0}>
            {createdCoins.map((coin) => (
              <CreatedCoinCard key={coin.address} coin={coin} />
            ))}
          </SimpleGrid>
        </Box>
      )}
    </VStack>
  );
}
