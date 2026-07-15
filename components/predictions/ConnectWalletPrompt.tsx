"use client";
import React from "react";
import { Box, Text } from "@chakra-ui/react";

// Shown to lite/logged-out users in place of bet/create actions. Markets stay
// fully readable; this just explains why the action is unavailable. Betting and
// market creation move real HIVE/HBD, so they need Hive ACTIVE authority — only
// available to Keychain/HiveAuth wallet users, not posting-key-only accounts.
export default function ConnectWalletPrompt({
  action = "bet",
}: {
  action?: "bet" | "create a market";
}) {
  return (
    <Box
      bg="subtle"
      border="1px solid"
      borderColor="border"
      borderRadius="md"
      p={4}
    >
      <Text color="text" fontWeight={600} mb={1}>
        Connect a Hive wallet to {action}
      </Text>
      <Text color="muted" fontSize="sm">
        Placing bets and creating markets moves real HIVE/HBD and requires your
        Hive <b>active</b> key. Sign in with Hive Keychain or HiveAuth to
        continue. Email, wallet, and Farcaster logins can browse markets but
        can&apos;t bet.
      </Text>
    </Box>
  );
}
