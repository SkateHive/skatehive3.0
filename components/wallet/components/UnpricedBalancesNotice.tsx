"use client";
import { Box, Text, VStack } from "@chakra-ui/react";
import { usePortfolioContext } from "@/contexts/PortfolioContext";
import { useTranslations } from "@/contexts/LocaleContext";

type ChainFilter = "all" | "hive" | "evm" | "farcaster";

/**
 * Balances that were read from the chain but that no price source could value.
 *
 * They are deliberately absent from the wallet totals rather than counted as
 * $0 — a real balance shown as $0.00 reads as "you have nothing", which is a
 * different and worse lie than "we could not price this". Same rule the DeFi
 * read errors follow.
 */
export default function UnpricedBalancesNotice({ chainFilter }: { chainFilter: ChainFilter }) {
  const { aggregatedPortfolio } = usePortfolioContext();
  const t = useTranslations();
  if (chainFilter === "hive" || chainFilter === "farcaster") return null;

  const errors = aggregatedPortfolio?.tokenReadErrors ?? [];
  if (errors.length === 0) return null;

  return (
    <Box mt={4} data-testid="unpriced-balances">
      <VStack align="stretch" spacing={0} border="1px solid" borderColor="border">
        {errors.map((e, i) => (
          <Box key={`${e.label}-${i}`} p={3} borderBottom="1px solid" borderColor="border">
            {/* asset labels are plain text — never links */}
            <Text fontFamily="mono" fontSize="xs" color="red.400">
              {t("wallet.priceUnavailable")
                .replace("{label}", e.label)
                .replace("{message}", e.message)}
            </Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}
