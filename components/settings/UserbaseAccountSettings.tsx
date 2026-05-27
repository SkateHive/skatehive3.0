"use client";

import React from "react";
import NextLink from "next/link";
import {
  Box,
  Heading,
  Link,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import AppAccountSetupChecklist from "@/components/userbase/AppAccountSetupChecklist";
import UserbaseIdentityLinker from "@/components/layout/UserbaseIdentityLinker";
import UserbasePostingKeyPanel from "@/components/userbase/UserbasePostingKeyPanel";
import UserbaseMergePanel from "@/components/userbase/UserbaseMergePanel";
import HiveSponsorshipInfo from "@/components/userbase/HiveSponsorshipInfo";

export default function UserbaseAccountSettings() {
  const t = useTranslations();
  const { user } = useUserbaseAuth();

  if (!user) {
    return (
      <Box textAlign="center" py={10}>
        <Text color="primary" mb={3}>
          {t("settings.signInToManage")}
        </Text>
        <Link as={NextLink} href="/sign-in" color="primary">
          {t("auth.signIn")}
        </Link>
      </Box>
    );
  }

  return (
    <VStack spacing={8} align="stretch">
      <Box>
        <Heading size="md" color="primary" mb={2}>
          {t("settings.appAccountTitle")}
        </Heading>
        <Text color="primary" fontSize="sm">
          {t("settings.appAccountDescription")}
        </Text>
      </Box>

      {/* Setup checklist — single source of truth for what's linked and
          how to manage each item (unlink Hive/Farcaster inline, list +
          unlink EVM wallets, edit IG handle, authorize Farcaster signer). */}
      <AppAccountSetupChecklist />

      {/* Linker for pending sessions: shows up only when the user has an
          active Hive/EVM/Farcaster session in this browser that isn't yet
          bound to their userbase account. The checklist's "Link X" actions
          scroll the user down to this anchor. */}
      <Box id="identity-linker-section">
        <UserbaseIdentityLinker />
      </Box>

      <Box border="1px solid" borderColor="muted" p={4}>
        <HiveSponsorshipInfo />
      </Box>

      <Box
        id="posting-key-panel"
        border="1px solid"
        borderColor="muted"
        p={4}
      >
        <UserbasePostingKeyPanel />
      </Box>

      <Box border="1px solid" borderColor="muted" p={4}>
        <UserbaseMergePanel />
      </Box>
    </VStack>
  );
}
