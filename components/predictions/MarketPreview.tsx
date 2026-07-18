"use client";
import React from "react";
import NextLink from "next/link";
import { Box, Skeleton, Text } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "@/lib/i18n/hooks";
import { predictionKeys, predictionsApi } from "@/lib/predictions/api";
import MarketCard from "./MarketCard";

// Feed embed for [[PREDICTIONMARKET:id]] placeholders: a shared market link
// (skatehive /hivepredict/<id> or hivepredict.app/markets/<id>) renders
// as the market card inline in the post/snap, linking to the internal page.
export default function MarketPreview({ marketId }: { marketId: string }) {
  const t = useTranslations("predictions");
  const { data: market, isLoading, isError } = useQuery({
    queryKey: predictionKeys.market(marketId),
    queryFn: () => predictionsApi.getMarket(marketId),
    staleTime: 30_000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Box my={3}>
        <Skeleton height="150px" borderRadius="lg" startColor="panel" endColor="panelHover" />
      </Box>
    );
  }

  if (isError || !market) {
    // Fall back to a plain internal link rather than swallowing the share.
    return (
      <Box my={3}>
        <Text
          as={NextLink}
          href={`/hivepredict/${encodeURIComponent(marketId)}`}
          color="primary"
          fontSize="sm"
        >
          {t("viewMarket")}
        </Text>
      </Box>
    );
  }

  return (
    <Box my={3}>
      <MarketCard market={market} />
    </Box>
  );
}
