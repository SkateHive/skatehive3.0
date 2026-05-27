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
import UserbaseIdentitiesSection from "@/components/userbase/UserbaseIdentitiesSection";
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

      {/* Setup checklist — capability-first overview of what's linked +
          inline actions for what's missing (Farcaster signer authorize,
          IG handle, etc). The sections below remain available for users
          who want the full manage-everything view. */}
      <AppAccountSetupChecklist />

      <Box
        id="linked-identities-section"
        border="1px solid"
        borderColor="muted"
        p={4}
      >
        <UserbaseIdentitiesSection
          variant="settings"
          showSignOut={false}
        />
        {/* Anchor target for "Link Hive / Farcaster / EVM" buttons in
            the checklist above. The actual linker UI is rendered inside
            UserbaseIdentitiesSection. */}
        <Box id="identity-linker-section" />
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
