"use client";
import { useMemo, useState } from "react";
import {
  Box,
  Button,
  HStack,
  IconButton,
  Image,
  Input,
  Spinner,
  Text,
  VStack,
  useBreakpointValue,
  useToast,
} from "@chakra-ui/react";
import { FaExchangeAlt } from "react-icons/fa";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import type { Operation as BroadcastOp } from "@hiveio/dhive";
import { useTheme } from "@/app/themeProvider";
import useHiveAccount from "@/hooks/useHiveAccount";
import { useHiveSwapMarket } from "@/hooks/wallet/useHiveSwapMarket";
import { extractNumber } from "@/lib/utils/extractNumber";
import { useTranslations } from "@/contexts/LocaleContext";
import {
  buildMarketOrder,
  formatMilli,
  quoteCollateralizedConvert,
  quoteConvert,
  quoteMarketSwap,
  toMilli,
  type HiveAssetSymbol,
} from "@/lib/hive/swapQuotes";

type Route = "market" | "convert";

const pct = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 2 : 1)}%`;
const fmt = (milli: bigint) => formatMilli(milli);

function DetailRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <HStack justify="space-between" spacing={3} align="start">
      <Text fontSize="xs" fontFamily="mono" color="dim">
        {label}
      </Text>
      <Text fontSize="xs" fontFamily="mono" color={warn ? "orange.300" : "text"} textAlign="right" flexShrink={0}>
        {value}
      </Text>
    </HStack>
  );
}

export default function HiveSwapPanel() {
  const { theme } = useTheme();
  const { user, aioha } = useAioha();
  const { hiveAccount } = useHiveAccount(user || "");
  const market = useHiveSwapMarket();
  const toast = useToast();
  const t = useTranslations("hiveSwap");
  const isMobile = useBreakpointValue({ base: true, md: false });

  const [fromToken, setFromToken] = useState<HiveAssetSymbol>("HIVE");
  const [route, setRoute] = useState<Route>("market");
  const [amount, setAmount] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const toToken: HiveAssetSymbol = fromToken === "HIVE" ? "HBD" : "HIVE";
  const fromLogo = fromToken === "HIVE" ? "/logos/hiveLogo.png" : "/logos/hbd_logo.png";
  const toLogo = toToken === "HIVE" ? "/logos/hiveLogo.png" : "/logos/hbd_logo.png";

  const balances = useMemo(() => {
    const hive = hiveAccount?.balance ? extractNumber(hiveAccount.balance.toString()) : 0;
    const hbd = hiveAccount?.hbd_balance ? extractNumber(hiveAccount.hbd_balance.toString()) : 0;
    return { HIVE: hive, HBD: hbd };
  }, [hiveAccount]);
  const fromBalance = balances[fromToken];
  const toBalance = balances[toToken];

  const amountMilli = toMilli(amount);

  const marketQuote = useMemo(
    () => (market.book && amountMilli > 0n ? quoteMarketSwap(market.book, fromToken, amountMilli) : null),
    [market.book, fromToken, amountMilli],
  );
  const collateralQuote = useMemo(
    () =>
      market.feed && fromToken === "HIVE" && amountMilli > 0n
        ? quoteCollateralizedConvert(amountMilli, market.feed)
        : null,
    [market.feed, fromToken, amountMilli],
  );
  const convertQuote = useMemo(
    () =>
      market.feed && fromToken === "HBD" && amountMilli > 0n ? quoteConvert(amountMilli, market.feed) : null,
    [market.feed, fromToken, amountMilli],
  );
  // Fee shown on the route chip before an amount is typed.
  const conversionCost = useMemo(
    () => (market.feed ? quoteCollateralizedConvert(1_000_000n, market.feed).effectiveCost : null),
    [market.feed],
  );

  const received: bigint | null =
    route === "market"
      ? marketQuote?.amountOut ?? null
      : fromToken === "HIVE"
        ? collateralQuote?.hbdNow ?? null
        : convertQuote?.hiveOut ?? null;

  const quoteReady =
    route === "market"
      ? !!marketQuote?.filled && marketQuote.minToReceive > 0n
      : fromToken === "HIVE"
        ? !!collateralQuote && collateralQuote.hbdNow > 0n
        : !!convertQuote && convertQuote.hiveOut > 0n;

  const amountNum = Number(amount);
  const canSubmit =
    !!user && amountMilli > 0n && amountNum <= fromBalance && !isBusy && quoteReady;

  const flip = () => {
    setFromToken((p) => (p === "HIVE" ? "HBD" : "HIVE"));
    setAmount("");
  };

  const broadcast = async (op: BroadcastOp) => {
    const res = await aioha.signAndBroadcastTx([op], KeyTypes.Active);
    if ((res as { success?: boolean })?.success === false) {
      throw new Error((res as { error?: string })?.error || "Rejected");
    }
  };

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;
    setIsBusy(true);
    try {
      if (route === "market" && marketQuote) {
        await broadcast(buildMarketOrder(user, marketQuote) as unknown as BroadcastOp);
        toast({
          title: t("swapDone"),
          description: t("swapDoneDesc").replace("{amount}", formatMilli(marketQuote.amountOut, toToken)),
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      } else if (fromToken === "HIVE" && collateralQuote) {
        await broadcast([
          "collateralized_convert",
          {
            owner: user,
            requestid: Math.floor(Math.random() * 0xffffffff),
            amount: formatMilli(amountMilli, "HIVE"),
          },
        ] as unknown as BroadcastOp);
        toast({
          title: t("convertStarted"),
          description: t("convertStartedHive").replace("{amount}", formatMilli(collateralQuote.hbdNow, "HBD")),
          status: "success",
          duration: 7000,
          isClosable: true,
        });
      } else {
        await broadcast([
          "convert",
          {
            owner: user,
            requestid: Math.floor(Math.random() * 0xffffffff),
            amount: formatMilli(amountMilli, "HBD"),
          },
        ] as unknown as BroadcastOp);
        toast({
          title: t("convertStarted"),
          description: t("convertStartedHbd"),
          status: "success",
          duration: 7000,
          isClosable: true,
        });
      }
      setAmount("");
      market.refresh();
    } catch (err) {
      toast({
        title: route === "market" ? t("swapFailed") : t("convertFailed"),
        description:
          route === "market"
            ? t("swapFailedDesc")
            : err instanceof Error
              ? err.message
              : undefined,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsBusy(false);
    }
  };

  const loadingQuotes = market.isLoading && !market.book;

  const routeOption = (key: Route, label: string, hint: string) => {
    const active = route === key;
    return (
      <Box
        as="button"
        type="button"
        key={key}
        flex={1}
        py={2}
        px={2}
        border="1px solid"
        borderColor={active ? "primary" : "border"}
        bg={active ? "primary" : "transparent"}
        onClick={() => setRoute(key)}
        aria-pressed={active}
        _hover={{ borderColor: "primary" }}
        _focusVisible={{ outline: "2px solid", outlineColor: "primary", outlineOffset: "2px" }}
      >
        <VStack spacing={0}>
          <Text
            fontFamily="mono"
            fontWeight="black"
            fontSize="xs"
            textTransform="uppercase"
            letterSpacing="wider"
            color={active ? "background" : "text"}
          >
            {label}
          </Text>
          <Text fontFamily="mono" fontSize="10px" color={active ? "background" : "dim"} opacity={active ? 0.8 : 1} whiteSpace="normal">
            {hint}
          </Text>
        </VStack>
      </Box>
    );
  };

  return (
    <VStack spacing={0} align="stretch">
      <Box border="1px solid" borderColor="border" p={3} mb={1}>
        <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>
          {t("youPay")}
        </Text>
        <HStack>
          <HStack spacing={2} flex={1} minW={0}>
            <Image src={fromLogo} w="22px" h="22px" objectFit="contain" alt="" />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              fontSize="2xl"
              fontFamily="mono"
              fontWeight="black"
              color="primary"
              variant="unstyled"
              flex={1}
              minW={0}
              _placeholder={{ color: "dim" }}
            />
          </HStack>
          <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="sm" flexShrink={0}>
            {fromToken}
          </Text>
        </HStack>
        <Text fontSize="xs" color="dim" fontFamily="mono" mt={1}>
          {t("available").replace("{amount}", fromBalance.toFixed(3)).replace("{token}", fromToken)}
        </Text>
      </Box>

      <Box textAlign="center" py={1}>
        <IconButton
          aria-label={t("flip")}
          icon={<FaExchangeAlt />}
          size="xs"
          variant="ghost"
          color="primary"
          onClick={flip}
          _hover={{ bg: "primary", color: "background" }}
          transition="all 0.2s"
        />
      </Box>

      <Box border="1px solid" borderColor="border" p={3} mb={3}>
        <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>
          {t("youReceive")}
        </Text>
        <HStack>
          <HStack spacing={2} flex={1} minW={0}>
            <Image src={toLogo} w="22px" h="22px" objectFit="contain" alt="" />
            <Text fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary">
              {loadingQuotes ? "..." : received != null ? fmt(received) : "0"}
            </Text>
          </HStack>
          <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="sm" flexShrink={0}>
            {toToken}
          </Text>
        </HStack>
        <Text fontSize="xs" color="dim" fontFamily="mono" mt={1}>
          {t("balance").replace("{amount}", toBalance.toFixed(3)).replace("{token}", toToken)}
        </Text>
      </Box>

      <HStack spacing={2} mb={3} align="stretch">
        {routeOption("market", t("routeMarket"), t("routeMarketHint"))}
        {routeOption(
          "convert",
          t("routeConvert"),
          fromToken === "HIVE"
            ? t("routeConvertHintHive").replace("{cost}", conversionCost != null ? pct(conversionCost) : "5%")
            : t("routeConvertHintHbd"),
        )}
      </HStack>

      {market.error && !market.book ? (
        <Text fontSize="xs" color="orange.300" fontFamily="mono" mb={3}>
          {t("marketUnavailable")}
        </Text>
      ) : null}

      {route === "market" && marketQuote ? (
        <VStack align="stretch" spacing={1} mb={3}>
          {marketQuote.filled ? (
            <>
              <DetailRow label={t("rate")} value={`1 HIVE ≈ ${marketQuote.averagePrice.toFixed(5)} HBD`} />
              {marketQuote.priceImpact >= 0.001 ? (
                <DetailRow
                  label={t("priceImpact")}
                  value={pct(marketQuote.priceImpact)}
                  warn={marketQuote.priceImpact >= 0.02}
                />
              ) : null}
              <DetailRow label={t("minReceived")} value={formatMilli(marketQuote.minToReceive, toToken)} />
            </>
          ) : (
            <Text fontSize="xs" color="orange.300" fontFamily="mono">
              {t("bookTooThin")}
            </Text>
          )}
        </VStack>
      ) : null}

      {route === "convert" && collateralQuote ? (
        <VStack align="stretch" spacing={1} mb={3}>
          <DetailRow label={t("receiveNow")} value={formatMilli(collateralQuote.hbdNow, "HBD")} />
          <DetailRow label={t("collateralLocked")} value={formatMilli(collateralQuote.amountIn, "HIVE")} />
          <DetailRow label={t("returnedLater")} value={formatMilli(collateralQuote.hiveReturned, "HIVE")} />
          <DetailRow label={t("effectiveCost")} value={pct(collateralQuote.effectiveCost)} warn />
        </VStack>
      ) : null}

      {route === "convert" && convertQuote ? (
        <VStack align="stretch" spacing={1} mb={3}>
          <DetailRow label={t("arrivesLater")} value={formatMilli(convertQuote.hiveOut, "HIVE")} />
        </VStack>
      ) : null}

      {route === "convert" ? (
        <Text fontSize="xs" color="dim" fontFamily="mono" mb={3}>
          {t("convertWarning")}
        </Text>
      ) : null}

      <Button
        w="100%"
        borderRadius="none"
        fontWeight="black"
        letterSpacing="widest"
        fontFamily="mono"
        colorScheme="green"
        size="md"
        sx={{ textTransform: "uppercase" }}
        leftIcon={isBusy ? <Spinner size="sm" /> : <FaExchangeAlt />}
        isDisabled={!canSubmit}
        onClick={handleSubmit}
      >
        {isBusy
          ? route === "market"
            ? t("swapping")
            : t("converting")
          : loadingQuotes
            ? t("loading")
            : route === "market"
              ? t("swap")
              : t("convert")}
      </Button>

      {!user && (
        <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" mt={2}>
          {t("connectHive")}
        </Text>
      )}

      <Text fontSize="xs" mt={3} textAlign="center" fontFamily="mono">
        <a
          href={isMobile ? "https://hivedex.io/" : "https://hivehub.dev/market/swap"}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: theme.colors.primary, textDecoration: "underline" }}
        >
          {t("moreOptions")}
        </a>
      </Text>
    </VStack>
  );
}
