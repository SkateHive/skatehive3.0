"use client";

import { Flex, Text, VStack } from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";

interface RecipientStripProps {
  label: string;
  note: string;
}

function initialsFor(label: string) {
  const clean = label.replace(/^@/, "").replace(/^0x/i, "");
  return clean.slice(0, 2).toUpperCase();
}

export default function RecipientStrip({ label, note }: RecipientStripProps) {
  const t = useTranslations("tip");

  return (
    <Flex align="center" gap={3} mt={4} p={3} bg="panel" border="1px solid" borderColor="border">
      <Flex
        boxSize="30px"
        flexShrink={0}
        align="center"
        justify="center"
        border="1px solid"
        borderColor="primary"
        color="primary"
        fontSize="xs"
        fontFamily="mono"
      >
        {initialsFor(label)}
      </Flex>
      <VStack align="start" spacing={0}>
        <Text fontSize="10px" letterSpacing="2px" color="dim" textTransform="uppercase">
          {t("recipientLabel")}
        </Text>
        <Text fontSize="sm" color="primary" fontFamily="mono">
          {label}
        </Text>
      </VStack>
      <Text ml="auto" fontSize="10px" color="dim" fontFamily="mono">
        {note}
      </Text>
    </Flex>
  );
}
