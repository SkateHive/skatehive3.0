"use client";

import { Box, Button, Flex, IconButton, Text, VStack } from "@chakra-ui/react";
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
        <Text color="text" aria-hidden="true">
          ✗
        </Text>
        <VStack align="start" spacing={0} flex={1} minW={0}>
          <Text fontSize="xs" color="text" noOfLines={2} wordBreak="break-word" overflowWrap="anywhere">
            {message}
          </Text>
          <Text fontSize="10px" color="dim">
            {t("errorSubtext")}
          </Text>
        </VStack>
        <VStack spacing={2} align="end" flexShrink={0}>
          <IconButton
            aria-label={t("dismiss")}
            icon={<Text aria-hidden="true">✕</Text>}
            onClick={onDismiss}
            size="xs"
            variant="ghost"
            color="dim"
            minW="auto"
            h="auto"
            p={0.5}
            _hover={{ color: "text", bg: "transparent" }}
          />
          <Button
            aria-label={t("retry")}
            onClick={onRetry}
            variant="link"
            color="primary"
            fontSize="xs"
            letterSpacing="2px"
            textTransform="uppercase"
            _hover={{ textDecoration: "none", opacity: 0.8 }}
          >
            {t("retry")}
          </Button>
        </VStack>
      </Flex>
    </Box>
  );
}
