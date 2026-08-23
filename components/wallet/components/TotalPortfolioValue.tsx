import { useMemo } from "react";
import { Box, Text, Skeleton } from "@chakra-ui/react";
import { usePortfolioContext } from "@/contexts/PortfolioContext";
import { useLocale, useTranslations } from "@/contexts/LocaleContext";

type ChainFilter = "all" | "hive" | "evm" | "farcaster";

interface TotalPortfolioValueProps {
  totalHiveAssetsValue: number;
  chainFilter: ChainFilter;
  btcValue?: number;
  isLoading?: boolean;
}

const LABELS: Record<ChainFilter, string> = {
  all: "Total Money",
  hive: "Hive Balance",
  evm: "EVM Balance",
  farcaster: "Farcaster Balance",
};

export default function TotalPortfolioValue({
  totalHiveAssetsValue,
  chainFilter,
  btcValue = 0,
  isLoading,
}: TotalPortfolioValueProps) {
  const { locale } = useLocale();
  const t = useTranslations();
  const {
    aggregatedPortfolio,
    portfolio,
    farcasterPortfolio,
    farcasterVerifiedPortfolios,
    isLoading: portfolioLoading,
  } = usePortfolioContext();
  const loading = isLoading || portfolioLoading;

  const displayValue = useMemo(() => {
    if (chainFilter === "hive") return totalHiveAssetsValue;
    if (chainFilter === "evm") {
      // EVM = active wallet + all DB-linked verified addresses
      const evmBase = portfolio?.totalNetWorth || 0;
      const evmVerified = Object.values(farcasterVerifiedPortfolios || {})
        .reduce((sum, p) => sum + (p?.totalNetWorth || 0), 0);
      return evmBase + evmVerified;
    }
    if (chainFilter === "farcaster") return farcasterPortfolio?.totalNetWorth || 0;
    // "all" — Hive + EVM aggregate + self-claimed BTC
    return totalHiveAssetsValue + (aggregatedPortfolio?.totalNetWorth || 0) + btcValue;
  }, [
    chainFilter,
    totalHiveAssetsValue,
    portfolio?.totalNetWorth,
    farcasterPortfolio?.totalNetWorth,
    farcasterVerifiedPortfolios,
    aggregatedPortfolio?.totalNetWorth,
    btcValue,
  ]);

  // "In wallet / In DeFi / Total" breakdown (shared vocabulary with the Gnars
  // and SOPA surfaces). totalNetWorth from the API already includes DeFi.
  const showBreakdown = chainFilter === "all" || chainFilter === "evm";
  const defi = aggregatedPortfolio?.defi;
  const defiUsd = aggregatedPortfolio?.defiUsd ?? 0;
  const walletUsd = Math.max(0, displayValue - (showBreakdown ? defiUsd : 0));
  const fmt = (v: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  if (displayValue === 0 && chainFilter === "all" && !loading) return null;

  return (
    <Box
      mb={5}
      pb={4}
      borderBottom="2px solid"
      borderColor="border"
      textAlign="center"
    >
      <Text
        fontSize="2xl"
        color="dim"
        textTransform="uppercase"
        letterSpacing="widest"
        fontWeight="bold"
        mb={2}
      >
        {LABELS[chainFilter]}
      </Text>
      {loading && displayValue === 0 ? (
        <Skeleton
          h="64px"
          w="240px"
          mx="auto"
          startColor="muted"
          endColor="panel"
        />
      ) : (
        <Text
          fontSize={{ base: "6xl", md: "8xl" }}
          color="primary"
          fontWeight="black"
          letterSpacing="tight"
          lineHeight="1"
          fontFamily="mono"
          sx={{
            textShadow: "0 0 30px var(--chakra-colors-primary)",
            filter: "brightness(1.15)",
          }}
        >
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency: "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(displayValue)}
        </Text>
      )}
      {showBreakdown && !loading && (defiUsd > 0 || (defi?.errors.length ?? 0) > 0) && (
        <Text fontSize="sm" color="dim" fontFamily="mono" mt={2} data-testid="total-breakdown">
          {t("wallet.inWallet")} {fmt(walletUsd)} · {t("wallet.inDefi")} {fmt(defiUsd)} · {t("wallet.total")} {fmt(displayValue)}
        </Text>
      )}
      {showBreakdown && (defi?.errors.length ?? 0) > 0 && (
        <Text fontSize="xs" color="red.400" fontFamily="mono" mt={1}>
          {defi!.errors.map((e) => t("wallet.defiReadFailed").replace("{label}", e.label).replace("{message}", e.message)).join(" ")}
        </Text>
      )}
    </Box>
  );
}
