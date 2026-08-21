"use client";

import { Box, Flex, Text, VStack } from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";

interface TipErrorBarProps {
  message: string;
  onRetry: () => void;
}

export default function TipErrorBar({ message, onRetry }: TipErrorBarProps) {
  const t = useTranslations("tip");

  return (
    <Box position="absolute" left={3} right={3} bottom={3} bg="panel" border="1px solid" borderColor="text" p={3}>
      <Flex align="center" gap={3}>
        <Text color="text">✗</Text>
        <VStack align="start" spacing={0} flex={1}>
          <Text fontSize="xs" color="text">
            {message}
          </Text>
          <Text fontSize="10px" color="dim">
            {t("errorSubtext")}
          </Text>
        </VStack>
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
      </Flex>
    </Box>
  );
}
