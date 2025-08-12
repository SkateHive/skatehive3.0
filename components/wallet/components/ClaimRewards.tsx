"use client";

import { useState, useEffect, useCallback } from "react";
import { Box, Text, Button, HStack, VStack } from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import { Asset } from "@hiveio/dhive";
import { extractNumber } from "@/lib/utils/extractNumber";

interface ClaimRewardsProps {
  reward_hive_balance?: string | Asset | undefined; // HIVE rewards balance
  reward_hbd_balance?: string | Asset | undefined; // HBD rewards balance
  reward_vesting_balance?: string | Asset | undefined; // VESTS rewards balance
  reward_vesting_hive?: string | Asset | undefined; // HP (Hive Power) rewards balance
}

interface SkatehivePost {
  remaining_till_cashout: object;
  pending_payout_value: string;
}

export default function ClaimRewards({
  reward_hive_balance,
  reward_hbd_balance,
  reward_vesting_balance,
  reward_vesting_hive,
}: ClaimRewardsProps) {
  const { aioha, user } = useAioha();
  const [isClaiming, setIsClaiming] = useState(false);
  const [hasClaimed, setHasClaimed] = useState(false);
  const [potentialRewards, setPotentialRewards] = useState("0.000");
  const [isLoadingRewards, setIsLoadingRewards] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Process reward balances
  const pendingRewards = {
    hive: reward_hive_balance ? extractNumber(reward_hive_balance.toString()) : "0.000",
    hbd: reward_hbd_balance ? extractNumber(reward_hbd_balance.toString()) : "0.000",
    vests: reward_vesting_balance ? extractNumber(reward_vesting_balance.toString()) : "0.000",
    vests_hive: reward_vesting_hive ? extractNumber(reward_vesting_hive.toString()) : "0.000",
  };

  // Check if there are any claimable rewards > 0.0
  const hasRewards =
    parseFloat(String(pendingRewards.hive)) > 0 ||
    parseFloat(String(pendingRewards.hbd)) > 0 ||
    parseFloat(String(pendingRewards.vests_hive)) > 0;

  // Reset hasClaimed when rewards change
  useEffect(() => {
    if (hasRewards) {
      setHasClaimed(false); // Show claim box if rewards > 0.5
    }
  }, [pendingRewards.hive, pendingRewards.hbd, pendingRewards.vests_hive]);

  // Fetch potential rewards from Skatehive API
  useEffect(() => {
    if (!user) return;

    const fetchPotentialRewards = async () => {
      setIsLoadingRewards(true);
      setFetchError(null);
      try {
        const response = await fetch(`https://api.skatehive.app/api/v2/feed/${user}`);
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          const pendingPosts = data.data.filter(
            (post: SkatehivePost) => Object.keys(post.remaining_till_cashout).length > 0
          );
          const totalPendingHBD = pendingPosts.reduce(
            (sum: number, post: SkatehivePost) =>
              sum + parseFloat(post.pending_payout_value || "0"),
            0
          );
          setPotentialRewards(totalPendingHBD.toFixed(3));
        } else {
          setFetchError("Failed to fetch rewards data.");
        }
      } catch (error) {
        console.error("Error fetching potential rewards:", error);
        setFetchError("Error fetching potential rewards.");
      } finally {
        setIsLoadingRewards(false);
      }
    };

    fetchPotentialRewards();
  }, [user]);

  // Claim rewards
  const handleClaimRewards = useCallback(async () => {
    if (!aioha || !user) {
      setHasClaimed(true); // Hide claim box if not logged in
      return;
    }

    setIsClaiming(true);
    try {
      const result = await aioha.claimRewards();
      setHasClaimed(true); // Hide claim box on success or failure
    } catch (error) {
      console.error("Error claiming rewards:", error);
      setHasClaimed(true); // Hide claim box even on error
    } finally {
      setIsClaiming(false);
    }
  }, [aioha, user]);

  return (
    <>
      {(hasRewards && !hasClaimed) ? (
        <Box
          p={4}
          mt={2}
          mb={4}
          bg="background"
          borderRadius="md"
          border="1px solid"
          borderColor="gray.200"
        >
          <Text fontWeight="bold" color="primary" mb={2}>
            Pending Rewards
          </Text>
          <HStack justifyContent="space-between" alignItems="center">
            <VStack align="start">
              <Text>You have some pending rewards to claim:</Text>
              {parseFloat(String(pendingRewards.hive)) > 0 && (
                <Text>{pendingRewards.hive} HIVE</Text>
              )}
              {parseFloat(String(pendingRewards.hbd)) > 0 && (
                <Text>{pendingRewards.hbd} HBD</Text>
              )}
              {parseFloat(String(pendingRewards.vests_hive)) > 0 && (
                <Text>{pendingRewards.vests_hive} HP</Text>
              )}
            </VStack>
            <Button
              leftIcon={<span>🏅</span>}
              colorScheme="blue"
              onClick={handleClaimRewards}
              isLoading={isClaiming}
              isDisabled={!hasRewards || !user} // Disable if no rewards or not logged in
            >
              Claim
            </Button>
          </HStack>
        </Box>
      ) : (
        <Box>
          {isLoadingRewards ? (
            <Text>Loading potential rewards...</Text>
          ) : fetchError ? (
            <Text color="red.500">Error: {fetchError}</Text>
          ) : (
            <>
              <Text></Text>
              <Text fontSize="sm" color="gray.500">
                Snaps Potential Rewards Estimated for the next 7 days: {potentialRewards} HBD
              </Text>
            </>
          )}
        </Box>
      )}
    </>
  );
}
