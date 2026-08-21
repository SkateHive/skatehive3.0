"use client";

import { Box, Flex, Text, VStack } from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";

interface TipErrorBarProps {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}

export default function TipErrorBar({ message, onRetry, onDismiss }: TipErrorBarProps) {
  const t = useTranslations("tip");

  return (
    <Box
      position="absolute"
      left={3}
      right={3}
      bottom={3}
      maxW="calc(100% - 24px)"
      overflow="hidden"
      bg="panel"
      border="1px solid"
      borderColor="text"
      p={3}
    >
      <Flex align="start" gap={3}>
        <Text color="text">✗</Text>
        <VStack align="start" spacing={0} flex={1} minW={0}>
          <Text fontSize="xs" color="text" noOfLines={2} wordBreak="break-word" overflowWrap="anywhere">
            {message}
          </Text>
          <Text fontSize="10px" color="dim">
            {t("errorSubtext")}
          </Text>
        </VStack>
        <VStack spacing={2} align="end" flexShrink={0}>
          <Text
            color="dim"
            fontSize="xs"
            cursor="pointer"
            onClick={onDismiss}
          >
            ✕
          </Text>
          <Text
            color="primary"
            fontSize="xs"
            letterSpacing="2px"
            textTransform="uppercase"
            cursor="pointer"
            onClick={onRetry}
          >
            {t("retry")}
          </Text>
        </VStack>
      </Flex>
    </Box>
  );
}
