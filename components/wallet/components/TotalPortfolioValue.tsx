import { useMemo } from "react";
import { Box, Text, Skeleton } from "@chakra-ui/react";
import { usePortfolioContext } from "@/contexts/PortfolioContext";
import { useLocale } from "@/contexts/LocaleContext";

type ChainFilter = "all" | "hive" | "evm" | "farcaster";

interface TotalPortfolioValueProps {
  totalHiveAssetsValue: number;
  chainFilter: ChainFilter;
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
  isLoading,
}: TotalPortfolioValueProps) {
  const { locale } = useLocale();
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
    if (chainFilter === "evm") return portfolio?.totalNetWorth || 0;
    if (chainFilter === "farcaster") {
      const fcBase = farcasterPortfolio?.totalNetWorth || 0;
      const fcVerified = Object.values(
        farcasterVerifiedPortfolios || {},
      ).reduce((sum, p) => sum + (p?.totalNetWorth || 0), 0);
      return fcBase + fcVerified;
    }
    // "all"
    return totalHiveAssetsValue + (aggregatedPortfolio?.totalNetWorth || 0);
  }, [
    chainFilter,
    totalHiveAssetsValue,
    portfolio?.totalNetWorth,
    farcasterPortfolio?.totalNetWorth,
    farcasterVerifiedPortfolios,
    aggregatedPortfolio?.totalNetWorth,
  ]);

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
    </Box>
  );
}
