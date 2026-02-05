"use client";
import React from "react";
import {
  VStack,
  Text,
  Button,
  HStack,
  Icon,
  Box,
  List,
  ListItem,
  ListIcon,
} from "@chakra-ui/react";
import {
  FaHive,
  FaUserFriends,
  FaEdit,
  FaTrash,
  FaWallet,
  FaGift,
} from "react-icons/fa";
import { CheckCircleIcon } from "@chakra-ui/icons";
import SkateModal from "@/components/shared/SkateModal";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/hooks";

export type UpgradeAction = "follow" | "edit" | "delete" | "wallet" | "general";

interface HiveUpgradePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: UpgradeAction;
}

const actionIcons = {
  follow: FaUserFriends,
  edit: FaEdit,
  delete: FaTrash,
  wallet: FaWallet,
  general: FaHive,
};

export default function HiveUpgradePromptModal({
  isOpen,
  onClose,
  action,
}: HiveUpgradePromptModalProps) {
  const router = useRouter();
  const t = useTranslations("userbase");

  const handleFindSponsor = () => {
    router.push("/dao");
    onClose();
  };

  const handleLearnMore = () => {
    window.open("https://docs.skatehive.app/docs/create-account", "_blank");
  };

  const actionIcon = actionIcons[action];
  const actionTitle = t(`upgradeModal.actions.${action}.title`);
  const actionDescription = t(`upgradeModal.actions.${action}.description`);

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("upgradeModal.title")}
      isCentered={true}
      size="md"
    >
      <Box p={6}>
        <VStack spacing={5} align="stretch">
          {/* Header with action icon */}
          <HStack spacing={3} justify="center" py={2}>
            <Icon as={actionIcon} boxSize={8} color="primary" />
            <Text
              fontFamily="mono"
              fontSize="lg"
              fontWeight="bold"
              color="text"
            >
              {actionTitle}
            </Text>
          </HStack>

          {/* Description */}
          <Text
            fontFamily="mono"
            fontSize="sm"
            color="dim"
            textAlign="center"
          >
            {actionDescription}
          </Text>

          {/* Explanation box */}
          <Box
            bg="whiteAlpha.50"
            border="1px solid"
            borderColor="border"
            borderRadius="sm"
            p={4}
          >
            <VStack spacing={3} align="stretch">
              <Text
                fontFamily="mono"
                fontSize="xs"
                color="primary"
                fontWeight="bold"
              >
                {t("upgradeModal.whatIsHive")}
              </Text>
              <Text fontFamily="mono" fontSize="xs" color="dim">
                {t("upgradeModal.hiveDescription")}
              </Text>
            </VStack>
          </Box>

          {/* Benefits list */}
          <Box>
            <Text fontFamily="mono" fontSize="xs" color="muted" mb={2}>
              {t("upgradeModal.withHiveYouCan")}
            </Text>
            <List spacing={1}>
              <ListItem fontFamily="mono" fontSize="xs" color="dim">
                <ListIcon as={CheckCircleIcon} color="primary" boxSize={3} />
                {t("upgradeModal.benefitFollow")}
              </ListItem>
              <ListItem fontFamily="mono" fontSize="xs" color="dim">
                <ListIcon as={CheckCircleIcon} color="primary" boxSize={3} />
                {t("upgradeModal.benefitEdit")}
              </ListItem>
              <ListItem fontFamily="mono" fontSize="xs" color="dim">
                <ListIcon as={CheckCircleIcon} color="primary" boxSize={3} />
                {t("upgradeModal.benefitWallet")}
              </ListItem>
              <ListItem fontFamily="mono" fontSize="xs" color="dim">
                <ListIcon as={CheckCircleIcon} color="primary" boxSize={3} />
                {t("upgradeModal.benefitRewards")}
              </ListItem>
              <ListItem fontFamily="mono" fontSize="xs" color="dim">
                <ListIcon as={CheckCircleIcon} color="primary" boxSize={3} />
                {t("upgradeModal.benefitVote")}
              </ListItem>
            </List>
          </Box>

          {/* How to upgrade */}
          <Box
            bg="subtle"
            border="1px solid"
            borderColor="primary"
            borderRadius="sm"
            p={4}
          >
            <VStack spacing={2} align="stretch">
              <HStack>
                <Icon as={FaGift} boxSize={4} color="primary" />
                <Text
                  fontFamily="mono"
                  fontSize="xs"
                  color="primary"
                  fontWeight="bold"
                >
                  {t("upgradeModal.getSponsoredTitle")}
                </Text>
              </HStack>
              <Text fontFamily="mono" fontSize="xs" color="dim">
                {t("upgradeModal.getSponsoredDescription")}
              </Text>
            </VStack>
          </Box>

          {/* Action buttons */}
          <VStack spacing={2} pt={2}>
            <Button
              onClick={handleFindSponsor}
              colorScheme="green"
              size="sm"
              fontFamily="mono"
              w="full"
              leftIcon={<Icon as={FaGift} />}
            >
              {t("upgradeModal.findSponsor")}
            </Button>
            <Button
              onClick={handleLearnMore}
              variant="ghost"
              size="xs"
              fontFamily="mono"
              color="dim"
              _hover={{ color: "primary" }}
            >
              {t("upgradeModal.learnMore")}
            </Button>
          </VStack>
        </VStack>
      </Box>
    </SkateModal>
  );
}
