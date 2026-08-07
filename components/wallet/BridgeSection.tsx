"use client";

/**
 * Cross-chain bridge powered by LI.FI. Reuses the multi-chain TokenSelectorModal
 * for the from/to sides, fetches a route, handles ERC-20 approval, sends the
 * bridge transaction, and polls LI.FI for cross-chain completion.
 *
 * The integrator fee is applied server-side (see app/api/lifi/quote) and only
 * when LIFI_INTEGRATOR is configured, so this works with or without fee onboarding.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Button, HStack, Image, Input, Spinner, Text, Tooltip, VStack, useDisclosure, useToast,
} from "@chakra-ui/react";
import { FaArrowDown, FaInfoCircle } from "react-icons/fa";
import {
  formatUnits, parseUnits, maxUint256, UserRejectedRequestError, type Address,
} from "viem";
import {
  useAccount, useBalance, useChainId, usePublicClient, useSendTransaction,
  useSwitchChain, useWaitForTransactionReceipt, useWriteContract,
} from "wagmi";
import { PortfolioContext } from "@/contexts/PortfolioContext";
import { useTranslations } from "@/contexts/LocaleContext";
import TokenSelectorModal from "./TokenSelectorModal";
import {
  getSwapChain, isNativeToken, networkToChainId, tokensForChain, type SwapToken,
} from "@/lib/evm/swapTokens";
import { toLifiToken, type LifiQuote, type LifiStatus, type LifiStatusState } from "@/lib/evm/lifi";

const ERC20_ABI = [
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

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

function nativeOn(chainId: number): SwapToken {
  const list = tokensForChain(chainId);
  return list.find((t) => isNativeToken(t.address)) ?? list[0];
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 1) return "~instant";
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  return `~${Math.round(seconds / 60)}m`;
}

function fmtAmount(raw: string, decimals: number): string {
  const v = parseFloat(formatUnits(BigInt(raw), decimals));
  if (v === 0) return "0";
  if (v < 0.0001) return v.toExponential(4);
  return v.toFixed(6);
}

// ─── Token side trigger ──────────────────────────────────────────────────────

function SideSelector({
  token,
  onSelect,
}: {
  token: SwapToken;
  onSelect: (t: SwapToken) => void;
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
          <Image src={token.logo} w="18px" h="18px" objectFit="contain" borderRadius="full" alt=""
            fallback={<Box w="18px" h="18px" borderRadius="full" bg="border" />} />
        }
        _hover={{ borderColor: "primary", color: "primary" }}
      >
        {token.symbol}
      </Button>
      <TokenSelectorModal
        isOpen={isOpen}
        onClose={onClose}
        onSelect={onSelect}
        selectedAddress={token.address}
        activeChainId={token.chainId}
      />
    </>
  );
}

// ─── Bridge ──────────────────────────────────────────────────────────────────

export default function BridgeSection() {
  const t = useTranslations();
  const toast = useToast();
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: nativeBal } = useBalance({ address });

  const portfolioCtx = useContext(PortfolioContext);
  const portfolioTokens = portfolioCtx?.aggregatedPortfolio?.tokens;

  const [fromToken, setFromToken] = useState<SwapToken>(() => nativeOn(1)); // ETH mainnet
  const [toToken, setToToken] = useState<SwapToken>(() => nativeOn(8453)); // ETH Base
  const [amount, setAmount] = useState("");

  const [quote, setQuote] = useState<LifiQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalSpender, setApprovalSpender] = useState<Address | null>(null);

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [bridgeTool, setBridgeTool] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<LifiStatusState | null>(null);

  const fromClient = usePublicClient({ chainId: fromToken.chainId });
  const onFromChain = walletChainId === fromToken.chainId;

  // ── Balance of the from token ────────────────────────────────────────────
  const fromBalance = useMemo(() => {
    if (isNativeToken(fromToken.address) && onFromChain && nativeBal) {
      return parseFloat(formatUnits(nativeBal.value, nativeBal.decimals));
    }
    if (portfolioTokens) {
      for (const pt of portfolioTokens) {
        if (networkToChainId(pt.network ?? "") !== fromToken.chainId) continue;
        const addr = (pt.token?.address ?? pt.address ?? "").toLowerCase();
        const isNat = addr === "0x0000000000000000000000000000000000000000";
        if ((isNativeToken(fromToken.address) && isNat) || addr === fromToken.address.toLowerCase()) {
          return pt.token?.balance ?? 0;
        }
      }
    }
    return 0;
  }, [fromToken, onFromChain, nativeBal, portfolioTokens]);

  const insufficient = !!amount && parseFloat(amount) > 0 && parseFloat(amount) > fromBalance;

  const setMax = useCallback(() => {
    if (fromBalance <= 0) return;
    let amt = fromBalance;
    if (isNativeToken(fromToken.address)) amt = Math.max(0, amt - 0.0003); // gas headroom
    if (amt <= 0) return;
    setAmount(String(Number(amt.toFixed(fromToken.decimals > 8 ? 8 : fromToken.decimals))));
  }, [fromBalance, fromToken]);

  const sameToken =
    fromToken.chainId === toToken.chainId &&
    fromToken.address.toLowerCase() === toToken.address.toLowerCase();

  // ── Quote fetching ────────────────────────────────────────────────────────
  const buildParams = useCallback(() => {
    const p = new URLSearchParams({
      fromChain: String(fromToken.chainId),
      toChain: String(toToken.chainId),
      fromToken: toLifiToken(fromToken.address),
      toToken: toLifiToken(toToken.address),
      fromAmount: parseUnits(amount, fromToken.decimals).toString(),
      fromAddress: address ?? "",
      slippage: "0.005",
      order: "CHEAPEST",
      fee: "1", // opt into the integrator fee (applied server-side only if configured)
    });
    return p;
  }, [fromToken, toToken, amount, address]);

  useEffect(() => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0 || !address || sameToken) {
      setQuote(null);
      setQuoteError(null);
      return;
    }
    const timer = setTimeout(async () => {
      setIsFetching(true);
      setQuoteError(null);
      try {
        const res = await fetch(`/api/lifi/quote?${buildParams()}`);
        const data: LifiQuote = await res.json();
        if (!res.ok || !data?.estimate) {
          setQuote(null);
          setQuoteError(data?.message ?? t("bridge.noRoute"));
        } else {
          setQuote(data);
        }
      } catch (e) {
        setQuote(null);
        setQuoteError(friendlyError(e));
      } finally {
        setIsFetching(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [amount, address, sameToken, buildParams, t]);

  // ── Approval check ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!quote || isNativeToken(fromToken.address) || !address || !fromClient) {
      setNeedsApproval(false);
      return;
    }
    const spender = quote.estimate.approvalAddress as Address;
    let cancelled = false;
    fromClient
      .readContract({ address: fromToken.address as Address, abi: ERC20_ABI, functionName: "allowance", args: [address, spender] })
      .then((allow) => {
        if (cancelled) return;
        const raw = parseUnits(amount || "0", fromToken.decimals);
        setNeedsApproval((allow as bigint) < raw);
        setApprovalSpender(spender);
      })
      .catch(() => { if (!cancelled) setNeedsApproval(false); });
    return () => { cancelled = true; };
  }, [quote, fromToken, address, fromClient, amount]);

  // ── Approve ───────────────────────────────────────────────────────────────
  const { writeContractAsync, isPending: isApproving } = useWriteContract();
  const handleApprove = useCallback(async () => {
    if (!approvalSpender) return;
    try {
      const hash = await writeContractAsync({
        address: fromToken.address as Address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [approvalSpender, maxUint256],
        chainId: fromToken.chainId,
      });
      toast({ title: t("bridge.approvalSubmitted"), description: hash, status: "info", duration: 5000, isClosable: true });
      setNeedsApproval(false);
    } catch (e) {
      if (isUserRejection(e)) toast({ title: t("bridge.cancelled"), status: "info", duration: 2000, isClosable: true });
      else toast({ title: t("bridge.approvalFailed"), description: friendlyError(e), status: "error", duration: 4000, isClosable: true });
    }
  }, [approvalSpender, fromToken, writeContractAsync, toast, t]);

  // ── Execute bridge ────────────────────────────────────────────────────────
  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash: txHash, chainId: fromToken.chainId });

  const handleBridge = useCallback(async () => {
    if (!address) return;
    try {
      // Fetch a fresh quote at execution time so the tx isn't stale.
      const res = await fetch(`/api/lifi/quote?${buildParams()}`);
      const q: LifiQuote = await res.json();
      const tx = q?.transactionRequest;
      if (!res.ok || !tx) {
        toast({ title: t("bridge.noRoute"), description: q?.message, status: "error", duration: 4000, isClosable: true });
        return;
      }
      const hash = await sendTransactionAsync({
        to: tx.to as Address,
        data: tx.data as `0x${string}`,
        value: BigInt(tx.value ?? 0),
        gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
        chainId: fromToken.chainId,
      });
      setTxHash(hash);
      setBridgeTool(q.tool);
      setBridgeStatus("PENDING");
      toast({ title: t("bridge.submitted"), description: hash, status: "success", duration: 6000, isClosable: true });
      setAmount("");
      setQuote(null);
    } catch (e) {
      if (isUserRejection(e)) toast({ title: t("bridge.cancelled"), status: "info", duration: 2000, isClosable: true });
      else toast({ title: t("bridge.failed"), description: friendlyError(e), status: "error", duration: 4000, isClosable: true });
    }
  }, [address, buildParams, sendTransactionAsync, fromToken.chainId, toast, t]);

  // ── Cross-chain status polling ────────────────────────────────────────────
  const notifiedRef = useRef(false);
  useEffect(() => {
    if (!txHash || !bridgeTool) return;
    if (bridgeStatus === "DONE" || bridgeStatus === "FAILED") return;
    let cancelled = false;
    const poll = async () => {
      try {
        const p = new URLSearchParams({
          txHash,
          fromChain: String(fromToken.chainId),
          toChain: String(toToken.chainId),
          bridge: bridgeTool,
        });
        const res = await fetch(`/api/lifi/status?${p}`);
        const data: LifiStatus = await res.json();
        if (cancelled || !data?.status) return;
        setBridgeStatus(data.status);
        if (data.status === "DONE" && !notifiedRef.current) {
          notifiedRef.current = true;
          toast({ title: t("bridge.done"), status: "success", duration: 6000, isClosable: true });
        } else if (data.status === "FAILED" && !notifiedRef.current) {
          notifiedRef.current = true;
          toast({ title: t("bridge.failed"), status: "error", duration: 6000, isClosable: true });
        }
      } catch {
        /* keep polling */
      }
    };
    poll();
    const id = setInterval(poll, 6000);
    return () => { cancelled = true; clearInterval(id); };
  }, [txHash, bridgeTool, bridgeStatus, fromToken.chainId, toToken.chainId, toast, t]);

  // ── Derived display ──────────────────────────────────────────────────────
  const fromChainName = getSwapChain(fromToken.chainId)?.name ?? "?";
  const toChainName = getSwapChain(toToken.chainId)?.name ?? "?";
  const estOut = quote ? fmtAmount(quote.estimate.toAmount, toToken.decimals) : "—";
  const minOut = quote ? fmtAmount(quote.estimate.toAmountMin, toToken.decimals) : null;
  const totalCostUsd = useMemo(() => {
    if (!quote) return null;
    const fees = (quote.estimate.feeCosts ?? []).reduce((s, f) => s + (f.included ? 0 : Number(f.amountUSD ?? 0)), 0);
    const gas = (quote.estimate.gasCosts ?? []).reduce((s, g) => s + Number(g.amountUSD ?? 0), 0);
    const total = fees + gas;
    return total > 0 ? `$${total.toFixed(2)}` : null;
  }, [quote]);

  const handleFlip = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount("");
    setQuote(null);
  };

  const isBusy = isFetching || isSending || isApproving || isConfirming || isSwitching;
  const canBridge = isConnected && onFromChain && !!quote && !needsApproval && !insufficient && !isBusy && !!amount;

  return (
    <VStack spacing={0} align="stretch">
      {/* From */}
      <Box border="1px solid" borderColor={insufficient ? "red.400" : "border"} p={3} mb={1}>
        <HStack justify="space-between" mb={1}>
          <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider">
            {t("bridge.from")} · {fromChainName}
          </Text>
          {isConnected && (
            <HStack spacing={2}>
              <Text fontSize="10px" color={insufficient ? "red.400" : "dim"} fontFamily="mono">
                {t("bridge.balance")}: {fromBalance < 0.0001 ? fromBalance.toExponential(2) : fromBalance < 1 ? fromBalance.toFixed(4) : fromBalance.toFixed(2)}
              </Text>
              <Button size="xs" h="16px" px={1} variant="ghost" color="primary" fontFamily="mono" fontSize="9px"
                onClick={setMax} isDisabled={fromBalance <= 0} _hover={{ bg: "muted" }}>
                {t("bridge.max")}
              </Button>
            </HStack>
          )}
        </HStack>
        <HStack>
          <Input
            type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}
            fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary" variant="unstyled"
            flex={1} minW={0} _placeholder={{ color: "dim" }}
          />
          <SideSelector token={fromToken} onSelect={setFromToken} />
        </HStack>
      </Box>

      {/* Flip */}
      <Box textAlign="center" py={1}>
        <Button size="xs" variant="ghost" color="primary" onClick={handleFlip}
          _hover={{ bg: "primary", color: "background" }} transition="all 0.2s">
          <FaArrowDown />
        </Button>
      </Box>

      {/* To */}
      <Box border="1px solid" borderColor="border" p={3} mb={3}>
        <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>
          {t("bridge.to")} · {toChainName}
        </Text>
        <HStack>
          <Text fontSize="2xl" fontFamily="mono" fontWeight="black" color="primary" flex={1} minW={0} isTruncated>
            {isFetching ? <Spinner size="sm" /> : estOut}
          </Text>
          <SideSelector token={toToken} onSelect={setToToken} />
        </HStack>
      </Box>

      {/* Details */}
      {!isFetching && quote && (
        <VStack spacing={1} align="stretch" border="1px solid" borderColor="border" p={2} mb={3} fontSize="xs" fontFamily="mono">
          <HStack justify="space-between" color="dim">
            <Text>{t("bridge.route")}</Text>
            <Text color="text">{quote.toolDetails?.name ?? quote.tool}</Text>
          </HStack>
          <HStack justify="space-between" color="dim">
            <Text>{t("bridge.time")}</Text>
            <Text color="text">{fmtDuration(quote.estimate.executionDuration)}</Text>
          </HStack>
          {minOut && (
            <HStack justify="space-between" color="dim">
              <Text>{t("bridge.minReceived")}</Text>
              <Text color="text">{minOut} {toToken.symbol}</Text>
            </HStack>
          )}
          {totalCostUsd && (
            <HStack justify="space-between" color="dim">
              <Text>{t("bridge.fees")}</Text>
              <Text color="text">{totalCostUsd}</Text>
            </HStack>
          )}
        </VStack>
      )}

      {quoteError && !isFetching && (
        <Box border="1px solid" borderColor="border" p={2} mb={3}>
          <Text fontSize="xs" color="red.400" fontFamily="mono">{quoteError}</Text>
        </Box>
      )}

      {bridgeStatus && bridgeStatus !== "DONE" && bridgeStatus !== "FAILED" && (
        <HStack spacing={2} border="1px solid" borderColor="primary" p={2} mb={3}>
          <Spinner size="xs" color="primary" />
          <Text fontSize="xs" color="primary" fontFamily="mono">{t("bridge.pending")}</Text>
        </HStack>
      )}
      {bridgeStatus === "DONE" && (
        <Box border="1px solid" borderColor="border" p={2} mb={3}>
          <Text fontSize="xs" color="green.400" fontFamily="mono">{t("bridge.done")}</Text>
        </Box>
      )}

      {/* CTA */}
      {!isConnected ? (
        <Box border="1px solid" borderColor="border" p={3} textAlign="center">
          <Text fontSize="xs" color="dim" fontFamily="mono">{t("bridge.connectWallet")}</Text>
        </Box>
      ) : !onFromChain ? (
        <Button w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest" fontFamily="mono"
          colorScheme="orange" size="md" sx={{ textTransform: "uppercase" }} isLoading={isSwitching}
          onClick={() => switchChain({ chainId: fromToken.chainId })}>
          {t("bridge.switchTo").replace("{chain}", fromChainName)}
        </Button>
      ) : needsApproval ? (
        <Button w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest" fontFamily="mono"
          colorScheme="orange" size="md" sx={{ textTransform: "uppercase" }} isLoading={isApproving}
          loadingText={t("bridge.approving")} onClick={handleApprove}>
          {t("bridge.approve").replace("{symbol}", fromToken.symbol)}
        </Button>
      ) : (
        <Button w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest" fontFamily="mono"
          colorScheme="green" size="md" sx={{ textTransform: "uppercase" }} isDisabled={!canBridge}
          isLoading={isSending || isConfirming} loadingText={t("bridge.bridging")}
          leftIcon={<FaArrowDown />} onClick={handleBridge}>
          {!amount ? t("bridge.enterAmount") : insufficient ? t("bridge.insufficient").replace("{symbol}", fromToken.symbol) : isFetching ? "..." : t("bridge.bridge")}
        </Button>
      )}

      <Text fontSize="xs" color="dim" fontFamily="mono" textAlign="center" mt={2}>
        {t("bridge.poweredBy")}
        <Tooltip label={t("bridge.poweredByTip")}>
          <Box as="span" ml={1} cursor="help"><FaInfoCircle style={{ display: "inline" }} /></Box>
        </Tooltip>
      </Text>
    </VStack>
  );
}
