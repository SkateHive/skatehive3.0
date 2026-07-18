"use client";
import React from "react";
import { Box, Text } from "@chakra-ui/react";
import { useTranslations } from "@/lib/i18n/hooks";

// Shown to lite/logged-out users in place of bet/create actions. Markets stay
// fully readable; this just explains why the action is unavailable. Betting and
// market creation move real HIVE/HBD, so they need Hive ACTIVE authority — only
// available to Keychain/HiveAuth wallet users, not posting-key-only accounts.
export default function ConnectWalletPrompt({
  action = "bet",
}: {
  action?: "bet" | "create a market";
}) {
  const t = useTranslations("predictions");
  const actionLabel = action === "bet" ? t("actionBet") : t("actionCreate");
  return (
    <Box
      bg="subtle"
      border="1px solid"
      borderColor="border"
      borderRadius="md"
      p={4}
    >
      <Text color="text" fontWeight={600} mb={1}>
        {t("connectTo")} {actionLabel}
      </Text>
      <Text color="dim" fontSize="sm">
        {t("connectBody")}
      </Text>
    </Box>
  );
}
