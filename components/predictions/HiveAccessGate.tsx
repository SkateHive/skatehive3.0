"use client";
import React from "react";
import { Box, Flex, Heading, Spinner, Text } from "@chakra-ui/react";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";

// Prediction markets are Hive-only: bets and market creation are on-chain
// operations, so the whole section is gated to logged-in users with a Hive
// account (wallet-connected or linked identity). Everyone else gets an
// explainer instead of the content.
export default function HiveAccessGate({ children }: { children: React.ReactNode }) {
  const { handle, isLoading } = useEffectiveHiveUser();

  if (isLoading) {
    return (
      <Flex justify="center" py={20}>
        <Spinner color="primary" size="lg" />
      </Flex>
    );
  }

  if (!handle) {
    return (
      <Box maxW="560px" mx="auto" px={4} py={16}>
        <Box bg="panel" border="1px solid" borderColor="border" borderRadius="lg" p={6}>
          <Heading size="md" color="text" mb={2}>
            Prediction markets are for Hive users
          </Heading>
          <Text color="dim">
            Markets, bets, and payouts all live on the Hive blockchain. Log in
            with your Hive account (Keychain or HiveAuth), or link a Hive
            identity to your Skatehive profile, to browse and bet on prediction
            markets.
          </Text>
        </Box>
      </Box>
    );
  }

  return <>{children}</>;
}
