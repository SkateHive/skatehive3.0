"use client";

import { useCallback } from "react";
import {
  HStack,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
  useToast,
} from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import { useAioha } from "@aioha/react-ui";
import SkateModal from "@/components/shared/SkateModal";
import { useTranslations } from "@/contexts/LocaleContext";
import useTipRecipient from "@/hooks/useTipRecipient";
import BaseTipTab from "./BaseTipTab";
import HiveTipTab from "./HiveTipTab";
import useTipComment from "./useTipComment";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussion: Discussion;
}

export default function TipModal({
  isOpen,
  onClose,
  discussion,
}: TipModalProps) {
  const t = useTranslations("tip");
  const toast = useToast();
  const announceTip = useTipComment();
  const { user: aiohaUser } = useAioha();
  const recipient = useTipRecipient(discussion, { enabled: isOpen });

  // A HIVE/HBD transfer needs ACTIVE authority. Stored userbase keys are
  // POSTING only, so this rail exists for Keychain sessions and nobody else.
  const canTipHive = !!aiohaUser && !!recipient.hiveAccount;
  const canTipBase = !!recipient.evmAddress;

  const handleSettled = useCallback(
    async (amount: string, token: string) => {
      // The money has already moved. Confirm that first, then try the comment
      // separately so a failed reply never reads as a failed tip.
      toast({
        title: t("successTitle"),
        description: `${amount} ${token}`,
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      onClose();
      await announceTip({ discussion, amount, token });
    },
    [toast, t, onClose, announceTip, discussion]
  );

  const hasAnyRail = canTipHive || canTipBase;

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t("title")} ${recipient.displayName}`}
      size="md"
    >
      {recipient.isLoading ? (
        <HStack spacing={3} py={6}>
          <Spinner size="sm" color="primary" />
          <Text fontSize="sm" color="dim">
            {t("resolving")}
          </Text>
        </HStack>
      ) : !hasAnyRail ? (
        <VStack spacing={2} align="start" py={4}>
          <Text fontWeight="bold" color="text">
            {t("noRailsTitle")}
          </Text>
          <Text fontSize="sm" color="dim">
            {t("noRailsBody")}
          </Text>
        </VStack>
      ) : (
        <Tabs variant="enclosed" colorScheme="green" isFitted>
          <TabList>
            {canTipHive && <Tab>{t("tabHive")}</Tab>}
            {canTipBase && <Tab>{t("tabBase")}</Tab>}
          </TabList>
          <TabPanels>
            {canTipHive && (
              <TabPanel px={0}>
                <HiveTipTab
                  recipient={recipient.hiveAccount!}
                  onSettled={handleSettled}
                />
              </TabPanel>
            )}
            {canTipBase && (
              <TabPanel px={0}>
                <BaseTipTab
                  recipient={recipient.evmAddress!}
                  onSettled={handleSettled}
                />
              </TabPanel>
            )}
          </TabPanels>
        </Tabs>
      )}
    </SkateModal>
  );
}
