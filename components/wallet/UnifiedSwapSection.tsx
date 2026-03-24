"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box, Text, Button, Input, HStack, VStack, Image,
  Spinner, Tooltip, IconButton, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  InputGroup, InputLeftElement, useDisclosure,
  Divider,
} from "@chakra-ui/react";
import { FaSearch, FaChevronDown, FaCheck, FaExchangeAlt, FaHive, FaInfoCircle } from "react-icons/fa";
import { useAioha } from "@aioha/react-ui";
import { shimmerStyles } from "@/lib/utils/animations";
import { KeyTypes } from "@aioha/aioha";
import { useBreakpointValue } from "@chakra-ui/react";
import { useAccount, useChainId, useSendTransaction, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { useHiveUser } from "@/contexts/UserContext";
import useHiveAccount from "@/hooks/useHiveAccount";
import { useWalletActions } from "@/hooks/useWalletActions";
import { extractNumber } from "@/lib/utils/extractNumber";
import { useTranslations } from "@/contexts/LocaleContext";
import { useTheme } from "@/app/themeProvider";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";

// ─── ERC-20 token list ────────────────────────────────────────────────────────
const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const ERC20_ABI = [
  {
    name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
  },
] as const;

interface TokenInfo { symbol: string; address: string; decimals: number; logo?: string; }

const TOKENS_BY_CHAIN: Record<number, TokenInfo[]> = {
  8453: [
    { symbol: "ETH",    address: NATIVE,                                       decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "WETH",   address: "0x4200000000000000000000000000000000000006", decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "USDC",   address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6,  logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png" },
    { symbol: "DAI",    address: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", decimals: 18 },
    { symbol: "DEGEN",  address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed", decimals: 18, logo: "/logos/degen.png" },
    { symbol: "HIGHER", address: "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe", decimals: 18, logo: "/logos/higher.png" },
  ],
  1: [
    { symbol: "ETH",  address: NATIVE,                                         decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "WETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",   decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",   decimals: 6  },
    { symbol: "USDT", address: "0xdac17f958d2ee523a2206206994597c13d831ec7",   decimals: 6  },
    { symbol: "DAI",  address: "0x6b175474e89094c44da98b954eedeac495271d0f",   decimals: 18 },
  ],
  42161: [
    { symbol: "ETH",  address: NATIVE,                                         decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "WETH", address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",   decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "USDC", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",   decimals: 6  },
    { symbol: "ARB",  address: "0x912ce59144191c1204e64559fe8253a0e49e6548",   decimals: 18 },
  ],
};

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

// ─── Props ────────────────────────────────────────────────────────────────────
interface UnifiedSwapSectionProps {
  hivePrice?: number | null;
  hbdPrice?: number | null;
  isPriceLoading?: boolean;
}

// ─── Hive Swap panel ──────────────────────────────────────────────────────────
function HiveSwapPanel({ hivePrice, hbdPrice, isPriceLoading = false }: UnifiedSwapSectionProps) {
  const { theme } = useTheme();
  const { user, aioha } = useAioha();
  const { hiveAccount } = useHiveAccount(user || "");
  const toast = useToast();
  const t = useTranslations();
  const isMobile = useBreakpointValue({ base: true, md: false });

  const [convertDirection, setConvertDirection] = useState<"HIVE_TO_HBD" | "HBD_TO_HIVE">("HIVE_TO_HBD");
  const [convertAmount, setConvertAmount] = useState("");
  const [isConverting, setIsConverting] = useState(false);

  const balances = useMemo(() => {
    if (!hiveAccount) return { hiveBalance: 0, hbdBalance: 0 };
    const hiveBalance = hiveAccount.balance ? extractNumber(hiveAccount.balance.toString()) : 0;
    const hbdBalance  = hiveAccount.hbd_balance ? extractNumber(hiveAccount.hbd_balance.toString()) : 0;
    return { hiveBalance, hbdBalance };
  }, [hiveAccount]);

  const fromToken   = convertDirection === "HIVE_TO_HBD" ? "HIVE" : "HBD";
  const toToken     = convertDirection === "HIVE_TO_HBD" ? "HBD" : "HIVE";
  const fromBalance = convertDirection === "HIVE_TO_HBD" ? balances.hiveBalance : balances.hbdBalance;
  const toBalance   = convertDirection === "HIVE_TO_HBD" ? balances.hbdBalance : balances.hiveBalance;
  const fromLogo    = fromToken === "HIVE" ? "/logos/hiveLogo.png" : "/logos/hbd_logo.png";
  const toLogo      = toToken   === "HIVE" ? "/logos/hiveLogo.png" : "/logos/hbd_logo.png";

  const estimatedOutput = useMemo(() => {
    if (!convertAmount || isNaN(Number(convertAmount)) || !hivePrice || !hbdPrice) return "0";
    const amount = Number(convertAmount);
    const out = convertDirection === "HIVE_TO_HBD"
      ? (amount * hivePrice) / hbdPrice
      : (amount * hbdPrice) / hivePrice;
    return (out * 0.995).toFixed(3);
  }, [convertAmount, convertDirection, hivePrice, hbdPrice]);

  const handleSwapDirection = () => {
    setConvertDirection((p) => p === "HIVE_TO_HBD" ? "HBD_TO_HIVE" : "HIVE_TO_HBD");
    setConvertAmount("");
  };

  const handleConvert = async () => {
    if (!user || !convertAmount || isNaN(Number(convertAmount)) || Number(convertAmount) <= 0) {
      toast({ title: t("forms.errors.invalidAmount"), status: "error", duration: 3000, isClosable: true });
      return;
    }
    const amount = Number(convertAmount);
    if (amount > fromBalance) {
      toast({ title: t("wallet.insufficientBalance"), status: "error", duration: 3000, isClosable: true });
      return;
    }
    setIsConverting(true);
    try {
      const operation = convertDirection === "HBD_TO_HIVE"
        ? ["convert", { owner: user, requestid: Math.floor(1e9 + Math.random() * 9e9), amount: `${amount.toFixed(3)} HBD` }]
        : ["collateralized_convert", { owner: user, requestid: Math.floor(1e9 + Math.random() * 9e9), amount: `${amount.toFixed(3)} HIVE` }];
      await aioha.signAndBroadcastTx([operation], KeyTypes.Active);
      toast({ title: t("wallet.conversionInitiated"), status: "success", duration: 5000, isClosable: true });
      setConvertAmount("");
    } catch {
      toast({ title: t("wallet.conversionFailed"), status: "error", duration: 3000, isClosable: true });
    } finally {
      setIsConverting(false);
    }
  };

  const canConvert =
    !!user && !!convertAmount && !isNaN(Number(convertAmount)) &&
    Number(convertAmount) > 0 && Number(convertAmount) <= fromBalance &&
    !isConverting && !isPriceLoading && !!hivePrice && !!hbdPrice;

  return (
    <VStack spacing={0} align="stretch">
      <Box border="1px solid" borderColor="border" p={3} mb={1}>
        <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>You Pay</Text>
        <HStack>
          <HStack spacing={2} flex={1} minW={0}>
            <Image src={fromLogo} w="22px" h="22px" objectFit="contain" />
            <Input type="number" placeholder="0" value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary"
              variant="unstyled" flex={1} minW={0} _placeholder={{ color: "dim" }} />
          </HStack>
          <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="sm" flexShrink={0}>{fromToken}</Text>
        </HStack>
        <Text fontSize="xs" color="dim" fontFamily="mono" mt={1}>{fromBalance.toFixed(3)} {fromToken} available</Text>
      </Box>

      <Box textAlign="center" py={1}>
        <IconButton aria-label="flip" icon={<FaExchangeAlt />} size="xs" variant="ghost"
          color="primary" onClick={handleSwapDirection}
          _hover={{ bg: "primary", color: "background" }} transition="all 0.2s" />
      </Box>

      <Box border="1px solid" borderColor="border" p={3} mb={3}>
        <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>You Receive</Text>
        <HStack>
          <HStack spacing={2} flex={1} minW={0}>
            <Image src={toLogo} w="22px" h="22px" objectFit="contain" />
            <Text fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary">
              {isPriceLoading ? "..." : estimatedOutput}
            </Text>
          </HStack>
          <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="sm" flexShrink={0}>{toToken}</Text>
        </HStack>
        <Text fontSize="xs" color="dim" fontFamily="mono" mt={1}>{toBalance.toFixed(3)} {toToken} balance</Text>
      </Box>

      <Button w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest" fontFamily="mono"
        colorScheme="green" size="md" sx={{ textTransform: "uppercase" }}
        leftIcon={isConverting ? <Spinner size="sm" /> : <FaExchangeAlt />}
        isDisabled={!canConvert} onClick={handleConvert}>
        {isConverting ? "Converting..." : isPriceLoading ? "Loading..." : "Convert"}
      </Button>

      {!user && (
        <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" mt={2}>
          Connect Hive wallet to swap
        </Text>
      )}

      <Text fontSize="xs" mt={3} textAlign="center" fontFamily="mono">
        <a href={isMobile ? "https://hivedex.io/" : "https://hivehub.dev/market/swap"}
          target="_blank" rel="noopener noreferrer"
          style={{ color: theme.colors.primary, textDecoration: "underline" }}>
          ...More Swap Options
        </a>
      </Text>
    </VStack>
  );
}

// ─── Token Picker Modal ───────────────────────────────────────────────────────
interface TokenPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tokens: TokenInfo[];
  selected: TokenInfo;
  onSelect: (t: TokenInfo) => void;
  exclude?: string; // address to grey out
}

function TokenPickerModal({ isOpen, onClose, tokens, selected, onSelect, exclude }: TokenPickerModalProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return tokens;
    return tokens.filter(
      (t) => t.symbol.toLowerCase().includes(q) || t.address.toLowerCase().includes(q)
    );
  }, [query, tokens]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" isCentered>
      <ModalOverlay backdropFilter="blur(4px)" bg="blackAlpha.700" />
      <ModalContent
        bg="background"
        border="2px solid"
        borderColor="primary"
        borderRadius="none"
        mx={4}
      >
        <ModalHeader
          bg="primary"
          color="background"
          fontFamily="mono"
          fontWeight="black"
          fontSize="sm"
          textTransform="uppercase"
          letterSpacing="widest"
          px={4}
          py={3}
        >
          Select Token
        </ModalHeader>
        <ModalCloseButton color="background" top={2.5} />

        <ModalBody px={3} py={3}>
          {/* Search */}
          <InputGroup mb={3} size="sm">
            <InputLeftElement pointerEvents="none">
              <FaSearch color="var(--chakra-colors-dim)" />
            </InputLeftElement>
            <Input
              placeholder="Search by symbol or address…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              bg="muted"
              border="1px solid"
              borderColor="border"
              borderRadius="none"
              fontFamily="mono"
              fontSize="sm"
              color="text"
              _placeholder={{ color: "dim" }}
              _focus={{ borderColor: "primary", boxShadow: "none" }}
              autoFocus
            />
          </InputGroup>

          <Divider borderColor="border" mb={2} />

          {/* Token list */}
          <VStack spacing={0} align="stretch" maxH="260px" overflowY="auto"
            sx={{ "&::-webkit-scrollbar": { w: "4px" }, "&::-webkit-scrollbar-thumb": { bg: "border" } }}>
            {filtered.length === 0 && (
              <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" py={4}>
                No tokens found
              </Text>
            )}
            {filtered.map((t) => {
              const isSelected = t.address === selected.address;
              const isExcluded = t.address === exclude;
              return (
                <HStack
                  key={t.address}
                  px={3} py={2}
                  cursor={isExcluded ? "not-allowed" : "pointer"}
                  opacity={isExcluded ? 0.35 : 1}
                  bg={isSelected ? "muted" : "transparent"}
                  borderLeft="2px solid"
                  borderColor={isSelected ? "primary" : "transparent"}
                  _hover={isExcluded ? {} : { bg: "muted", borderColor: "primary" }}
                  transition="all 0.1s"
                  onClick={() => {
                    if (isExcluded) return;
                    onSelect(t);
                    setQuery("");
                    onClose();
                  }}
                >
                  {/* Logo */}
                  <Box w="32px" h="32px" flexShrink={0} display="flex" alignItems="center" justifyContent="center">
                    {t.logo ? (
                      <Image src={t.logo} w="28px" h="28px" objectFit="contain" borderRadius="full"
                        fallback={
                          <Box w="28px" h="28px" borderRadius="full" bg="border" display="flex"
                            alignItems="center" justifyContent="center">
                            <Text fontSize="xs" fontWeight="bold" color="text">{t.symbol[0]}</Text>
                          </Box>
                        }
                      />
                    ) : (
                      <Box w="28px" h="28px" borderRadius="full" bg="border" display="flex"
                        alignItems="center" justifyContent="center">
                        <Text fontSize="xs" fontWeight="bold" color="text">{t.symbol[0]}</Text>
                      </Box>
                    )}
                  </Box>

                  {/* Info */}
                  <VStack spacing={0} align="start" flex={1} minW={0}>
                    <Text fontSize="sm" fontWeight="black" fontFamily="mono" color="text">{t.symbol}</Text>
                    <Text fontSize="9px" color="dim" fontFamily="mono" noOfLines={1}>
                      {t.address === NATIVE ? "Native coin" : `${t.address.slice(0, 6)}…${t.address.slice(-4)}`}
                    </Text>
                  </VStack>

                  {/* Selected check */}
                  {isSelected && <FaCheck color="var(--chakra-colors-primary)" />}
                </HStack>
              );
            })}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// Token button — shows logo + symbol + chevron, opens picker modal
function TokenButton({ token, tokens, onSelect, exclude }: {
  token: TokenInfo;
  tokens: TokenInfo[];
  onSelect: (t: TokenInfo) => void;
  exclude?: string;
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        borderColor="border"
        borderRadius="none"
        fontFamily="mono"
        fontWeight="black"
        color="text"
        px={2}
        flexShrink={0}
        onClick={onOpen}
        leftIcon={
          token.logo ? (
            <Image src={token.logo} w="18px" h="18px" objectFit="contain" borderRadius="full"
              fallback={<Box w="18px" h="18px" borderRadius="full" bg="border" />} />
          ) : (
            <Box w="18px" h="18px" borderRadius="full" bg="border" display="flex" alignItems="center" justifyContent="center">
              <Text fontSize="8px" fontWeight="bold">{token.symbol[0]}</Text>
            </Box>
          )
        }
        rightIcon={<FaChevronDown size={10} />}
        _hover={{ borderColor: "primary", color: "primary" }}
      >
        {token.symbol}
      </Button>
      <TokenPickerModal
        isOpen={isOpen} onClose={onClose}
        tokens={tokens} selected={token} onSelect={onSelect} exclude={exclude}
      />
    </>
  );
}

// ─── ERC-20 Swap panel ────────────────────────────────────────────────────────
function ERC20SwapPanel() {
  const toast = useToast();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const tokens = useMemo(() => TOKENS_BY_CHAIN[chainId] ?? TOKENS_BY_CHAIN[8453], [chainId]);

  // Default: USDC → HIGHER on Base, ETH → USDC elsewhere
  const defaultSell = (list: TokenInfo[]) => list.find((t) => t.symbol === "USDC") ?? list[0];
  const defaultBuy  = (list: TokenInfo[]) => list.find((t) => t.symbol === "HIGHER") ?? list.find((t) => t.symbol === "USDC") ?? list[1];

  const [sellToken, setSellToken]   = useState<TokenInfo>(() => defaultSell(tokens));
  const [buyToken,  setBuyToken]    = useState<TokenInfo>(() => defaultBuy(tokens));
  const [sellAmount, setSellAmount] = useState("");
  const [price, setPrice]           = useState<any>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<`0x${string}` | null>(null);
  const [txHash, setTxHash]         = useState<`0x${string}` | undefined>();

  useEffect(() => {
    const list = TOKENS_BY_CHAIN[chainId] ?? TOKENS_BY_CHAIN[8453];
    setSellToken(defaultSell(list));
    setBuyToken(defaultBuy(list));
    setSellAmount(""); setPrice(null);
  }, [chainId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!sellAmount || isNaN(Number(sellAmount)) || Number(sellAmount) <= 0 || !address) {
      setPrice(null); return;
    }
    const timeout = setTimeout(async () => {
      setIsFetching(true);
      try {
        const rawAmount = parseUnits(sellAmount, sellToken.decimals).toString();
        const params = new URLSearchParams({ chainId: String(chainId), sellToken: sellToken.address, buyToken: buyToken.address, sellAmount: rawAmount, taker: address });
        const res = await fetch(`/api/0x/price?${params}`);
        const data = await res.json();
        setPrice(data);
        const spender = data?.issues?.allowance?.spender ?? data?.allowanceTarget;
        const needsAllow = sellToken.address !== NATIVE && !!data?.issues?.allowance && !!spender;
        setNeedsApproval(needsAllow);
        setApprovalTarget(needsAllow ? spender : null);
      } catch (e) { console.error("[0x price]", e); }
      finally { setIsFetching(false); }
    }, 600);
    return () => clearTimeout(timeout);
  }, [sellAmount, sellToken, buyToken, address, chainId]);

  const { writeContractAsync, isPending: isApproving } = useWriteContract();
  const handleApprove = useCallback(async () => {
    if (!approvalTarget) return;
    try {
      await writeContractAsync({ address: sellToken.address as `0x${string}`, abi: ERC20_ABI, functionName: "approve", args: [approvalTarget, maxUint256] });
      toast({ title: "Approval submitted", status: "info", duration: 5000, isClosable: true });
      setNeedsApproval(false);
    } catch (e: any) {
      toast({ title: "Approval failed", description: e?.shortMessage ?? e?.message, status: "error", duration: 4000, isClosable: true });
    }
  }, [approvalTarget, sellToken, writeContractAsync, toast]);

  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleSwap = useCallback(async () => {
    if (!address || !price?.liquidityAvailable) return;
    try {
      const rawAmount = parseUnits(sellAmount, sellToken.decimals).toString();
      const params = new URLSearchParams({ chainId: String(chainId), sellToken: sellToken.address, buyToken: buyToken.address, sellAmount: rawAmount, taker: address });
      const res = await fetch(`/api/0x/quote?${params}`);
      const quote = await res.json();
      if (!quote?.transaction) {
        toast({ title: "Quote failed", description: quote?.reason ?? "No transaction data", status: "error", duration: 4000, isClosable: true });
        return;
      }
      const hash = await sendTransactionAsync({
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: quote.transaction.value ? BigInt(quote.transaction.value) : undefined,
        gas: quote.transaction.gas ? BigInt(quote.transaction.gas) : undefined,
      });
      setTxHash(hash);
      toast({ title: "Swap submitted!", status: "success", duration: 6000, isClosable: true });
      setSellAmount(""); setPrice(null);
    } catch (e: any) {
      toast({ title: "Swap failed", description: e?.shortMessage ?? e?.message, status: "error", duration: 4000, isClosable: true });
    }
  }, [address, price, sellAmount, sellToken, buyToken, chainId, sendTransactionAsync, toast]);

  const estimatedOut = useMemo(() => {
    if (!price?.buyAmount) return "—";
    const val = parseFloat(formatUnits(BigInt(price.buyAmount), buyToken.decimals));
    return val < 0.0001 ? val.toExponential(4) : val.toFixed(6);
  }, [price, buyToken.decimals]);

  const networkFeeEth = useMemo(() => {
    if (!price?.totalNetworkFee) return null;
    return parseFloat(formatUnits(BigInt(price.totalNetworkFee), 18)).toFixed(6);
  }, [price]);

  const isLoading = isFetching || isSending || isApproving || isConfirming;
  const canSwap = isConnected && !!price?.liquidityAvailable && !needsApproval && !isLoading && !!sellAmount;

  const handleFlip = () => { setSellToken(buyToken); setBuyToken(sellToken); setSellAmount(""); setPrice(null); };

  return (
    <VStack spacing={0} align="stretch">
      {/* Sell */}
      <Box border="1px solid" borderColor="border" p={3} mb={1}>
        <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>You Pay</Text>
        <HStack>
          <Input type="number" placeholder="0" value={sellAmount} onChange={(e) => setSellAmount(e.target.value)}
            fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary" variant="unstyled" flex={1} minW={0} _placeholder={{ color: "dim" }} />
          <TokenButton token={sellToken} tokens={tokens} onSelect={setSellToken} exclude={buyToken.address} />
        </HStack>
      </Box>

      {/* Flip */}
      <Box textAlign="center" py={1}>
        <IconButton aria-label="flip" icon={<FaExchangeAlt style={{ transform: "rotate(90deg)" }} />} size="xs"
          variant="ghost" color="primary" onClick={handleFlip}
          _hover={{ bg: "primary", color: "background" }} transition="all 0.2s" />
      </Box>

      {/* Buy */}
      <Box border="1px solid" borderColor="border" p={3} mb={3}>
        <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>You Receive</Text>
        <HStack>
          <Text fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary" flex={1} minW={0}>
            {isFetching ? <Spinner size="sm" /> : estimatedOut}
          </Text>
          <TokenButton token={buyToken} tokens={tokens} onSelect={setBuyToken} exclude={sellToken.address} />
        </HStack>
      </Box>

      {/* Info */}
      {price && !isFetching && (
        <Box border="1px solid" borderColor="border" p={2} mb={3} fontSize="xs" fontFamily="mono">
          {networkFeeEth && <HStack justify="space-between" color="dim"><Text>Network fee</Text><Text color="text">{networkFeeEth} ETH</Text></HStack>}
          {price.fees?.integratorFee?.amount && (
            <HStack justify="space-between" color="dim">
              <Text>SkateHive fee (0.5%)</Text>
              <Text color="text">
                {parseFloat(formatUnits(BigInt(price.fees.integratorFee.amount), buyToken.decimals)).toFixed(4)} {buyToken.symbol}
              </Text>
            </HStack>
          )}
          {price.issues?.balance && <Text color="red.400" mt={1}>⚠ Insufficient {sellToken.symbol} balance</Text>}
          {!price.liquidityAvailable && <Text color="red.400" mt={1}>⚠ No liquidity for this pair</Text>}
          {isSuccess && <Text color="green.400" mt={1}>✓ Last swap confirmed!</Text>}
        </Box>
      )}

      {/* CTA */}
      {!isConnected ? (
        <Box border="1px solid" borderColor="border" p={3} textAlign="center">
          <Text fontSize="xs" color="dim" fontFamily="mono">Connect EVM wallet to swap</Text>
        </Box>
      ) : needsApproval ? (
        <Button w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest" fontFamily="mono"
          colorScheme="orange" size="md" sx={{ textTransform: "uppercase" }}
          isLoading={isApproving} loadingText="APPROVING..." onClick={handleApprove}>
          Approve {sellToken.symbol}
        </Button>
      ) : (
        <Button w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest" fontFamily="mono"
          colorScheme="green" size="md" sx={{ textTransform: "uppercase" }}
          isDisabled={!canSwap} isLoading={isSending || isConfirming}
          loadingText={isConfirming ? "CONFIRMING..." : "SWAPPING..."}
          leftIcon={<FaExchangeAlt />} onClick={handleSwap}>
          {!sellAmount ? "Enter Amount" : !price ? "..." : "Swap"}
        </Button>
      )}

      <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" mt={2}>
        Best price from 150+ sources
        <Tooltip label="Powered by 0x Protocol — aggregates 150+ DEXes">
          <Box as="span" ml={1} cursor="help"><FaInfoCircle style={{ display: "inline" }} /></Box>
        </Tooltip>
      </Text>
    </VStack>
  );
}

// ─── Unified wrapper ──────────────────────────────────────────────────────────
export default function UnifiedSwapSection(props: UnifiedSwapSectionProps) {
  const { isConnected } = useAccount();
  const { user: hiveUser } = useAioha();
  const { isAuthenticated: isFarcasterConnected, profile: farcasterProfile } = useFarcasterSession();

  const hasHive = !!hiveUser;
  // EVM is "available" if wagmi connected OR if Farcaster has verified EVM addresses
  const farcasterVerifications = (farcasterProfile as any)?.verifications ?? [];
  const hasEVMLinked = isConnected || (isFarcasterConnected && farcasterVerifications.length > 0);

  // Default mode based on what's linked
  const [mode, setMode] = useState<"hive" | "erc20">(() =>
    hasHive ? "hive" : "erc20"
  );

  // Auto-switch when connections change
  useEffect(() => {
    if (!hasHive && mode === "hive") setMode("erc20");
    if (!hasEVMLinked && !isConnected && mode === "erc20" && hasHive) setMode("hive");
  }, [hasHive, hasEVMLinked, isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show toggle only when both are available
  const showToggle = hasHive && (hasEVMLinked || isConnected);

  return (
    <Box
      position="relative"
      border="2px solid"
      borderColor="primary"
      overflow="hidden"
      width="100%"
      sx={shimmerStyles}
    >
      {showToggle ? (
        /* Header with toggle — only when both chains are connected */
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
        /* Single-chain header label */
        <HStack px={3} py={2} bg="primary">
          {mode === "hive" ? <FaHive color="var(--chakra-colors-background)" /> : <FaExchangeAlt color="var(--chakra-colors-background)" />}
          <Text fontFamily="mono" fontWeight="black" fontSize="xs" color="background" textTransform="uppercase" letterSpacing="widest">
            {mode === "hive" ? "Hive Swap" : "ERC-20 Swap"}
          </Text>
        </HStack>
      )}

      <Box px={3} py={3}>
        {mode === "hive"
          ? <HiveSwapPanel {...props} />
          : <ERC20SwapPanel />
        }
      </Box>
    </Box>
  );
}
