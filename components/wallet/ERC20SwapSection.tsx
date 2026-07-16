"use client";
import { useState, useEffect, useCallback, useMemo, useContext } from "react";
import {
  Box, Text, Button, Input, HStack, VStack, Image,
  Spinner, Tooltip, useToast, Checkbox,
  Modal, ModalOverlay, ModalContent, ModalBody, ModalCloseButton,
  InputGroup, InputLeftElement, InputRightElement, useDisclosure, Wrap, WrapItem,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaExchangeAlt, FaInfoCircle, FaSearch, FaChevronDown, FaCheck, FaCog } from "react-icons/fa";
import { useAccount, useBalance, useChainId, useSendTransaction, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { parseUnits, formatUnits, formatEther, maxUint256, UserRejectedRequestError } from "viem";
import { PortfolioContext } from "@/contexts/PortfolioContext";

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

// ─── Token Definitions ───────────────────────────────────────────────────────

const NATIVE = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
  logo?: string;
  name?: string;
  balance?: string;
}

const STANDARD_TOKENS_BY_CHAIN: Record<number, TokenInfo[]> = {
  // Base
  8453: [
    { symbol: "ETH",   address: NATIVE,                                        decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "WETH",  address: "0x4200000000000000000000000000000000000006",  decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "USDC",  address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",  decimals: 6,  logo: "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/base/assets/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913/logo.png" },
    { symbol: "DAI",   address: "0x50c5725949a6f0c72e6c4a641f24049a917db0cb",  decimals: 18 },
    { symbol: "DEGEN", address: "0x4ed4e862860bed51a9570b96d89af5e1b0efefed",  decimals: 18, logo: "/logos/degen.png" },
    { symbol: "HIGHER",address: "0x0578d8a44db98b23bf096a382e016e29a5ce0ffe",  decimals: 18, logo: "/logos/higher.png" },
  ],
  // Ethereum
  1: [
    { symbol: "ETH",  address: NATIVE,                                         decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "WETH", address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",   decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "USDC", address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",   decimals: 6 },
    { symbol: "USDT", address: "0xdac17f958d2ee523a2206206994597c13d831ec7",   decimals: 6 },
    { symbol: "DAI",  address: "0x6b175474e89094c44da98b954eedeac495271d0f",   decimals: 18 },
  ],
  // Arbitrum
  42161: [
    { symbol: "ETH",  address: NATIVE,                                         decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "WETH", address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",   decimals: 18, logo: "/logos/ethereum_logo.png" },
    { symbol: "USDC", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",   decimals: 6 },
    { symbol: "ARB",  address: "0x912ce59144191c1204e64559fe8253a0e49e6548",   decimals: 18 },
  ],
};

const CHAIN_NAMES: Record<number, string> = { 8453: "Base", 1: "Ethereum", 42161: "Arbitrum" };

// ─── Token Logo Helper ──────────────────────────────────────────────────────

function TokenLogo({ token, size = "28px" }: { token: TokenInfo; size?: string }) {
  if (token.logo) {
    return (
      <Image src={token.logo} w={size} h={size} objectFit="contain" borderRadius="full" alt=""
        fallback={
          <Box w={size} h={size} borderRadius="full" bg="border" display="flex"
            alignItems="center" justifyContent="center">
            <Text fontSize="xs" fontWeight="bold" color="text">{token.symbol[0]}</Text>
          </Box>
        } />
    );
  }
  return (
    <Box w={size} h={size} borderRadius="full" bg="border" display="flex"
      alignItems="center" justifyContent="center">
      <Text fontSize="xs" fontWeight="bold" color="text">{token.symbol[0]}</Text>
    </Box>
  );
}

// ─── Token Row ──────────────────────────────────────────────────────────────

function TokenRow({ token, isSelected, isExcluded, onClick }: {
  token: TokenInfo;
  isSelected: boolean;
  isExcluded: boolean;
  onClick: () => void;
}) {
  const bal = token.balance ? parseFloat(token.balance) : null;
  return (
    <HStack
      px={3} py={2.5}
      cursor={isExcluded ? "not-allowed" : "pointer"}
      opacity={isExcluded ? 0.3 : 1}
      bg={isSelected ? "muted" : "transparent"}
      borderLeft="2px solid"
      borderColor={isSelected ? "primary" : "transparent"}
      _hover={isExcluded ? {} : { bg: "muted", borderColor: "primary" }}
      transition="all 0.1s"
      onClick={onClick}
      spacing={3}
    >
      <TokenLogo token={token} size="32px" />
      <VStack spacing={0} align="start" flex={1} minW={0}>
        <HStack spacing={1}>
          <Text fontSize="sm" fontWeight="black" fontFamily="mono" color="text" isTruncated>
            {token.symbol}
          </Text>
          {token.name && token.name !== token.symbol && (
            <Text fontSize="xs" color="dim" fontFamily="mono" isTruncated>
              {token.name}
            </Text>
          )}
        </HStack>
        <Text fontSize="9px" color="dim" fontFamily="mono" noOfLines={1}>
          {token.address === NATIVE ? "Native coin" : `${token.address.slice(0, 6)}...${token.address.slice(-4)}`}
        </Text>
      </VStack>
      <VStack spacing={0} align="end" flexShrink={0}>
        {bal !== null && bal > 0 ? (
          <Text fontSize="xs" fontFamily="mono" fontWeight="bold" color="text">
            {bal < 0.0001 ? bal.toExponential(2) : bal < 1 ? bal.toFixed(4) : bal < 1000 ? bal.toFixed(2) : Math.floor(bal).toLocaleString()}
          </Text>
        ) : isSelected ? (
          <FaCheck color="var(--chakra-colors-primary)" size={12} />
        ) : null}
      </VStack>
    </HStack>
  );
}

// ─── Token Picker (Matcha-style modal) ──────────────────────────────────────

const POPULAR_SYMBOLS = ["ETH", "USDC", "DEGEN", "HIGHER"];

function TokenPicker({
  selected,
  tokens,
  onSelect,
  label,
  exclude,
}: {
  selected: TokenInfo;
  tokens: TokenInfo[];
  onSelect: (t: TokenInfo) => void;
  label: string;
  exclude?: string;
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [query, setQuery] = useState("");

  const popular = useMemo(
    () => tokens.filter((t) => POPULAR_SYMBOLS.includes(t.symbol)),
    [tokens],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return tokens;
    return tokens.filter(
      (t) =>
        t.symbol.toLowerCase().includes(q) ||
        (t.name?.toLowerCase().includes(q)) ||
        t.address.toLowerCase().includes(q),
    );
  }, [query, tokens]);

  const handleSelect = (t: TokenInfo) => {
    if (t.address === exclude) return;
    onSelect(t);
    setQuery("");
    onClose();
  };

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
        leftIcon={<TokenLogo token={selected} size="18px" />}
        rightIcon={<FaChevronDown size={10} />}
        _hover={{ borderColor: "primary", color: "primary" }}
        aria-label={label}
      >
        {selected.symbol}
      </Button>

      <Modal isOpen={isOpen} onClose={() => { setQuery(""); onClose(); }} size="md" isCentered>
        <ModalOverlay backdropFilter="blur(6px)" bg="blackAlpha.700" />
        <ModalContent
          bg="background"
          border="2px solid"
          borderColor="primary"
          borderRadius="none"
          mx={4}
          maxH="85vh"
        >
          <ModalCloseButton color="dim" top={3} right={3} />
          <ModalBody px={0} py={0}>
            {/* Search */}
            <Box px={4} pt={4} pb={3}>
              <InputGroup size="lg">
                <InputLeftElement pointerEvents="none" h="100%">
                  <FaSearch color="var(--chakra-colors-dim)" />
                </InputLeftElement>
                <Input
                  placeholder="Search supported tokens by name or address"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  bg="muted"
                  border="1px solid"
                  borderColor="border"
                  borderRadius="none"
                  fontFamily="mono"
                  fontSize="sm"
                  color="text"
                  h="48px"
                  _placeholder={{ color: "dim" }}
                  _focus={{ borderColor: "primary", boxShadow: "none" }}
                  autoFocus
                />
              </InputGroup>
            </Box>

            {/* Popular tokens row */}
            {!query && popular.length > 0 && (
              <Box px={4} pb={3}>
                <Text fontSize="10px" fontFamily="mono" color="dim" textTransform="uppercase"
                  letterSpacing="wider" mb={2}>
                  Popular
                </Text>
                <Wrap spacing={2}>
                  {popular.map((t) => {
                    const isSel = t.address === selected.address;
                    const isExcl = t.address === exclude;
                    return (
                      <WrapItem key={t.address}>
                        <Button
                          size="sm"
                          variant="outline"
                          borderColor={isSel ? "primary" : "border"}
                          borderRadius="full"
                          fontFamily="mono"
                          fontWeight="bold"
                          fontSize="xs"
                          color={isSel ? "primary" : "text"}
                          opacity={isExcl ? 0.3 : 1}
                          cursor={isExcl ? "not-allowed" : "pointer"}
                          leftIcon={<TokenLogo token={t} size="16px" />}
                          onClick={() => handleSelect(t)}
                          _hover={isExcl ? {} : { borderColor: "primary", bg: "muted" }}
                          h="32px"
                          px={3}
                        >
                          {t.symbol}
                        </Button>
                      </WrapItem>
                    );
                  })}
                </Wrap>
              </Box>
            )}

            {/* Divider */}
            <Box h="1px" bg="border" />

            {/* Token list */}
            <VStack
              spacing={0}
              align="stretch"
              maxH="400px"
              overflowY="auto"
              sx={{
                "&::-webkit-scrollbar": { w: "4px" },
                "&::-webkit-scrollbar-thumb": { bg: "border", borderRadius: "2px" },
              }}
            >
              {filtered.length > 0 && (
                <Text fontSize="10px" fontFamily="mono" color="dim" textTransform="uppercase"
                  letterSpacing="wider" px={4} pt={3} pb={1}>
                  Tokens
                </Text>
              )}
              {filtered.map((t) => (
                <TokenRow
                  key={t.address}
                  token={t}
                  isSelected={t.address === selected.address}
                  isExcluded={t.address === exclude}
                  onClick={() => handleSelect(t)}
                />
              ))}

              {/* No results */}
              {query && filtered.length === 0 && (
                <Box py={6} textAlign="center">
                  <Text fontSize="xs" color="dim" fontFamily="mono">No tokens found</Text>
                </Box>
              )}
            </VStack>
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}

// ─── Error helpers ──────────────────────────────────────────────────────────

function isUserRejection(e: unknown): boolean {
  if (e instanceof UserRejectedRequestError) return true;
  const text = `${(e as { shortMessage?: string })?.shortMessage ?? ""} ${(e as { message?: string })?.message ?? ""}`.toLowerCase();
  return text.includes("user denied") || text.includes("user rejected");
}

function friendlyError(e: unknown): string {
  return (
    (e as { shortMessage?: string })?.shortMessage ||
    (e instanceof Error ? e.message : null) ||
    "Unknown error"
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ERC20SwapSectionProps {
  /** Show the "support Skatehive" fee checkbox. Default false. */
  showFeeOption?: boolean;
  /** Render without outer border/header (for embedding inside another wrapper). */
  compact?: boolean;
}

export default function ERC20SwapSection({ showFeeOption = false, compact = false }: ERC20SwapSectionProps) {
  const toast = useToast();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: ethBalance } = useBalance({ address });

  // ── Build unified token list ────────────────────────────────────────────
  const standardTokens = useMemo(
    () => STANDARD_TOKENS_BY_CHAIN[chainId] ?? STANDARD_TOKENS_BY_CHAIN[8453],
    [chainId],
  );

  // Use portfolio balances (already fetched by PortfolioProvider) — safe when outside provider
  const portfolioCtx = useContext(PortfolioContext);
  const portfolioTokens = portfolioCtx?.aggregatedPortfolio?.tokens;

  const allTokens = useMemo(() => {
    const ethBal = ethBalance ? formatEther(ethBalance.value) : undefined;

    // Build a quick lookup: lowercase address → balance number
    const balanceMap = new Map<string, number>();
    if (portfolioTokens) {
      for (const pt of portfolioTokens) {
        const addr = (pt.token?.address ?? pt.address ?? "").toLowerCase();
        const bal = pt.token?.balance ?? 0;
        if (addr && bal > 0) balanceMap.set(addr, bal);
      }
    }

    return standardTokens.map((t) => {
      // ETH: use wagmi balance (more accurate/realtime)
      if (t.address === NATIVE) {
        return ethBal ? { ...t, balance: ethBal } : t;
      }
      // ERC-20: use portfolio API balance
      const bal = balanceMap.get(t.address.toLowerCase());
      return bal ? { ...t, balance: String(bal) } : t;
    });
  }, [standardTokens, ethBalance, portfolioTokens]);

  // ── Core state ──────────────────────────────────────────────────────────
  const [sellToken, setSellToken] = useState<TokenInfo>(standardTokens[0]);
  const [buyToken, setBuyToken] = useState<TokenInfo>(standardTokens[2] ?? standardTokens[1]);
  const [sellAmount, setSellAmount] = useState("");
  const [supportFee, setSupportFee] = useState(true);

  // ── Slippage tolerance (basis points) ───────────────────────────────────
  const [slippageBps, setSlippageBps] = useState(100); // 1% default
  const [customSlippage, setCustomSlippage] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  // ── 0x-specific state ──────────────────────────────────────────────────
  const [price, setPrice] = useState<any>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalTarget, setApprovalTarget] = useState<`0x${string}` | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

  // ── Shared state ────────────────────────────────────────────────────────
  const [isFetching, setIsFetching] = useState(false);

  // ── Balance of the currently selected sell token (from enriched list) ────
  const sellBalance = useMemo(() => {
    const match = allTokens.find(
      (t) => t.address.toLowerCase() === sellToken.address.toLowerCase(),
    );
    return match?.balance ? parseFloat(match.balance) : 0;
  }, [allTokens, sellToken]);

  const isNativeSell = sellToken.address === NATIVE;

  const setAmountFromBalance = useCallback(
    (fraction: number) => {
      if (sellBalance <= 0) return;
      let amount = sellBalance * fraction;
      // Leave a little ETH for gas when spending the full native balance
      if (isNativeSell && fraction >= 1) amount = Math.max(0, amount - 0.0002);
      if (amount <= 0) return;
      setSellAmount(String(Number(amount.toFixed(sellToken.decimals > 8 ? 8 : sellToken.decimals))));
      setPrice(null);
    },
    [sellBalance, isNativeSell, sellToken.decimals],
  );

  const insufficientBalance =
    !!sellAmount && parseFloat(sellAmount) > 0 && parseFloat(sellAmount) > sellBalance;

  // Reset tokens when chain changes
  useEffect(() => {
    const list = STANDARD_TOKENS_BY_CHAIN[chainId] ?? STANDARD_TOKENS_BY_CHAIN[8453];
    setSellToken(list[0]);
    setBuyToken(list[2] ?? list[1]);
    setSellAmount("");
    setPrice(null);
  }, [chainId]);

  // ── Debounced quote fetch (0x Protocol) ───────────────────────────────
  useEffect(() => {
    if (!sellAmount || isNaN(Number(sellAmount)) || Number(sellAmount) <= 0 || !address) {
      setPrice(null);
      return;
    }

    const timeout = setTimeout(async () => {
      setIsFetching(true);
      try {
        const rawAmount = parseUnits(sellAmount, sellToken.decimals).toString();
        const params = new URLSearchParams({
          chainId: String(chainId),
          sellToken: sellToken.address,
          buyToken: buyToken.address,
          sellAmount: rawAmount,
          taker: address,
          slippageBps: String(slippageBps),
        });
        if (supportFee) params.set("fee", "1");
        const res = await fetch(`/api/0x/price?${params}`);
        const data = await res.json();
        setPrice(data);

        const spender = data?.issues?.allowance?.spender ?? data?.allowanceTarget;
        const needsAllow =
          sellToken.address !== NATIVE &&
          !!data?.issues?.allowance &&
          !!spender;
        setNeedsApproval(needsAllow);
        setApprovalTarget(needsAllow ? spender : null);
      } catch (e) {
        console.error("[swap quote]", e);
      } finally {
        setIsFetching(false);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [sellAmount, sellToken, buyToken, address, chainId, supportFee, slippageBps]);

  // ── Approval (0x only) ────────────────────────────────────────────────
  const { writeContractAsync, isPending: isApproving } = useWriteContract();
  const handleApprove = useCallback(async () => {
    if (!approvalTarget) return;
    try {
      const hash = await writeContractAsync({
        address: sellToken.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [approvalTarget, maxUint256],
      });
      toast({ title: "Approval submitted", description: hash, status: "info", duration: 5000, isClosable: true });
      setNeedsApproval(false);
    } catch (e: unknown) {
      if (isUserRejection(e))
        toast({ title: "Transaction cancelled", status: "info", duration: 2000, isClosable: true });
      else
        toast({ title: "Approval failed", description: friendlyError(e), status: "error", duration: 4000, isClosable: true });
    }
  }, [approvalTarget, sellToken, writeContractAsync, toast]);

  // ── Swap execution ────────────────────────────────────────────────────
  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const handleSwap = useCallback(async () => {
    if (!address) return;
    if (!price?.liquidityAvailable) return;
    try {
      const rawAmount = parseUnits(sellAmount, sellToken.decimals).toString();
      const params = new URLSearchParams({
        chainId: String(chainId),
        sellToken: sellToken.address,
        buyToken: buyToken.address,
        sellAmount: rawAmount,
        taker: address,
        slippageBps: String(slippageBps),
      });
      if (supportFee) params.set("fee", "1");
      const res = await fetch(`/api/0x/quote?${params}`);
      const quote = await res.json();

      if (!quote?.transaction) {
        toast({ title: "Quote failed", description: quote?.reason ?? "No transaction data", status: "error", duration: 4000, isClosable: true });
        return;
      }

      const tx = quote.transaction;
      const hash = await sendTransactionAsync({
        to: tx.to as `0x${string}`,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value ?? 0),
        gas: tx.gas != null ? BigInt(tx.gas) : undefined,
        chainId,
      });

      setTxHash(hash);
      toast({ title: "Swap submitted!", description: hash, status: "success", duration: 6000, isClosable: true });
      setSellAmount("");
      setPrice(null);
    } catch (e: unknown) {
      if (isUserRejection(e))
        toast({ title: "Transaction cancelled", status: "info", duration: 2000, isClosable: true });
      else
        toast({ title: "Swap failed", description: friendlyError(e), status: "error", duration: 4000, isClosable: true });
    }
  }, [address, price, sellAmount, sellToken, buyToken, chainId, supportFee, slippageBps, sendTransactionAsync, toast]);

  // ── Derived display values ────────────────────────────────────────────
  const estimatedOut = useMemo(() => {
    if (!price?.buyAmount) return "—";
    const val = parseFloat(formatUnits(BigInt(price.buyAmount), buyToken.decimals));
    return val < 0.0001 ? val.toExponential(4) : val.toFixed(6);
  }, [price, buyToken.decimals]);

  const networkFeeEth = useMemo(() => {
    if (!price?.totalNetworkFee) return null;
    const eth = parseFloat(formatUnits(BigInt(price.totalNetworkFee), 18));
    return eth.toFixed(6);
  }, [price]);

  // Minimum received after slippage (0x returns minBuyAmount)
  const minReceived = useMemo(() => {
    if (!price?.minBuyAmount) return null;
    const val = parseFloat(formatUnits(BigInt(price.minBuyAmount), buyToken.decimals));
    return val < 0.0001 ? val.toExponential(4) : val.toFixed(6);
  }, [price, buyToken.decimals]);

  // Exchange rate: 1 sellToken = X buyToken
  const exchangeRate = useMemo(() => {
    const inAmt = parseFloat(sellAmount);
    if (!inAmt || inAmt <= 0) return null;
    if (!price?.buyAmount) return null;
    const out = parseFloat(formatUnits(BigInt(price.buyAmount), buyToken.decimals));
    if (!out || isNaN(out)) return null;
    const rate = out / inAmt;
    return rate < 0.0001 ? rate.toExponential(3) : rate < 1 ? rate.toFixed(6) : rate.toFixed(4);
  }, [price, sellAmount, buyToken.decimals]);

  const slippagePct = (slippageBps / 100).toString();

  const isLoading = isFetching || isSending || isApproving || isConfirming;
  const canSwap =
    isConnected && !!price?.liquidityAvailable && !needsApproval && !isLoading && !!sellAmount && !insufficientBalance;

  const routeLabel = `via 0x · ${CHAIN_NAMES[chainId] ?? "Unknown"}`;

  const handleFlip = () => {
    const newSell = buyToken;
    const newBuy = sellToken;
    setSellToken(newSell);
    setBuyToken(newBuy);
    setSellAmount("");
    setPrice(null);
  };

  const SLIPPAGE_PRESETS = [50, 100, 300]; // 0.5% · 1% · 3%

  const swapBody = (
    <VStack spacing={0} align="stretch">

          {/* Settings bar: slippage tolerance */}
          <HStack justify="space-between" mb={1}>
            <Text fontSize="10px" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider">
              Slippage {slippagePct}%
            </Text>
            <Button
              size="xs"
              variant="ghost"
              color={showSettings ? "primary" : "dim"}
              fontFamily="mono"
              leftIcon={<FaCog />}
              onClick={() => setShowSettings((s) => !s)}
              _hover={{ color: "primary" }}
              h="20px"
              px={1}
            >
              <Text fontSize="10px">Settings</Text>
            </Button>
          </HStack>

          {showSettings && (
            <Box border="1px solid" borderColor="primary" p={3} mb={2} bg="background">
              <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={2}>
                Slippage tolerance
                <Tooltip label="Maximum price movement you'll accept before the swap reverts. Higher = more likely to fill on volatile/low-liquidity pairs, but worse worst-case price.">
                  <Box as="span" ml={1} cursor="help"><FaInfoCircle style={{ display: "inline" }} /></Box>
                </Tooltip>
              </Text>
              <HStack spacing={2}>
                {SLIPPAGE_PRESETS.map((bps) => {
                  const active = slippageBps === bps && !customSlippage;
                  return (
                    <Button
                      key={bps}
                      size="sm"
                      flex={1}
                      borderRadius="none"
                      fontFamily="mono"
                      fontWeight="bold"
                      fontSize="xs"
                      variant="outline"
                      borderColor={active ? "primary" : "border"}
                      color={active ? "primary" : "text"}
                      bg={active ? "muted" : "transparent"}
                      onClick={() => { setSlippageBps(bps); setCustomSlippage(""); }}
                      _hover={{ borderColor: "primary" }}
                    >
                      {bps / 100}%
                    </Button>
                  );
                })}
                <InputGroup size="sm" w="80px" flexShrink={0}>
                  <Input
                    placeholder="Custom"
                    value={customSlippage}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomSlippage(v);
                      const pct = parseFloat(v);
                      if (!isNaN(pct) && pct > 0 && pct <= 50) setSlippageBps(Math.round(pct * 100));
                    }}
                    type="number"
                    bg="muted"
                    border="1px solid"
                    borderColor={customSlippage ? "primary" : "border"}
                    borderRadius="none"
                    fontFamily="mono"
                    fontSize="xs"
                    color="text"
                    textAlign="right"
                    pr={5}
                    _placeholder={{ color: "dim" }}
                    _focus={{ borderColor: "primary", boxShadow: "none" }}
                  />
                  <InputRightElement pointerEvents="none" w={4}>
                    <Text fontSize="xs" color="dim" fontFamily="mono">%</Text>
                  </InputRightElement>
                </InputGroup>
              </HStack>
              {slippageBps >= 500 && (
                <Text fontSize="10px" color="orange.400" fontFamily="mono" mt={2}>
                  High slippage — your swap may be front-run.
                </Text>
              )}
            </Box>
          )}

          {/* Sell */}
          <Box border="1px solid" borderColor={insufficientBalance ? "red.400" : "border"} p={3} mb={1}>
            <HStack justify="space-between" mb={1} align="center">
              <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider">
                You Pay
              </Text>
              {isConnected && (
                <HStack spacing={2}>
                  <Text fontSize="10px" color={insufficientBalance ? "red.400" : "dim"} fontFamily="mono">
                    Bal: {sellBalance < 0.0001 ? sellBalance.toExponential(2) : sellBalance < 1 ? sellBalance.toFixed(4) : sellBalance < 1000 ? sellBalance.toFixed(2) : Math.floor(sellBalance).toLocaleString()}
                  </Text>
                  <Button
                    size="xs" h="16px" px={1} variant="ghost" color="primary" fontFamily="mono" fontSize="9px"
                    onClick={() => setAmountFromBalance(0.5)} isDisabled={sellBalance <= 0}
                    _hover={{ bg: "muted" }}
                  >
                    HALF
                  </Button>
                  <Button
                    size="xs" h="16px" px={1} variant="ghost" color="primary" fontFamily="mono" fontSize="9px"
                    onClick={() => setAmountFromBalance(1)} isDisabled={sellBalance <= 0}
                    _hover={{ bg: "muted" }}
                  >
                    MAX
                  </Button>
                </HStack>
              )}
            </HStack>
            <HStack>
              <HStack spacing={2} flex={1} minW={0}>
                {sellToken.logo && (
                  <Image src={sellToken.logo} w="22px" h="22px" objectFit="contain" borderRadius="full" alt=""
                    fallback={<Box w="22px" h="22px" borderRadius="full" bg="border" />} />
                )}
                <Input
                  type="number"
                  placeholder="0"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
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
              <TokenPicker
                selected={sellToken}
                tokens={allTokens}
                onSelect={(t) => { setSellToken(t); setSellAmount(""); setPrice(null); }}
                label="Sell token"
                exclude={buyToken.address}
              />
            </HStack>
          </Box>

          {/* Flip */}
          <Box textAlign="center" py={1}>
            <Button size="xs" variant="ghost" color="primary" onClick={handleFlip}
              _hover={{ bg: "primary", color: "background" }} transition="all 0.2s">
              <FaExchangeAlt style={{ transform: "rotate(90deg)" }} />
            </Button>
          </Box>

          {/* Buy */}
          <Box border="1px solid" borderColor="border" p={3} mb={3}>
            <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>
              You Receive
            </Text>
            <HStack>
              <HStack spacing={2} flex={1} minW={0}>
                {buyToken.logo && (
                  <Image src={buyToken.logo} w="22px" h="22px" objectFit="contain" borderRadius="full" alt=""
                    fallback={<Box w="22px" h="22px" borderRadius="full" bg="border" />} />
                )}
                <Text fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary">
                  {isFetching ? <Spinner size="sm" /> : estimatedOut}
                </Text>
              </HStack>
              <TokenPicker
                selected={buyToken}
                tokens={allTokens}
                onSelect={(t) => { setBuyToken(t); setSellAmount(""); setPrice(null); }}
                label="Buy token"
                exclude={sellToken.address}
              />
            </HStack>
          </Box>

          {/* Swap details (rate, min received, fees) */}
          {!isFetching && exchangeRate && (
            <VStack spacing={1} align="stretch" border="1px solid" borderColor="border" p={2} mb={3} fontSize="xs" fontFamily="mono">
              <HStack justify="space-between" color="dim">
                <Text>Rate</Text>
                <Text color="text">1 {sellToken.symbol} = {exchangeRate} {buyToken.symbol}</Text>
              </HStack>
              {minReceived && (
                <HStack justify="space-between" color="dim">
                  <HStack spacing={1}>
                    <Text>Min received</Text>
                    <Tooltip label={`After ${slippagePct}% max slippage`}>
                      <Box as="span" cursor="help"><FaInfoCircle style={{ display: "inline" }} /></Box>
                    </Tooltip>
                  </HStack>
                  <Text color="text">{minReceived} {buyToken.symbol}</Text>
                </HStack>
              )}
              <HStack justify="space-between" color="dim">
                <Text>Max slippage</Text>
                <Text color="text">{slippagePct}%</Text>
              </HStack>
              {networkFeeEth && (
                <HStack justify="space-between" color="dim">
                  <Text>Network fee</Text>
                  <Text color="text">{networkFeeEth} ETH</Text>
                </HStack>
              )}
              {price?.issues?.balance && (
                <Text color="red.400">Insufficient {sellToken.symbol} balance</Text>
              )}
              {price && !price.liquidityAvailable && (
                <Text color="red.400">No liquidity available for this pair</Text>
              )}
              {isSuccess && (
                <Text color="green.400">Last swap confirmed!</Text>
              )}
            </VStack>
          )}

          {/* CTA */}
          {!isConnected ? (
            <Box border="1px solid" borderColor="border" p={3} textAlign="center">
              <Text fontSize="xs" color="dim" fontFamily="mono">Connect EVM wallet to swap</Text>
            </Box>
          ) : needsApproval ? (
            <Button
              w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest"
              fontFamily="mono" colorScheme="orange" size="md"
              sx={{ textTransform: "uppercase" }}
              isLoading={isApproving} loadingText="APPROVING..."
              onClick={handleApprove}
            >
              Approve {sellToken.symbol}
            </Button>
          ) : (
            <Button
              w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest"
              fontFamily="mono" colorScheme="green" size="md"
              sx={{ textTransform: "uppercase" }}
              isDisabled={!canSwap}
              isLoading={isSending || isConfirming}
              loadingText={isConfirming ? "CONFIRMING..." : "SWAPPING..."}
              leftIcon={<FaExchangeAlt />}
              onClick={handleSwap}
            >
              {!sellAmount ? "Enter Amount" : insufficientBalance ? `Insufficient ${sellToken.symbol}` : isFetching ? "..." : "Swap"}
            </Button>
          )}

          {/* Optional platform fee */}
          {showFeeOption && (
            <HStack mt={2} spacing={2} justify="center">
              <Checkbox
                size="sm"
                colorScheme="green"
                isChecked={supportFee}
                onChange={(e) => setSupportFee(e.target.checked)}
              >
                <Text fontSize="xs" color="dim" fontFamily="mono">
                  Support Skatehive (0.5% fee)
                </Text>
              </Checkbox>
              <Tooltip label="A tiny 0.5% fee goes to the Skatehive platform split for skateparks, obstacles, rider sponsorships and public goods.">
                <Box as="span" cursor="help" color="dim"><FaInfoCircle style={{ display: "inline" }} /></Box>
              </Tooltip>
            </HStack>
          )}

          <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" mt={2}>
            Best price from 150+ sources
            <Tooltip label="Powered by 0x Protocol — aggregates Uniswap, Curve, and 148+ other DEXes for best execution">
              <Box as="span" ml={1} cursor="help"><FaInfoCircle style={{ display: "inline" }} /></Box>
            </Tooltip>
          </Text>
    </VStack>
  );

  if (compact) return swapBody;

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
      <HStack px={3} py={2} bg="primary" justify="space-between">
        <HStack spacing={2}>
          <FaExchangeAlt color="var(--chakra-colors-background)" />
          <Text fontWeight="black" fontSize="sm" color="background"
            textTransform="uppercase" letterSpacing="widest" fontFamily="mono">
            Swap
          </Text>
        </HStack>
        <Text fontSize="xs" color="background" fontFamily="mono" opacity={0.8}>
          {routeLabel}
        </Text>
      </HStack>
      <Box px={3} py={3}>
        {swapBody}
      </Box>
    </Box>
  );
}
