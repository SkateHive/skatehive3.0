"use client";

import { Box, Button, Flex, Text, VStack } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { useTranslations } from "@/contexts/LocaleContext";

const twinkle = keyframes`
  0%, 100% { opacity: .25; }
  50% { opacity: 1; }
`;

interface TipSuccessProps {
  amount: string;
  token: string;
  recipientLabel: string;
  txUrl?: string | null;
  onDone: () => void;
}

export default function TipSuccess({
  amount,
  token,
  recipientLabel,
  txUrl,
  onDone,
}: TipSuccessProps) {
  const t = useTranslations("tip");

  return (
    <VStack spacing={4} py={9} px={8} textAlign="center">
      <Flex gap={4} fontSize="sm" color="primary">
        {[0, 0.4, 0.8, 0.2, 0.6].map((delay, i) => (
          <Box
            key={i}
            as="span"
            color={i % 2 === 1 ? "dim" : "primary"}
            sx={{ animation: `${twinkle} 1.6s ease-in-out ${delay}s infinite` }}
          >
            {i % 3 === 0 ? "*" : "+"}
          </Box>
        ))}
      </Flex>
      <Flex boxSize="56px" border="2px solid" borderColor="primary" color="primary" align="center" justify="center" fontSize="2xl">
        ✓
      </Flex>
      <Text fontSize="lg" letterSpacing="4px" color="primary" textTransform="uppercase">
        {t("successTitle")}
      </Text>
      <Text fontSize="sm" color="text">
        <Text as="span" color="primary">
          {amount} {token}
        </Text>{" "}
        → {recipientLabel}
      </Text>
      <VStack spacing={1} fontSize="xs" color="dim">
        <Text>{t("successBody")}</Text>
        {txUrl && (
          <Text as="a" href={txUrl} target="_blank" rel="noopener noreferrer" textDecoration="underline">
            {t("viewTx")}
          </Text>
        )}
      </VStack>
      <Button
        onClick={onDone}
        variant="outline"
        borderColor="border"
        color="text"
        borderRadius={0}
        letterSpacing="2px"
        textTransform="uppercase"
        fontSize="xs"
        px={8}
        mt={1}
      >
        {t("done")}
      </Button>
    </VStack>
  );
}
