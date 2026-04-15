"use client";

import React from "react";
import { Box, VStack, Text } from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";

interface SearchTipsProps {
  show: boolean;
}

export default function SearchTips({ show }: SearchTipsProps) {
  const t = useTranslations();
  if (!show) return null;

  return (
    <Box p={4} borderTop="1px solid" borderColor="secondary">
      <VStack spacing={2} align="start">
        <Text color="primary" fontSize="sm" fontWeight="medium">
          {t("searchOverlay.tips.title")}
        </Text>
        <VStack spacing={1} align="start">
          <Text fontSize="sm" color="secondary">
            {t("searchOverlay.tips.usernames")}
          </Text>
          <Text fontSize="sm" color="secondary">
            {t("searchOverlay.tips.pagesAndCommands")}
          </Text>
          <Text fontSize="sm" color="secondary">
            {t("searchOverlay.tips.navigate")}
          </Text>
        </VStack>
      </VStack>
    </Box>
  );
}
