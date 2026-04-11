"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Text,
  Button,
  Input,
  HStack,
  VStack,
  Image,
  Spinner,
  Tooltip,
  IconButton,
  useToast,
} from "@chakra-ui/react";
import { FaExchangeAlt, FaHive, FaInfoCircle } from "react-icons/fa";
import { useAioha } from "@aioha/react-ui";
import { shimmerStyles } from "@/lib/utils/animations";
import { KeyTypes } from "@aioha/aioha";
import { useBreakpointValue } from "@chakra-ui/react";
import { useAccount } from "wagmi";
import { useHiveUser } from "@/contexts/UserContext";
import useHiveAccount from "@/hooks/useHiveAccount";
import { extractNumber } from "@/lib/utils/extractNumber";
import { useTranslations } from "@/contexts/LocaleContext";
import { useTheme } from "@/app/themeProvider";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import ERC20SwapSection from "./ERC20SwapSection";

import { useMarketPrices } from "@/hooks/useMarketPrices";

// ─── Props ────────────────────────────────────────────────────────────────────
interface UnifiedSwapSectionProps {
  hivePrice?: number | null;
  hbdPrice?: number | null;
  isPriceLoading?: boolean;
  /** Pass through to ERC20SwapSection */
  showFeeOption?: boolean;
  /** Always show both tabs even if one chain isn't connected. For standalone pages. */
  alwaysShowToggle?: boolean;
}

