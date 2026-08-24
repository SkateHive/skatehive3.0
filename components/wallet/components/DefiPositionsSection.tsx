"use client";
import { Box, HStack, Text, VStack } from "@chakra-ui/react";
import { usePortfolioContext } from "@/contexts/PortfolioContext";
import { useTranslations, useLocale } from "@/contexts/LocaleContext";
import { formatValue } from "@/lib/utils/portfolioUtils";

type ChainFilter = "all" | "hive" | "evm" | "farcaster";

/**
 * "In DeFi" rows: claims against protocol contracts, read from protocol
 * state by /api/portfolio (lib/evm/defiPositions.ts). Shows the underlying
 * amount, USD value, lock status with unlock time, and pending rewards.
 * Read failures are rendered as failures — never as 0.
 */
export default function DefiPositionsSection({ chainFilter }: { chainFilter: ChainFilter }) {
  const { aggregatedPortfolio } = usePortfolioContext();
  const t = useTranslations();
  const { locale } = useLocale();
  if (chainFilter === "hive" || chainFilter === "farcaster") return null;
  const defi = aggregatedPortfolio?.defi;
  if (!defi || (defi.positions.length === 0 && defi.errors.length === 0)) return null;

  const fmtDate = (unix: number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(unix * 1000)) + " UTC";
  const fmtAmount = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 6 });

  return (
    <Box mt={4} data-testid="defi-positions">
      <HStack justify="space-between" px={1} mb={2}>
        <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="sm" textTransform="uppercase" letterSpacing="wider">
          {t("wallet.defiPositions")}
        </Text>
        <Text fontFamily="mono" fontSize="sm" color="primary" fontWeight="bold">{formatValue(defi.totalUSD)}</Text>
      </HStack>
      <VStack align="stretch" spacing={0} border="1px solid" borderColor="border">
        {defi.positions.map((p) => {
          const now = Date.now() / 1000;
          const locked = p.withdrawUnlockAt != null && now < p.withdrawUnlockAt;
          return (
            <HStack key={p.positionId} justify="space-between" align="flex-start" p={3} borderBottom="1px solid" borderColor="border" data-testid={`defi-${p.positionId}`}>
              <VStack align="flex-start" spacing={0.5}>
                {/* protocol/asset names are plain text — never links */}
                <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="sm">{p.label}</Text>
                <Text fontFamily="mono" fontSize="xs" color="dim">
                  {fmtAmount(p.deposited)} {p.asset.symbol}
                </Text>
                <Text fontFamily="mono" fontSize="xs" color={locked ? "orange.300" : "green.400"}>
                  {locked && p.withdrawUnlockAt != null
                    ? `🔒 ${t("wallet.lockedUntil").replace("{date}", fmtDate(p.withdrawUnlockAt))}`
                    : t("wallet.withdrawable")}
                </Text>
                <Text fontFamily="mono" fontSize="xs" color="dim">
                  {t("wallet.rewardsPending").replace("{symbol}", p.rewards.symbol)}: {fmtAmount(p.rewards.pending)} {p.rewards.symbol}
                  {p.claimUnlockAt != null && now < p.claimUnlockAt ? ` · ${t("wallet.claimableAfter").replace("{date}", fmtDate(p.claimUnlockAt))}` : ""}
                </Text>
              </VStack>
              <Text fontFamily="mono" fontSize="sm" color="primary" fontWeight="bold" whiteSpace="nowrap">{formatValue(p.valueUSD)}</Text>
            </HStack>
          );
        })}
        {defi.errors.map((e) => (
          <Box key={e.positionId} p={3} borderBottom="1px solid" borderColor="border">
            <Text fontFamily="mono" fontSize="xs" color="red.400">
              {t("wallet.defiReadFailed").replace("{label}", e.label).replace("{message}", e.message)}
            </Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
