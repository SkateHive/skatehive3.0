"use client";

import { ExternalLinkIcon } from "@chakra-ui/icons";
import { Badge, Box, Button, HStack, Link, Text, VStack } from "@chakra-ui/react";
import { useTranslations } from "@/lib/i18n/hooks";
import type { PoidhBounty } from "@/types/poidh";
import {
  formatPoidhAmount,
  formatPoidhDate,
  getPoidhChainColor,
  getPoidhChainName,
  getPoidhUrl,
} from "@/hooks/usePoidhBounties";

interface PoidhBountyCardProps {
  bounty: PoidhBounty;
}

export default function PoidhBountyCard({ bounty }: PoidhBountyCardProps) {
  const t = useTranslations("bounties");
  const description = bounty.description?.trim() || t("poidhNoDescription");

  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      bg="panel"
      borderRadius="2xl"
      p={5}
      h="100%"
      boxShadow="sm"
    >
      <VStack align="stretch" spacing={4} h="100%">
        <HStack justify="space-between" align="flex-start" spacing={3}>
          <Badge colorScheme={getPoidhChainColor(bounty.chainId)} borderRadius="full" px={3} py={1}>
            {getPoidhChainName(bounty.chainId)}
          </Badge>
          <Badge colorScheme={bounty.hasClaims ? "gray" : "green"} borderRadius="full" px={3} py={1}>
            {bounty.hasClaims ? t("poidhStatusPast") : t("poidhStatusActive")}
          </Badge>
        </HStack>

        <Box>
          <Text fontSize="xl" fontWeight="black" color="primary" lineHeight="1.2" noOfLines={3}>
            {bounty.title}
          </Text>
          <Text mt={3} color="text" fontSize="sm" noOfLines={6} whiteSpace="pre-line">
            {description}
          </Text>
        </Box>

        <HStack spacing={3} flexWrap="wrap">
          <MetaPill label={t("poidhReward")} value={formatPoidhAmount(bounty.amount)} />
          <MetaPill label={t("poidhCreated")} value={formatPoidhDate(bounty.createdAt)} />
          {bounty.deadline ? <MetaPill label={t("poidhDeadline")} value={formatPoidhDate(bounty.deadline)} /> : null}
          <MetaPill label={t("poidhType")} value={bounty.isMultiplayer ? t("poidhOpen") : t("poidhSolo")} />
        </HStack>

        <Box pt={1} mt="auto">
          <Button
            as={Link}
            href={getPoidhUrl(bounty)}
            isExternal
            rightIcon={<ExternalLinkIcon />}
            bg="primary"
            color="background"
            width="100%"
            _hover={{ bg: "accent", color: "primary" }}
          >
            {t("poidhViewBounty")}
          </Button>
        </Box>
      </VStack>
    </Box>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="xl" px={3} py={2} bg="background">
      <Text fontSize="xs" color="muted" textTransform="uppercase" letterSpacing="wider">
        {label}
      </Text>
      <Text fontSize="sm" color="text" fontWeight="bold">
        {value}
      </Text>
    </Box>
  );
}