// ─── Hive Swap panel ──────────────────────────────────────────────────────────
function HiveSwapPanel({
  hivePrice,
  hbdPrice,
  isPriceLoading = false,
}: UnifiedSwapSectionProps) {
  const { theme } = useTheme();
  const { user, aioha } = useAioha();
  const { hiveAccount } = useHiveAccount(user || "");
  const toast = useToast();
  const t = useTranslations();
  const isMobile = useBreakpointValue({ base: true, md: false });

  const [convertDirection, setConvertDirection] = useState<
    "HIVE_TO_HBD" | "HBD_TO_HIVE"
  >("HIVE_TO_HBD");
  const [convertAmount, setConvertAmount] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  const balances = useMemo(() => {
    if (!hiveAccount) return { hiveBalance: 0, hbdBalance: 0 };
    const hiveBalance = hiveAccount.balance
      ? extractNumber(hiveAccount.balance.toString())
      : 0;
    const hbdBalance = hiveAccount.hbd_balance
      ? extractNumber(hiveAccount.hbd_balance.toString())
      : 0;
    return { hiveBalance, hbdBalance };
  }, [hiveAccount]);

  const fromToken = convertDirection === "HIVE_TO_HBD" ? "HIVE" : "HBD";
  const toToken = convertDirection === "HIVE_TO_HBD" ? "HBD" : "HIVE";
  const fromBalance =
    convertDirection === "HIVE_TO_HBD"
      ? balances.hiveBalance
      : balances.hbdBalance;
  const toBalance =
    convertDirection === "HIVE_TO_HBD"
      ? balances.hbdBalance
      : balances.hiveBalance;
  const fromLogo =
    fromToken === "HIVE" ? "/logos/hiveLogo.png" : "/logos/hbd_logo.png";
  const toLogo =
    toToken === "HIVE" ? "/logos/hiveLogo.png" : "/logos/hbd_logo.png";

  const estimatedOutput = useMemo(() => {
    if (
      !convertAmount ||
      isNaN(Number(convertAmount)) ||
      !hivePrice ||
      !hbdPrice
    )
      return "0";
    const amount = Number(convertAmount);
    const out =
      convertDirection === "HIVE_TO_HBD"
        ? (amount * hivePrice) / hbdPrice
        : (amount * hbdPrice) / hivePrice;
    return (out * 0.995).toFixed(3);
  }, [convertAmount, convertDirection, hivePrice, hbdPrice]);

  const handleSwapDirection = () => {
    setConvertDirection((p) =>
      p === "HIVE_TO_HBD" ? "HBD_TO_HIVE" : "HIVE_TO_HBD",
    );
    setConvertAmount("");
  };

  const handleConvert = async () => {
    if (
      !user ||
      !convertAmount ||
      isNaN(Number(convertAmount)) ||
      Number(convertAmount) <= 0
    ) {
      toast({
        title: t("forms.errors.invalidAmount"),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    const amount = Number(convertAmount);
    if (amount > fromBalance) {
      toast({
        title: t("wallet.insufficientBalance"),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }
    setIsConverting(true);
    try {
      const operation =
        convertDirection === "HBD_TO_HIVE"
          ? [
              "convert",
              {
                owner: user,
                requestid: Math.floor(1e9 + Math.random() * 9e9),
                amount: `${amount.toFixed(3)} HBD`,
              },
            ]
          : [
              "collateralized_convert",
              {
                owner: user,
                requestid: Math.floor(1e9 + Math.random() * 9e9),
                amount: `${amount.toFixed(3)} HIVE`,
              },
            ];
      await aioha.signAndBroadcastTx([operation], KeyTypes.Active);
      toast({
        title: t("wallet.conversionInitiated"),
        status: "success",
        duration: 5000,
        isClosable: true,
      });
      setConvertAmount("");
    } catch {
      toast({
        title: t("wallet.conversionFailed"),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsConverting(false);
    }
  };

  const canConvert =
    !!user &&
    !!convertAmount &&
    !isNaN(Number(convertAmount)) &&
    Number(convertAmount) > 0 &&
    Number(convertAmount) <= fromBalance &&
    !isConverting &&
    !isPriceLoading &&
    !!hivePrice &&
    !!hbdPrice;

  return (
    <VStack spacing={0} align="stretch">
      <Box border="1px solid" borderColor="border" p={3} mb={1}>
        <Text
          fontSize="xs"
          color="dim"
          fontFamily="mono"
          textTransform="uppercase"
          letterSpacing="wider"
          mb={1}
        >
          You Pay
        </Text>
        <HStack>
          <HStack spacing={2} flex={1} minW={0}>
            <Image src={fromLogo} w="22px" h="22px" objectFit="contain" alt="" />
            <Input
              type="number"
              placeholder="0"
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
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
          <Text
            fontFamily="mono"
            fontWeight="bold"
            color="text"
            fontSize="sm"
            flexShrink={0}
          >
            {fromToken}
          </Text>
        </HStack>
        <Text fontSize="xs" color="dim" fontFamily="mono" mt={1}>
          {fromBalance.toFixed(3)} {fromToken} available
        </Text>
      </Box>

      <Box textAlign="center" py={1}>
        <IconButton
          aria-label="flip"
          icon={<FaExchangeAlt />}
          size="xs"
          variant="ghost"
          color="primary"
          onClick={handleSwapDirection}
          _hover={{ bg: "primary", color: "background" }}
          transition="all 0.2s"
        />
      </Box>

      <Box border="1px solid" borderColor="border" p={3} mb={3}>
        <Text
          fontSize="xs"
          color="dim"
          fontFamily="mono"
          textTransform="uppercase"
          letterSpacing="wider"
          mb={1}
        >
          You Receive
        </Text>
        <HStack>
          <HStack spacing={2} flex={1} minW={0}>
            <Image src={toLogo} w="22px" h="22px" objectFit="contain" alt="" />
            <Text
              fontSize="2xl"
              fontFamily="mono"
              fontWeight="black"
              color="primary"
            >
              {isPriceLoading ? "..." : estimatedOutput}
            </Text>
          </HStack>
          <Text
            fontFamily="mono"
            fontWeight="bold"
            color="text"
            fontSize="sm"
            flexShrink={0}
          >
            {toToken}
          </Text>
        </HStack>
        <Text fontSize="xs" color="dim" fontFamily="mono" mt={1}>
          {toBalance.toFixed(3)} {toToken} balance
        </Text>
      </Box>

      <Button
        w="100%"
        borderRadius="none"
        fontWeight="black"
        letterSpacing="widest"
        fontFamily="mono"
        colorScheme="green"
        size="md"
        sx={{ textTransform: "uppercase" }}
        leftIcon={isConverting ? <Spinner size="sm" /> : <FaExchangeAlt />}
        isDisabled={!canConvert}
        onClick={handleConvert}
      >
        {isConverting
          ? "Converting..."
          : isPriceLoading
            ? "Loading..."
            : "Convert"}
      </Button>

      {!user && (
        <Text
          fontSize="xs"
          color="dim"
          fontFamily="mono"
          textAlign="center"
          mt={2}
        >
          Connect Hive wallet to swap
        </Text>
      )}

      <Text fontSize="xs" mt={3} textAlign="center" fontFamily="mono">
        <a
          href={
            isMobile ? "https://hivedex.io/" : "https://hivehub.dev/market/swap"
          }
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: theme.colors.primary, textDecoration: "underline" }}
        >
          ...More Swap Options
        </a>
      </Text>
    </VStack>
  );
}

// ─── Unified wrapper ──────────────────────────────────────────────────────────
export default function UnifiedSwapSection(props: UnifiedSwapSectionProps) {
  const { isConnected } = useAccount();
  const { user: hiveUser } = useAioha();
  const { isAuthenticated: isFarcasterConnected, profile: farcasterProfile } =
    useFarcasterSession();

  // Self-fetch prices when not provided by parent (e.g. /swap page)
  const selfPrices = useMarketPrices();
  const hivePrice = props.hivePrice ?? selfPrices.hivePrice;
  const hbdPrice = props.hbdPrice ?? selfPrices.hbdPrice;
  const isPriceLoading = props.isPriceLoading ?? selfPrices.isPriceLoading;

  const hasHive = !!hiveUser;
  const farcasterVerifications = (farcasterProfile as any)?.verifications ?? [];
  const hasEVMLinked =
    isConnected || (isFarcasterConnected && farcasterVerifications.length > 0);

  const [mode, setMode] = useState<"hive" | "erc20">(() =>
    props.alwaysShowToggle ? "erc20" : hasHive ? "hive" : "erc20",
  );

  useEffect(() => {
    if (props.alwaysShowToggle) return;
    if (!hasHive && mode === "hive") setMode("erc20");
    if (!hasEVMLinked && !isConnected && mode === "erc20" && hasHive)
      setMode("hive");
  }, [hasHive, hasEVMLinked, isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  const showToggle = props.alwaysShowToggle || (hasHive && (hasEVMLinked || isConnected));

  return (
    <Box
      position="relative"
      border="2px solid"
      borderColor="primary"
      overflow="visible"
      width="100%"
      sx={shimmerStyles}
    >
      {showToggle ? (
        <HStack px={0} bg="primary" spacing={0}>
          <Button
            flex={1}
            size="sm"
            borderRadius="none"
            fontFamily="mono"
            fontWeight="black"
            letterSpacing="widest"
            fontSize="xs"
            textTransform="uppercase"
            bg={mode === "hive" ? "primary" : "transparent"}
            color="background"
            opacity={mode === "hive" ? 1 : 0.45}
            leftIcon={<FaHive />}
            onClick={() => setMode("hive")}
            _hover={{ opacity: 1 }}
            _active={{}}
          >
            Hive
          </Button>
          <Box w="1px" h="32px" bg="background" opacity={0.3} />
          <Button
            flex={1}
            size="sm"
            borderRadius="none"
            fontFamily="mono"
            fontWeight="black"
            letterSpacing="widest"
            fontSize="xs"
            textTransform="uppercase"
            bg={mode === "erc20" ? "primary" : "transparent"}
            color="background"
            opacity={mode === "erc20" ? 1 : 0.45}
            leftIcon={<FaExchangeAlt />}
            onClick={() => setMode("erc20")}
            _hover={{ opacity: 1 }}
            _active={{}}
          >
            ERC-20
          </Button>
        </HStack>
      ) : (
        <HStack px={3} py={2} bg="primary">
          {mode === "hive" ? (
            <FaHive color="var(--chakra-colors-background)" />
          ) : (
            <FaExchangeAlt color="var(--chakra-colors-background)" />
          )}
          <Text
            fontFamily="mono"
            fontWeight="black"
            fontSize="xs"
            color="background"
            textTransform="uppercase"
            letterSpacing="widest"
          >
            {mode === "hive" ? "Hive Swap" : "ERC-20 Swap"}
          </Text>
        </HStack>
      )}

      <Box px={3} py={3}>
        {mode === "hive" ? (
          <HiveSwapPanel
            hivePrice={hivePrice}
            hbdPrice={hbdPrice}
            isPriceLoading={isPriceLoading}
          />
        ) : (
          <ERC20SwapSection compact showFeeOption={props.showFeeOption} />
        )}
      </Box>
    </Box>
  );
}
