import { useState, useMemo } from "react";
import {
  Box,
  Text,
  Button,
  Input,
  IconButton,
  useBreakpointValue,
  HStack,
  VStack,
  useToast,
  Spinner,
  Image,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaExchangeAlt, FaHive } from "react-icons/fa";
import { useTheme } from "@/app/themeProvider";
import { useAioha } from "@aioha/react-ui";
import { KeyTypes } from "@aioha/aioha";
import { useHiveUser } from "@/contexts/UserContext";
import useHiveAccount from "@/hooks/useHiveAccount";
import { useWalletActions } from "@/hooks/useWalletActions";
import { extractNumber } from "@/lib/utils/extractNumber";
import { useTranslations } from "@/contexts/LocaleContext";

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

interface SwapSectionProps {
  hivePrice?: number | null;
  hbdPrice?: number | null;
  isPriceLoading?: boolean;
}

export default function SwapSection({
  hivePrice,
  hbdPrice,
  isPriceLoading = false,
}: SwapSectionProps) {
  const { theme } = useTheme();
  const { user, aioha } = useAioha();
  const { hiveUser } = useHiveUser();
  const { hiveAccount } = useHiveAccount(user || "");
  const { handleConfirm } = useWalletActions();
  const toast = useToast();
  const t = useTranslations();

  const [convertDirection, setConvertDirection] = useState<
    "HIVE_TO_HBD" | "HBD_TO_HIVE"
  >("HIVE_TO_HBD");
  const [convertAmount, setConvertAmount] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });

  // Get actual user balances from Hive account
  const balances = useMemo(() => {
    if (!hiveAccount) {
      return { hiveBalance: 0, hbdBalance: 0 };
    }

    const hiveBalance = hiveAccount.balance
      ? extractNumber(
          typeof hiveAccount.balance === "string"
            ? hiveAccount.balance
            : hiveAccount.balance.toString()
        )
      : 0;

    const hbdBalance = hiveAccount.hbd_balance
      ? extractNumber(
          typeof hiveAccount.hbd_balance === "string"
            ? hiveAccount.hbd_balance
            : hiveAccount.hbd_balance.toString()
        )
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

  const handleSwapDirection = () => {
    setConvertDirection((prev) =>
      prev === "HIVE_TO_HBD" ? "HBD_TO_HIVE" : "HIVE_TO_HBD"
    );
    setConvertAmount(""); // Clear amount when switching direction
  };

  const handleConvert = async () => {
    if (
      !user ||
      !convertAmount ||
      isNaN(Number(convertAmount)) ||
      Number(convertAmount) <= 0
    ) {
      toast({
        title: t('forms.errors.invalidAmount'),
        description: t('wallet.invalidConversion'),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const amount = Number(convertAmount);

    // Check if user has sufficient balance
    if (amount > fromBalance) {
      toast({
        title: t('wallet.insufficientBalance'),
        description: t('wallet.insufficientForConversion')
          .replace('{token1}', fromToken)
          .replace('{available}', fromBalance.toFixed(3))
          .replace('{token2}', fromToken),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    setIsConverting(true);
    try {
      let operation;

      if (convertDirection === "HBD_TO_HIVE") {
        // HBD to HIVE: Use convert operation
        operation = [
          "convert",
          {
            owner: user,
            requestid: Math.floor(1000000000 + Math.random() * 9000000000),
            amount: `${amount.toFixed(3)} HBD`,
          },
        ];
      } else {
        // HIVE to HBD: Use collateralized_convert operation
        operation = [
          "collateralized_convert",
          {
            owner: user,
            requestid: Math.floor(1000000000 + Math.random() * 9000000000),
            amount: `${amount.toFixed(3)} HIVE`,
          },
        ];
      }

      await aioha.signAndBroadcastTx([operation], KeyTypes.Active);

      toast({
        title: t('wallet.conversionInitiated'),
        description: t('wallet.conversionProcessing')
          .replace('{amount}', amount.toFixed(3))
          .replace('{from}', fromToken)
          .replace('{to}', toToken),
        status: "success",
        duration: 5000,
        isClosable: true,
      });

      setConvertAmount(""); // Clear the input after successful conversion
    } catch (error) {
      console.error("Conversion failed:", error);
      toast({
        title: t('wallet.conversionFailed'),
        description: t('wallet.conversionError'),
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setIsConverting(false);
    }
  };

  // Calculate estimated output based on actual market prices
  const estimatedOutput = useMemo(() => {
    if (!convertAmount || isNaN(Number(convertAmount))) return "0";
    if (!hivePrice || !hbdPrice) return "0";

    const amount = Number(convertAmount);

    // Convert based on actual market prices
    let outputAmount: number;
    if (convertDirection === "HIVE_TO_HBD") {
      // Converting HIVE to HBD: (HIVE amount * HIVE price) / HBD price
      outputAmount = (amount * hivePrice) / hbdPrice;
    } else {
      // Converting HBD to HIVE: (HBD amount * HBD price) / HIVE price
      outputAmount = (amount * hbdPrice) / hivePrice;
    }

    // Apply small conversion fee (approximately 0.5%)
    const feeRate = 0.005;
    const outputAmountWithFee = outputAmount * (1 - feeRate);

    return outputAmountWithFee.toFixed(3);
  }, [convertAmount, convertDirection, hivePrice, hbdPrice]);

  const fromLogo = fromToken === "HIVE" ? "/logos/hiveLogo.png" : "/logos/hbd_logo.png";
  const toLogo   = toToken   === "HIVE" ? "/logos/hiveLogo.png" : "/logos/hbd_logo.png";

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
    <Box
      position="relative"
      border="2px solid"
      borderColor="primary"
      overflow="hidden"
      width="100%"
      sx={{
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, transparent 0%, var(--chakra-colors-primary) 50%, transparent 100%)",
          backgroundSize: "200% auto",
          opacity: 0.06,
          animation: `${shimmer} 2.5s linear infinite`,
          pointerEvents: "none",
        },
      }}
    >
      {/* Header bar */}
      <HStack px={3} py={2} bg="primary" justify="space-between">
        <HStack spacing={2}>
          <FaHive color="var(--chakra-colors-background)" />
          <Text
            fontWeight="black"
            fontSize="sm"
            color="background"
            textTransform="uppercase"
            letterSpacing="widest"
            fontFamily="mono"
          >
            Hive Swap
          </Text>
        </HStack>
      </HStack>

      {/* Body */}
      <Box px={3} py={3}>
        <VStack spacing={0} align="stretch">
          {/* You Pay */}
          <Box border="1px solid" borderColor="border" p={3} mb={1}>
            <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>
              You Pay
            </Text>
            <HStack justify="space-between" align="center">
              <HStack spacing={2} flex={1}>
                <Image src={fromLogo} w="24px" h="24px" objectFit="contain" alt="" />
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
              <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="sm" flexShrink={0}>
                {fromToken}
              </Text>
            </HStack>
            <Text fontSize="xs" color="dim" fontFamily="mono" mt={1}>
              {fromBalance.toFixed(3)} {fromToken} available
            </Text>
          </Box>

          {/* Swap direction button */}
          <Box textAlign="center" py={1}>
            <IconButton
              aria-label={t('tooltips.swapDirection')}
              icon={<FaExchangeAlt />}
              onClick={handleSwapDirection}
              size="xs"
              variant="ghost"
              color="primary"
              _hover={{ color: "background", bg: "primary" }}
              transition="all 0.2s"
            />
          </Box>

          {/* You Receive */}
          <Box border="1px solid" borderColor="border" p={3} mb={3}>
            <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>
              You Receive
            </Text>
            <HStack justify="space-between" align="center">
              <HStack spacing={2} flex={1}>
                <Image src={toLogo} w="24px" h="24px" objectFit="contain" alt="" />
                <Text fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary">
                  {isPriceLoading ? "..." : estimatedOutput}
                </Text>
              </HStack>
              <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="sm" flexShrink={0}>
                {toToken}
              </Text>
            </HStack>
            <Text fontSize="xs" color="dim" fontFamily="mono" mt={1}>
              {toBalance.toFixed(3)} {toToken} balance
            </Text>
          </Box>

          <Button
            w="100%"
            colorScheme="green"
            borderRadius="none"
            fontWeight="black"
            letterSpacing="widest"
            fontFamily="mono"
            leftIcon={isConverting ? <Spinner size="sm" /> : <FaExchangeAlt />}
            isDisabled={!canConvert}
            onClick={handleConvert}
            size="md"
            sx={{ textTransform: "uppercase" }}
          >
            {isConverting ? "Converting..." : isPriceLoading ? "Loading..." : "Convert"}
          </Button>

          {!user && (
            <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" mt={2}>
              Connect Hive wallet to swap
            </Text>
          )}
        </VStack>

        <Text fontSize="xs" mt={3} textAlign="center" fontFamily="mono">
          <a
            href={isMobile ? "https://hivedex.io/" : "https://hivehub.dev/market/swap"}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: theme.colors.primary, textDecoration: "underline" }}
          >
            ...More Swap Options
          </a>
        </Text>
      </Box>
    </Box>
  );
}
