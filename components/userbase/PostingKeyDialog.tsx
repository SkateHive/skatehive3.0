"use client";

import React from "react";
import { Box, Text, VStack } from "@chakra-ui/react";
import SkateModal from "@/components/shared/SkateModal";
import UserbasePostingKeyPanel from "@/components/userbase/UserbasePostingKeyPanel";
import { useTranslations } from "@/contexts/LocaleContext";

interface PostingKeyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  hiveHandle?: string | null;
}

export default function PostingKeyDialog({
  isOpen,
  onClose,
  hiveHandle,
}: PostingKeyDialogProps) {
  const t = useTranslations();

  const description = hiveHandle
    ? t("postingKeyDialog.descriptionWithHandle").replace(
        "{handle}",
        hiveHandle
      )
    : t("postingKeyDialog.description");

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title={t("postingKeyDialog.title")}
      size={{ base: "full", md: "md" }}
      windowId="posting-key-dialog"
    >
      <Box p={5}>
        <VStack align="stretch" spacing={4}>
          <Text color="text" fontSize="sm">
            {description}
          </Text>
          <UserbasePostingKeyPanel variant="modal" />
        </VStack>
      </Box>
    </SkateModal>
  );
}
