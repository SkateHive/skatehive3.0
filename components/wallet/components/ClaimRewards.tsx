"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Box, Text, Button, HStack, VStack, Image } from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { Asset } from "@hiveio/dhive";
import { extractNumber } from "@/lib/utils/extractNumber";
import { useTranslations } from "@/contexts/LocaleContext";
import { FaGift } from "react-icons/fa";
import { shimmerStyles, pulseKeyframe } from "@/lib/utils/animations";

interface ClaimRewardsProps {
  reward_hive_balance?: string | Asset;
  reward_hbd_balance?: string | Asset;
  reward_vesting_balance?: string | Asset;
  reward_vesting_hive?: string | Asset;
}

interface SkatehivePost {
  remaining_till_cashout: Record<string, unknown>;
  pending_payout_value: string;
}

export default function ClaimRewards({
  reward_hive_balance,
  reward_hbd_balance,
  reward_vesting_balance,
  reward_vesting_hive,
}: ClaimRewardsProps) {
  const t = useTranslations();
  const { aioha, user } = useAioha();
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [potentialRewards, setPotentialRewards] = useState("0.000");
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);

  const pendingRewards = useMemo(() => ({
    hive: reward_hive_balance
      ? extractNumber(reward_hive_balance.toString())
      : "0.000",
    hbd: reward_hbd_balance
      ? extractNumber(reward_hbd_balance.toString())
      : "0.000",
    vests_hive: reward_vesting_hive
      ? extractNumber(reward_vesting_hive.toString())
      : "0.000",
  }), [reward_hive_balance, reward_hbd_balance, reward_vesting_hive]);

  const hasRewards =
    parseFloat(String(pendingRewards.hive)) > 0.5 ||
    parseFloat(String(pendingRewards.hbd)) > 0.5 ||
    parseFloat(String(pendingRewards.vests_hive)) > 0.5;

  useEffect(() => {
    if (hasRewards) setHasClaimed(false);
  }, [hasRewards]);

  useEffect(() => {
    if (!user) return;
    setIsLoadingRewards(true);
    fetch(`https://api.skatehive.app/api/v2/feed/${user}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          const total = data.data
            .filter(
              (p: SkatehivePost) =>
                Object.keys(p.remaining_till_cashout).length > 0,
            )
            .reduce(
              (s: number, p: SkatehivePost) =>
                s + parseFloat(p.pending_payout_value || "0"),
              0,
            );
          setPotentialRewards(total.toFixed(3));
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingRewards(false));
  }, [user]);

  const handleClaimRewards = useCallback(async () => {
    if (!aioha || !user) return;
    setIsClaiming(true);
    try {
      await aioha.claimRewards();
      setHasClaimed(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsClaiming(false);
    }
  }, [aioha, user]);

  if (!hasRewards || hasClaimed) {
    // Compact "potential rewards" state shown when nothing to claim
    const hasPotential = parseFloat(potentialRewards) > 0;
    if (!hasPotential && !isLoadingRewards) return null;
    return (
      <Box
        border="1px solid"
        borderColor="border"
        p={3}
        fontSize="sm"
        color="dim"
        fontFamily="mono"
      >
        {isLoadingRewards ? (
          <Text animation={`${pulseKeyframe} 1.5s ease-in-out infinite`}>
            Calculating snaps rewards...
          </Text>
        ) : (
          <Text>
            Snaps potential:{" "}
            <Text as="span" color="primary" fontWeight="bold">
              {potentialRewards} HBD
            </Text>{" "}
            in next 7 days
          </Text>
        )}
      </Box>
    );
  }

  // ── EXCITING claim state ──
  const rewardLines: { amount: string; symbol: string; logo: string }[] = [
    parseFloat(String(pendingRewards.hive)) > 0 && {
      amount: pendingRewards.hive,
      symbol: "HIVE",
      logo: "/logos/hiveLogo.png",
    },
    parseFloat(String(pendingRewards.hbd)) > 0 && {
      amount: pendingRewards.hbd,
      symbol: "HBD",
      logo: "/logos/hbd_logo.png",
    },
    parseFloat(String(pendingRewards.vests_hive)) > 0 && {
      amount: pendingRewards.vests_hive,
      symbol: "HP",
      logo: "/logos/hiveLogo.png",
    },
  ].filter(Boolean) as { amount: string; symbol: string; logo: string }[];

  return (
    <Box
      position="relative"
      border="2px solid"
      borderColor="primary"
      overflow="hidden"
      sx={shimmerStyles}
    >
      {/* Header bar */}
      <HStack px={3} py={2} bg="primary" justify="space-between">
        <HStack spacing={2}>
          <FaGift color="var(--chakra-colors-background)" />
          <Text
            fontWeight="black"
            fontSize="sm"
            color="background"
            textTransform="uppercase"
            letterSpacing="widest"
            fontFamily="mono"
          >
            Rewards Ready
          </Text>
        </HStack>
        <Text
          fontSize="xs"
          color="background"
          fontFamily="mono"
          animation={`${pulseKeyframe} 1.5s ease-in-out infinite`}
        >
          ● CLAIMABLE
        </Text>
      </HStack>

      {/* Body */}
      <Box px={3} py={3}>
        <VStack spacing={2} align="start" mb={3}>
          {rewardLines.map(({ amount, symbol, logo }) => (
            <HStack key={symbol} spacing={3} align="center">
              <Image
                src={logo}
                w="28px"
                h="28px"
                objectFit="contain"
                alt={`${symbol} logo`}
              />
              <Text
                color="primary"
                fontWeight="black"
                fontSize="xl"
                fontFamily="mono"
              >
                {amount}
              </Text>
              <Text
                color="dim"
                fontSize="sm"
                fontFamily="mono"
                fontWeight="bold"
              >
                {symbol}
              </Text>
            </HStack>
          ))}
        </VStack>

        <Button
          w="100%"
          colorScheme="green"
          borderRadius="none"
          fontWeight="black"
          letterSpacing="widest"
          fontFamily="mono"
          leftIcon={<FaGift />}
          isLoading={isClaiming}
          loadingText="CLAIMING..."
          onClick={handleClaimRewards}
          size="md"
          sx={{
            textTransform: "uppercase",
          }}
        >
          Claim Now
        </Button>
      </Box>
    </Box>
  );
}
