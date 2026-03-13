"use client";

import {
  Box,
  Button,
  Center,
  HStack,
  SimpleGrid,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  Text,
  VStack,
} from "@chakra-ui/react";
import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "@/lib/i18n/hooks";
import type { PoidhApiStatus } from "@/types/poidh";
import { usePoidhBounties } from "@/hooks/usePoidhBounties";
import PoidhBountyCard from "./PoidhBountyCard";

const TABS: PoidhApiStatus[] = ["open", "past"];

export default function PoidhBountyList() {
  const t = useTranslations("bounties");
  const [status, setStatus] = useState<PoidhApiStatus>("open");
  const { bounties, isLoading, error, refetch, stats } = usePoidhBounties({ status });

  return (
    <VStack align="stretch" spacing={6}>
      <Box>
        <Text fontSize={{ base: "2xl", md: "4xl" }} fontWeight="black" color="primary">
          {t("poidhTitle")}
        </Text>
        <Text color="text" mt={2} maxW="720px">
          {t("poidhSubtitle")}
        </Text>
      </Box>

      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
        <StatCard label={t("poidhStatShowing")} value={String(stats.count)} />
        <StatCard label={t("poidhStatRewardPool")} value={`${stats.totalRewardEth.toFixed(3)} ETH`} />
        <StatCard
          label={t("poidhStatScope")}
          value={status === "open" ? t("poidhTabOpen") : t("poidhTabPast")}
        />
      </SimpleGrid>

      <HStack justify="space-between" align={{ base: "stretch", md: "center" }} flexDir={{ base: "column", md: "row" }} spacing={3}>
        <HStack spacing={3} flexWrap="wrap">
          {TABS.map((tab) => {
            const isActive = status === tab;
            return (
              <Button
                key={tab}
                onClick={() => setStatus(tab)}
                borderRadius="full"
                bg={isActive ? "primary" : "transparent"}
                color={isActive ? "background" : "primary"}
                borderWidth="1px"
                borderColor={isActive ? "primary" : "border"}
                _hover={{ bg: isActive ? "primary" : "muted" }}
              >
                {tab === "open" ? t("poidhTabOpen") : t("poidhTabPast")}
              </Button>
            );
          })}
        </HStack>

        <HStack spacing={3}>
          <Button variant="outline" borderColor="border" onClick={() => refetch()}>
            {t("poidhRefresh")}
          </Button>
          <Button as={Link} href="https://poidh.xyz" target="_blank" rel="noopener noreferrer" variant="ghost" color="primary">
            {t("poidhOpenSite")}
          </Button>
        </HStack>
      </HStack>

      {isLoading ? (
        <Center py={12}>
          <VStack>
            <Spinner size="xl" color="primary" />
            <Text color="text">{t("poidhLoading")}</Text>
          </VStack>
        </Center>
      ) : error ? (
        <Box borderWidth="1px" borderColor="red.300" bg="red.50" borderRadius="xl" p={4}>
          <Text color="red.700" fontWeight="bold">{t("poidhErrorTitle")}</Text>
          <Text color="red.600" fontSize="sm" mt={1}>{error}</Text>
          <Button size="sm" mt={3} onClick={() => refetch()}>
            {t("poidhRetry")}
          </Button>
        </Box>
      ) : bounties.length === 0 ? (
        <Center py={12}>
          <Text color="muted">{t("poidhEmpty")}</Text>
        </Center>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={5}>
          {bounties.map((bounty) => (
            <PoidhBountyCard key={`${bounty.chainId}-${bounty.id}`} bounty={bounty} />
          ))}
        </SimpleGrid>
      )}
    </VStack>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="2xl" bg="panel" p={4}>
      <Stat>
        <StatLabel color="muted">{label}</StatLabel>
        <StatNumber color="primary" fontSize="2xl">{value}</StatNumber>
      </Stat>
    </Box>
  );
}
