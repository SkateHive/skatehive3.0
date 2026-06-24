"use client";

import React, { useState, useCallback } from "react";
import {
  Box,
  Button,
  Heading,
  Text,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import AppAccountSetupChecklist from "@/components/userbase/AppAccountSetupChecklist";
import UserbaseIdentityLinker from "@/components/layout/UserbaseIdentityLinker";
import UserbasePostingKeyPanel from "@/components/userbase/UserbasePostingKeyPanel";
import UserbaseMergePanel from "@/components/userbase/UserbaseMergePanel";
import UserbaseNewsletterPanel from "@/components/userbase/UserbaseNewsletterPanel";
import HiveSponsorshipInfo from "@/components/userbase/HiveSponsorshipInfo";
import HiveLoginModal from "@/components/layout/HiveLoginModal";
import ConnectionModal from "@/components/layout/ConnectionModal";
import { FarcasterAuthIsland, useFarcasterAuthMethods } from "@/components/farcaster/FarcasterAuthIsland";
import { useAioha } from "@aioha/react-ui";

export default function UserbaseAccountSettings() {
  const t = useTranslations();
  const { user } = useUserbaseAuth();
  const { aioha } = useAioha();
  const toast = useToast();
  const [modalDisplayed, setModalDisplayed] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isFarcasterAuthInProgress, setIsFarcasterAuthInProgress] = useState(false);
  const farcasterAuth = useFarcasterAuthMethods();

  const handleHiveLogin = useCallback(async () => {
    setIsConnectionModalOpen(false);
    await aioha.logout();
    setModalDisplayed(true);
  }, [aioha]);

  const handleFarcasterConnect = useCallback(() => {
    if (isFarcasterAuthInProgress) return;
    setIsFarcasterAuthInProgress(true);
    try {
      farcasterAuth.connect();
    } catch {
      setIsFarcasterAuthInProgress(false);
    }
  }, [isFarcasterAuthInProgress, farcasterAuth]);

  if (!user) {
    return (
      <>
        <Box textAlign="center" py={10}>
          <Text color="primary" mb={3}>
            {t("settings.signInToManage")}
          </Text>
          <Button colorScheme="green" onClick={() => setIsConnectionModalOpen(true)}>
            {t("auth.signIn")}
          </Button>
        </Box>
        <ConnectionModal
          isOpen={isConnectionModalOpen}
          onClose={() => setIsConnectionModalOpen(false)}
          onHiveLogin={handleHiveLogin}
          onFarcasterConnect={handleFarcasterConnect}
          isFarcasterAuthInProgress={isFarcasterAuthInProgress}
        />
        <HiveLoginModal
          isOpen={modalDisplayed}
          onClose={() => setModalDisplayed(false)}
          onSuccess={() => setIsConnectionModalOpen(false)}
        />
        <FarcasterAuthIsland
          onSuccess={({ fid, username }: any) => {
            setIsFarcasterAuthInProgress(false);
            setIsConnectionModalOpen(false);
            const displayName = username ? `@${username}` : fid ? `#${fid}` : "user";
            setTimeout(() => {
              toast({ status: "success", title: t("auth.connectedSuccess"),
                description: `${t("auth.welcome")} ${displayName}!`, duration: 3000 });
            }, 100);
          }}
          onError={(error: any) => {
            setIsFarcasterAuthInProgress(false);
            toast({ status: "error", title: t("auth.authenticationFailed"),
              description: error?.message || t("auth.farcasterAuthFailed"),
              duration: 5000 });
          }}
        />
      </>
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

      {/* Newsletter subscription — proxied to the marketing portal/Paragraph */}
      <UserbaseNewsletterPanel />

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
