"use client";

import { useCallback, useState } from "react";
import {
  Box,
  Flex,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
} from "@chakra-ui/react";
import { Discussion } from "@hiveio/dhive";
import { useAioha } from "@aioha/react-ui";
import SkateModal from "@/components/shared/SkateModal";
import { useTranslations } from "@/contexts/LocaleContext";
import useTipRecipient from "@/hooks/useTipRecipient";
import BaseTipTab from "./BaseTipTab";
import HiveTipTab from "./HiveTipTab";
import TipSuccess from "./TipSuccess";
import useTipComment from "./useTipComment";

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  discussion: Discussion;
}

const TAB_TEXT_PROPS = {
  flex: 1,
  fontSize: "13px",
  letterSpacing: "2px",
  textTransform: "uppercase" as const,
  py: "10px",
  borderRadius: 0,
  borderBottom: "2px solid transparent",
  color: "dim",
  _selected: { color: "primary", borderColor: "primary" },
};

export default function TipModal({
  isOpen,
  onClose,
  discussion,
}: TipModalProps) {
  const t = useTranslations("tip");
  const announceTip = useTipComment();
  const { user: aiohaUser } = useAioha();
  const recipient = useTipRecipient(discussion, { enabled: isOpen });
  const [settled, setSettled] = useState<
    { amount: string; token: string; txUrl: string | null } | null
  >(null);

  // A HIVE/HBD transfer needs ACTIVE authority. Stored userbase keys are
  // POSTING only, so this rail exists for Keychain sessions and nobody else.
  const canTipHive = !!aiohaUser && !!recipient.hiveAccount;
  const canTipBase = !!recipient.evmAddress;

  const handleSettled = useCallback(
    async (amount: string, token: string, txUrl: string | null) => {
      // The money has already moved. Show the celebration, then try the
      // comment separately so a failed reply never reads as a failed tip.
      setSettled({ amount, token, txUrl });
      await announceTip({ discussion, amount, token });
    },
    [announceTip, discussion]
  );

  const handleClose = useCallback(() => {
    setSettled(null);
    onClose();
  }, [onClose]);

  const hasAnyRail = canTipHive || canTipBase;

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${t("title")} ${recipient.displayName}`}
      size="md"
    >
      {settled ? (
        <TipSuccess
          amount={settled.amount}
          token={settled.token}
          txUrl={settled.txUrl}
          recipientLabel={`@${recipient.displayName}`}
          onDone={handleClose}
        />
      ) : recipient.isLoading ? (
        <Box>
          <Flex align="center" gap={3} m={4} p={3} bg="panel" border="1px dashed" borderColor="inputBorder">
            <Flex boxSize="30px" flexShrink={0} align="center" justify="center" border="1px dashed" borderColor="dim" color="dim" fontSize="sm">
              ?
            </Flex>
            <Text fontSize="sm" color="dim">
              {t("resolvingRecipient")}
            </Text>
          </Flex>
          <VStack spacing={3.5} mx={4} mb={4} opacity={0.5} align="stretch">
            <Box h="10px" w="70px" bg="panel" />
            <Box h="46px" bg="inputBg" border="1px solid" borderColor="border" />
            <Box h="10px" w="50px" bg="panel" />
            <Box h="38px" bg="inputBg" border="1px solid" borderColor="border" />
            <Box h="42px" bg="panel" border="1px solid" borderColor="border" />
          </VStack>
        </Box>
      ) : !hasAnyRail ? (
        <VStack spacing={3} align="center" py={9} px={6} textAlign="center">
          <Text fontSize="xl" color="dim">
            ¯\_(ツ)_/¯
          </Text>
          <Text fontWeight="bold" color="text" letterSpacing="1px">
            {t("noRailsTitle")}
          </Text>
          <Text fontSize="sm" color="dim">
            {t("noRailsBody")}
          </Text>
        </VStack>
      ) : (
        <Tabs variant="unstyled" isFitted>
          <TabList borderBottom="1px solid" borderColor="border">
            {canTipHive && <Tab {...TAB_TEXT_PROPS}>{t("tabHive")}</Tab>}
            {canTipBase && (
              <Tab {...TAB_TEXT_PROPS} borderLeft={canTipHive ? "1px solid" : undefined} borderLeftColor="border">
                {t("tabBase")}
              </Tab>
            )}
          </TabList>
          <TabPanels>
            {canTipHive && (
              <TabPanel px={4} pb={4}>
                <HiveTipTab
                  recipient={recipient.hiveAccount!}
                  onSettled={handleSettled}
                />
              </TabPanel>
            )}
            {canTipBase && (
              <TabPanel px={4} pb={4}>
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
