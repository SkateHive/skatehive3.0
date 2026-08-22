"use client";
import { useState, useEffect, useCallback, useMemo, useContext } from "react";
import {
  Box, Text, Button, Input, HStack, VStack,
  Spinner, Tooltip, useToast, Checkbox,
  InputGroup, InputRightElement, useDisclosure,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import { FaExchangeAlt, FaInfoCircle, FaChevronDown, FaCog } from "react-icons/fa";
import { useAccount, useBalance, useChainId, usePublicClient, useSendTransaction, useWaitForTransactionReceipt, useWriteContract, useSwitchChain } from "wagmi";
import { LIDO_ABI, LIDO_REFERRAL, LIDO_STETH, isLidoStake } from "@/lib/evm/lido";
import { parseUnits, formatUnits, formatEther, maxUint256, UserRejectedRequestError } from "viem";
import { PortfolioContext } from "@/contexts/PortfolioContext";
import TokenSelectorModal from "./TokenSelectorModal";
import TokenChainLogo from "./TokenChainLogo";
import {
  defaultPair, getSwapChain, isNativeToken, networkToChainId, type SwapToken,
} from "@/lib/evm/swapTokens";

const shimmer = keyframes`
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
`;

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

// ─── Token selector trigger ──────────────────────────────────────────────────

function SelectorTrigger({
  token,
  onSelect,
  excludeAddress,
  activeChainId,
  label,
}: {
  token: SwapToken;
  onSelect: (t: SwapToken) => void;
  excludeAddress?: string;
  activeChainId: number;
  label: string;
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  return (
    <>
      <Button
        h="44px"
        variant="outline"
        borderColor="border"
        borderRadius="none"
        bg="background"
        fontFamily="mono"
        fontWeight="black"
        fontSize="md"
        color="text"
        pl={2}
        pr={3}
        flexShrink={0}
        onClick={onOpen}
        aria-label={label}
        leftIcon={<TokenChainLogo token={token} size="28px" />}
        rightIcon={<FaChevronDown size={11} />}
        _hover={{ borderColor: "primary", color: "primary", bg: "muted" }}
        _active={{ bg: "muted" }}
        transition="all 0.12s"
      >
        {token.symbol}
      </Button>
      <TokenSelectorModal
        isOpen={isOpen}
        onClose={onClose}
        onSelect={onSelect}
        selectedAddress={token.address}
        excludeAddress={excludeAddress}
        activeChainId={activeChainId}
      />
    </>
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
  const { switchChain } = useSwitchChain();
  const { data: ethBalance } = useBalance({ address });

  const portfolioCtx = useContext(PortfolioContext);
  const portfolioTokens = portfolioCtx?.aggregatedPortfolio?.tokens;

  // ── Core state ──────────────────────────────────────────────────────────
  const [sellToken, setSellToken] = useState<SwapToken>(() => defaultPair(chainId).sell);
  const [buyToken, setBuyToken] = useState<SwapToken>(() => defaultPair(chainId).buy);
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

  // ── Lido direct stake (ETH → stETH on mainnet) ─────────────────────────
  const lidoStake = isLidoStake(sellToken, buyToken);
  const mainnetClient = usePublicClient({ chainId: 1 });

  // ── Shared state ────────────────────────────────────────────────────────
  const [isFetching, setIsFetching] = useState(false);

  // ── Balance of the currently selected sell token ─────────────────────────
  const sellBalance = useMemo(() => {
    if (isNativeToken(sellToken.address)) {
      return ethBalance ? parseFloat(formatEther(ethBalance.value)) : 0;
    }
    if (portfolioTokens) {
      for (const pt of portfolioTokens) {
        if (networkToChainId(pt.network ?? "") !== sellToken.chainId) continue;
        const addr = (pt.token?.address ?? pt.address ?? "").toLowerCase();
        if (addr === sellToken.address.toLowerCase()) return pt.token?.balance ?? 0;
      }
    }
    return 0;
  }, [sellToken, ethBalance, portfolioTokens]);

  const isNativeSell = isNativeToken(sellToken.address);

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

  // Realign tokens whenever the wallet chain changes and no longer matches
  // (e.g. the user switched network directly in their wallet).
  useEffect(() => {
    if (sellToken.chainId !== chainId || buyToken.chainId !== chainId) {
      const dp = defaultPair(chainId);
      setSellToken(dp.sell);
      setBuyToken(dp.buy);
      setSellAmount("");
      setPrice(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);

  // Pick a token; if it lives on another chain, switch the wallet network too.
  const selectToken = useCallback(
    async (side: "sell" | "buy", token: SwapToken) => {
      if (token.chainId === chainId) {
        if (side === "sell") setSellToken(token);
        else setBuyToken(token);
        setSellAmount("");
        setPrice(null);
        return;
      }
      // Cross-chain: set the whole pair for the new chain, then switch network.
      const dp = defaultPair(token.chainId);
      const sameAddr = (a: SwapToken) => a.address.toLowerCase() === token.address.toLowerCase();
      const other =
        side === "sell" ? (sameAddr(dp.buy) ? dp.sell : dp.buy) : (sameAddr(dp.sell) ? dp.buy : dp.sell);
      setSellToken(side === "sell" ? token : other);
      setBuyToken(side === "buy" ? token : other);
      setSellAmount("");
      setPrice(null);
      try {
        await switchChain({ chainId: token.chainId });
      } catch (e) {
        const back = defaultPair(chainId);
        setSellToken(back.sell);
        setBuyToken(back.buy);
        if (isUserRejection(e))
          toast({ title: "Network switch cancelled", status: "info", duration: 2000, isClosable: true });
        else
          toast({ title: "Could not switch network", description: friendlyError(e), status: "error", duration: 4000, isClosable: true });
      }
    },
    [chainId, switchChain, toast],
  );

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

        if (lidoStake) {
          // Direct Lido stake: 1 ETH → 1 stETH, no quote needed. We still
          // simulate submit() from the user's address so a paused/limited
          // staking queue shows up here instead of at signing time. The
          // simulation returns SHARES — ignore that number for display.
          let reason: string | null = null;
          try {
            await mainnetClient?.simulateContract({
              address: LIDO_STETH, abi: LIDO_ABI, functionName: "submit",
              args: [LIDO_REFERRAL], value: BigInt(rawAmount), account: address,
            });
          } catch (e) {
            // Only a contract revert means staking is unavailable. A transport
            // failure (public RPC down / rate-limited) must not block the stake.
            const names: string[] = [];
            for (let c: unknown = e; c && names.length < 6; c = (c as { cause?: unknown }).cause) names.push((c as { name?: string }).name ?? "");
            const transport = names.some((n) => /HttpRequestError|TimeoutError|RpcRequestError|TransportError/.test(n));
            if (transport) {
              console.warn("[swap] Lido pre-simulation skipped (RPC transport error):", friendlyError(e));
            } else {
              reason = friendlyError(e);
              console.error("[swap] Lido submit() simulation reverted:", e);
            }
          }
          setPrice({ lido: true, buyAmount: rawAmount, minBuyAmount: rawAmount, liquidityAvailable: !reason, lidoError: reason });
          setNeedsApproval(false);
          setApprovalTarget(null);
          return;
        }

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
          !isNativeToken(sellToken.address) &&
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
  }, [sellAmount, sellToken, buyToken, address, chainId, supportFee, slippageBps, lidoStake, mainnetClient]);

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

      if (lidoStake) {
        console.info(`[swap] Lido direct stake: submit(${LIDO_REFERRAL}) value=${rawAmount} from ${address}`);
        const hash = await writeContractAsync({
          address: LIDO_STETH, abi: LIDO_ABI, functionName: "submit",
          args: [LIDO_REFERRAL], value: BigInt(rawAmount), chainId: 1,
        });
        setTxHash(hash);
        toast({ title: "Stake submitted!", description: hash, status: "success", duration: 6000, isClosable: true });
        setSellAmount("");
        setPrice(null);
        return;
      }

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
  }, [address, price, sellAmount, sellToken, buyToken, chainId, supportFee, slippageBps, sendTransactionAsync, writeContractAsync, lidoStake, toast]);

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

  const routeLabel = `via 0x · ${getSwapChain(chainId)?.name ?? "Unknown"}`;

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

          {/* Sell + Flip + Buy (flip button overlaps the seam) */}
          <Box mb={3}>
            {/* Sell */}
            <Box
              border="1px solid"
              borderColor={insufficientBalance ? "red.400" : "border"}
              bg="muted"
              p={4}
            >
              <HStack justify="space-between" mb={2} align="center">
                <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider">
                  You Pay
                </Text>
                {isConnected && (
                  <HStack spacing={2}>
                    <Text fontSize="11px" color={insufficientBalance ? "red.400" : "dim"} fontFamily="mono">
                      Bal: {sellBalance < 0.0001 ? sellBalance.toExponential(2) : sellBalance < 1 ? sellBalance.toFixed(4) : sellBalance < 1000 ? sellBalance.toFixed(2) : Math.floor(sellBalance).toLocaleString()}
                    </Text>
                    <Button
                      size="xs" h="20px" px={1.5} variant="outline" borderColor="border" borderRadius="none"
                      color="primary" fontFamily="mono" fontSize="9px" fontWeight="black"
                      onClick={() => setAmountFromBalance(0.5)} isDisabled={sellBalance <= 0}
                      _hover={{ bg: "background", borderColor: "primary" }}
                    >
                      HALF
                    </Button>
                    <Button
                      size="xs" h="20px" px={1.5} variant="outline" borderColor="border" borderRadius="none"
                      color="primary" fontFamily="mono" fontSize="9px" fontWeight="black"
                      onClick={() => setAmountFromBalance(1)} isDisabled={sellBalance <= 0}
                      _hover={{ bg: "background", borderColor: "primary" }}
                    >
                      MAX
                    </Button>
                  </HStack>
                )}
              </HStack>
              <HStack spacing={3}>
                <HStack spacing={2.5} flex={1} minW={0}>
                  <TokenChainLogo token={sellToken} size="34px" />
                  <Input
                    type="number"
                    placeholder="0"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    fontSize="3xl"
                    fontFamily="mono"
                    fontWeight="black"
                    color="primary"
                    variant="unstyled"
                    flex={1}
                    minW={0}
                    h="44px"
                    _placeholder={{ color: "dim" }}
                  />
                </HStack>
                <SelectorTrigger
                  token={sellToken}
                  onSelect={(t) => selectToken("sell", t)}
                  excludeAddress={buyToken.address}
                  activeChainId={chainId}
                  label="Sell token"
                />
              </HStack>
            </Box>

            {/* Flip — square button punched into the seam between the two boxes */}
            <Box h="0" position="relative" zIndex={2} textAlign="center">
              <Button
                position="absolute" top="0" left="50%" transform="translate(-50%, -50%)"
                w="40px" h="40px" minW="40px" p={0}
                borderRadius="none"
                border="2px solid"
                borderColor="primary"
                bg="background"
                color="primary"
                onClick={handleFlip}
                aria-label="Flip tokens"
                _hover={{ bg: "primary", color: "background" }}
                _active={{ transform: "translate(-50%, -50%) scale(0.94)" }}
                transition="all 0.15s"
              >
                <FaExchangeAlt style={{ transform: "rotate(90deg)" }} />
              </Button>
            </Box>

            {/* Buy */}
            <Box border="1px solid" borderColor="border" bg="muted" p={4}>
              <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={2}>
                You Receive
              </Text>
              <HStack spacing={3}>
                <HStack spacing={2.5} flex={1} minW={0}>
                  <TokenChainLogo token={buyToken} size="34px" />
                  <Text fontSize="3xl" fontFamily="mono" fontWeight="black" color={estimatedOut === "—" ? "dim" : "primary"} isTruncated>
                    {isFetching ? <Spinner size="md" color="primary" /> : estimatedOut}
                  </Text>
                </HStack>
                <SelectorTrigger
                  token={buyToken}
                  onSelect={(t) => selectToken("buy", t)}
                  excludeAddress={sellToken.address}
                  activeChainId={chainId}
                  label="Buy token"
                />
              </HStack>
            </Box>
          </Box>

          {/* Swap details (rate, min received, fees) */}
          {!isFetching && exchangeRate && (
            <VStack spacing={1} align="stretch" border="1px solid" borderColor="border" p={2} mb={3} fontSize="xs" fontFamily="mono">
              {price?.lido && (
                <HStack justify="space-between" color="dim">
                  <Text>Route</Text>
                  <Text color="text">Lido direct stake — no slippage, no fee</Text>
                </HStack>
              )}
              <HStack justify="space-between" color="dim">
                <Text>Rate</Text>
                <Text color="text">1 {sellToken.symbol} = {exchangeRate} {buyToken.symbol}</Text>
              </HStack>
              {minReceived && !price?.lido && (
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
              {!price?.lido && (
                <HStack justify="space-between" color="dim">
                  <Text>Max slippage</Text>
                  <Text color="text">{slippagePct}%</Text>
                </HStack>
              )}
              {price?.lidoError && (
                <Text color="red.400">Lido staking unavailable: {price.lidoError}</Text>
              )}
              {networkFeeEth && (
                <HStack justify="space-between" color="dim">
                  <Text>Network fee</Text>
                  <Text color="text">{networkFeeEth} ETH</Text>
                </HStack>
              )}
              {price?.issues?.balance && (
                <Text color="red.400">Insufficient {sellToken.symbol} balance</Text>
              )}
              {price && !price.liquidityAvailable && !price.lido && (
                <Text color="red.400">No liquidity available for this pair</Text>
              )}
              {isSuccess && (
                <Text color="green.400">Last swap confirmed!</Text>
              )}
            </VStack>
          )}

          {/* CTA */}
          {!isConnected ? (
            <Box border="1px solid" borderColor="border" bg="muted" p={4} textAlign="center">
              <Text fontSize="xs" color="dim" fontFamily="mono">Connect EVM wallet to swap</Text>
            </Box>
          ) : needsApproval ? (
            <Button
              w="100%" h="54px" borderRadius="none" fontWeight="black" letterSpacing="widest"
              fontFamily="mono" fontSize="md" colorScheme="orange"
              sx={{ textTransform: "uppercase" }}
              isLoading={isApproving} loadingText="APPROVING..."
              onClick={handleApprove}
            >
              Approve {sellToken.symbol}
            </Button>
          ) : (
            <Button
              w="100%" h="54px" borderRadius="none" fontWeight="black" letterSpacing="widest"
              fontFamily="mono" fontSize="md" colorScheme="green"
              sx={{ textTransform: "uppercase" }}
              isDisabled={!canSwap}
              isLoading={isSending || isConfirming}
              loadingText={isConfirming ? "CONFIRMING..." : lidoStake ? "STAKING..." : "SWAPPING..."}
              leftIcon={<FaExchangeAlt />}
              onClick={handleSwap}
            >
              {!sellAmount ? "Enter Amount" : insufficientBalance ? `Insufficient ${sellToken.symbol}` : isFetching ? "..." : lidoStake ? "Stake with Lido" : "Swap"}
            </Button>
          )}

          {/* Optional platform fee */}
          {showFeeOption && !lidoStake && (
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

          {lidoStake ? (
            <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" mt={2}>
              Staked directly with Lido (stETH.submit) — 1 ETH mints 1 stETH
            </Text>
          ) : (
          <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" mt={2}>
            Best price from 150+ sources
            <Tooltip label="Powered by 0x Protocol — aggregates Uniswap, Curve, and 148+ other DEXes for best execution">
              <Box as="span" ml={1} cursor="help"><FaInfoCircle style={{ display: "inline" }} /></Box>
            </Tooltip>
          </Text>
          )}
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
