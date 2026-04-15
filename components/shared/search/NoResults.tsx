"use client";

import React from "react";
import { Box, HStack, Text, Spinner, Image, VStack } from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";

interface NoResultsProps {
  query: string;
  hasPages: boolean;
  hasSkaters: boolean;
}

export default function NoResults({
  query,
  hasPages,
  hasSkaters,
}: NoResultsProps) {
  const t = useTranslations();
  if (hasPages || hasSkaters) return null;

  // Easter egg for HZC search
  const isHZC = query.toLowerCase() === "hzc";

  if (isHZC) {
    return (
      <Box p={6} textAlign="center">
        <VStack spacing={4}>
          <Image
            src="/images/spinning-joint-sm.gif"
            alt="HZC"
            boxSize="120px"
            objectFit="contain"
          />
          <Text
            color="primary"
            fontSize="lg"
            fontWeight="bold"
            fontFamily="'Joystix', monospace"
          >
            🔥 HZC 🔥
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <Box p={4} textAlign="center">
      <Text color="primary" fontSize="md">
        {t("searchOverlay.noResults.heading")} &ldquo;{query}&rdquo;
      </Text>
      <Text color="secondary" fontSize="sm" mt={1}>
        {t("searchOverlay.noResults.hint")}
      </Text>
    </Box>
  );
}
