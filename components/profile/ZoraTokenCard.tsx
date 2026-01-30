"use client";
import React, { memo, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Image,
  Text,
  Badge,
  HStack,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { ZoraCoin, ZoraBalance } from "@/hooks/useZoraProfileTokens";
import { formatNumber, formatTokenName } from "@/lib/zora-utils";

interface ZoraTokenCardProps {
  coin?: ZoraCoin;
  balance?: ZoraBalance;
  variant?: "created" | "held";
}

const formatBalance = (amount: number, decimals: number = 18) => {
  if (amount === 0) return "0";
  const adjustedAmount =
    amount < 1e15 ? amount : amount / Math.pow(10, decimals);

  if (adjustedAmount >= 1e9) return `${(adjustedAmount / 1e9).toFixed(1)}B`;
  if (adjustedAmount >= 1e6) return `${(adjustedAmount / 1e6).toFixed(1)}M`;
  if (adjustedAmount >= 1e3) return `${(adjustedAmount / 1e3).toFixed(1)}K`;
  if (adjustedAmount >= 100)
    return adjustedAmount.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (adjustedAmount >= 1)
    return adjustedAmount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (adjustedAmount >= 0.001) return adjustedAmount.toFixed(3);
  if (adjustedAmount >= 0.000001) return adjustedAmount.toFixed(6);
  return adjustedAmount.toExponential(2);
};

const formatPercentageValue = (value: string | undefined) => {
  if (!value) return null;
  const num = parseFloat(value);
  const isPositive = num >= 0;
  return {
    value: num,
    isPositive,
    display: `${isPositive ? "+" : ""}${num.toFixed(1)}%`,
    color: isPositive ? "green.400" : "red.400",
  };
};

const ZoraTokenCard = memo(function ZoraTokenCard({
  coin,
  balance,
  variant = "created",
}: ZoraTokenCardProps) {
  const router = useRouter();
  const textPrimary = useColorModeValue("gray.900", "white");
  const textSecondary = useColorModeValue("gray.600", "gray.400");

  const tokenData = coin || balance?.token;

  // All hooks must be called before any early returns
  const derivedValues = useMemo(() => {
    if (!tokenData) return null;
    
    const isHeldToken = variant === "held" || Boolean(balance);
    const hoverBorderColor = isHeldToken ? "secondary.400" : "primary.400";
    const badgeColorScheme = isHeldToken ? "secondary" : "primary";

    const imageSource =
      tokenData.mediaContent?.previewImage?.medium ||
      tokenData.mediaContent?.previewImage?.small ||
      tokenData.mediaContent?.originalUri ||
      "/logos/Zorb.png";

    return {
      isHeldToken,
      hoverBorderColor,
      badgeColorScheme,
      imageSource,
    };
  }, [variant, balance, tokenData]);

  const handleCardClick = useCallback(() => {
    if (!tokenData) return;
    router.push(`/coin/${tokenData.address}`);
  }, [router, tokenData]);

  const percentageData = useMemo(
    () => tokenData ? formatPercentageValue(tokenData.marketCapDelta24h) : null,
    [tokenData]
  );

  const formatPercentage = useCallback((data: typeof percentageData) => {
    if (!data) return null;
    return (
      <Text fontSize="xs" color={data.color} fontWeight="semibold">
        {data.display}
      </Text>
    );
  }, []);

  // Early return after all hooks
  if (!tokenData || !derivedValues) return null;

  const { isHeldToken, hoverBorderColor, badgeColorScheme, imageSource } =
    derivedValues;

  return (
    <Box
      position="relative"
      cursor="pointer"
      onClick={handleCardClick}
      transition="all 0.3s ease"
      _hover={{
        transform: "translateY(-8px) scale(1.02)",
        filter: "brightness(1.1)",
      }}
    >
      {/* TCG Card Container */}
      <Box
        bg="linear-gradient(145deg, #2a2a2a 0%, #1a1a1a 100%)"
        border="3px solid"
        borderColor={hoverBorderColor}
        boxShadow="0 8px 32px rgba(0,0,0,0.3)"
        overflow="hidden"
        h="400px"
        w="280px"
        position="relative"
        background={`linear-gradient(145deg, 
          ${
            isHeldToken ? "rgba(168, 85, 247, 0.1)" : "rgba(99, 102, 241, 0.1)"
          } 0%, 
          rgba(0,0,0,0.8) 100%
        )`}
      >
        {/* Main Image Area */}
        <Box
          position="relative"
          h="220px"
          w="100%"
          overflow="hidden"
          borderBottom="2px solid rgba(255,255,255,0.2)"
        >
          <Image
            src={imageSource}
            alt={tokenData.name}
            w="100%"
            h="100%"
            objectFit="cover"
            fallbackSrc="/logos/zora.svg"
          />

          {/* Gradient overlay for better text readability */}
          <Box
            position="absolute"
            bottom="0"
            left="0"
            right="0"
            h="60px"
            background="linear-gradient(to top, rgba(0,0,0,0.9), transparent)"
          />

          {/* Token Name Overlay */}
          <Box
            position="absolute"
            bottom="8px"
            left="12px"
            right="12px"
            textAlign="center"
          >
            <Text
              fontSize="md"
              fontWeight="bold"
              color="white"
              textShadow="2px 2px 4px rgba(0,0,0,0.8)"
              noOfLines={2}
            >
              {formatTokenName(tokenData.name)}
            </Text>
          </Box>
        </Box>

        {/* Card Body - Stats Section */}
        <Box p={4} h="180px" position="relative">
          {/* Symbol Badge */}
          <Box textAlign="center" mb={3}>
            <Badge
              colorScheme={badgeColorScheme}
              size="lg"
              variant="solid"
              borderRadius="full"
              px={3}
              py={1}
            >
              {tokenData.symbol}
            </Badge>
          </Box>

          {/* Show balance for held tokens */}
          {balance && (
            <Box textAlign="center" mb={3}>
              <Text fontSize="xl" fontWeight="bold" color="secondary.400">
                {formatBalance(balance.amount.amountDecimal, 18)}
              </Text>
              <Text fontSize="xs" color={textSecondary}>
                Tokens Held
              </Text>
            </Box>
          )}

          {/* Stats Grid */}
          <VStack spacing={2} flex={1}>
            {/* Market Cap */}
            <HStack justify="space-between" w="100%">
              <Text fontSize="sm" color={textSecondary}>
                Market Cap:
              </Text>
              <Text fontSize="sm" fontWeight="bold" color="green.400">
                ${formatNumber(tokenData.marketCap)}
              </Text>
            </HStack>

            {/* Holders */}
            <HStack justify="space-between" w="100%">
              <Text fontSize="sm" color={textSecondary}>
                Holders:
              </Text>
              <Text fontSize="sm" fontWeight="bold" color={textPrimary}>
                {formatNumber(tokenData.uniqueHolders.toString())}
              </Text>
            </HStack>

            {/* Market Cap Change for created tokens */}
            {!isHeldToken && tokenData.marketCapDelta24h && (
              <HStack justify="space-between" w="100%">
                <Text fontSize="sm" color={textSecondary}>
                  24h Change:
                </Text>
                {formatPercentage(percentageData)}
              </HStack>
            )}
          </VStack>
        </Box>

        {/* Holographic Effect Border */}
        <Box
          position="absolute"
          top="2px"
          left="2px"
          right="2px"
          bottom="2px"
          borderRadius="18px"
          background="linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)"
          pointerEvents="none"
          opacity={0.6}
        />
      </Box>
    </Box>
  );
});

export default ZoraTokenCard;
