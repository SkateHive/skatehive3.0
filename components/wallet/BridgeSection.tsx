"use client";

/**
 * Cross-chain bridge powered by LI.FI. Reuses the multi-chain TokenSelectorModal
 * for the from/to sides, fetches a route, handles ERC-20 approval, sends the
 * bridge transaction, and polls LI.FI for cross-chain completion.
 *
 * The integrator fee is applied server-side (see app/api/lifi/quote) and only
 * when LIFI_INTEGRATOR is configured. When a quote comes back WITHOUT the fee
 * we warn loudly in the console — a bridge that works but doesn't charge is
 * indistinguishable from one that does, and that hid a missing env var for months.
 *
 * Tracking after send (see lib/evm/safeTx.ts): a Safe over WalletConnect
 * returns the safeTxHash, not an on-chain hash. We resolve it through the Safe
 * Transaction Service, show "waiting for signatures (x/y)" until executed, and
 * only then wait for a receipt / poll LI.FI. Phases are distinct on screen,
 * tracker errors are shown instead of swallowed, there is a 20-minute honest
 * timeout, and a destination-balance fallback marks the bridge done even if
 * LI.FI never indexes it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box, Button, HStack, Input, Spinner, Text, Tooltip, VStack, useDisclosure, useToast,
} from "@chakra-ui/react";
import { FaArrowDown, FaInfoCircle } from "react-icons/fa";
import {
  formatUnits, parseUnits, maxUint256, UserRejectedRequestError, type Address,
} from "viem";
import {
  useAccount, useBalance, useBytecode, useChainId, usePublicClient, useReadContract, useSendTransaction,
  useSwitchChain, useWaitForTransactionReceipt, useWriteContract,
} from "wagmi";
import { useTranslations } from "@/contexts/LocaleContext";
import TokenSelectorModal from "./TokenSelectorModal";
import TokenChainLogo from "./TokenChainLogo";
import {
  getSwapChain, isNativeToken, tokensForChain, type SwapToken,
} from "@/lib/evm/swapTokens";
import { toLifiToken, LIFI_FEE_STATUS_HEADER, type LifiQuote, type LifiStatus, type LifiStatusState } from "@/lib/evm/lifi";
import {
  BRIDGE_TRACK_TIMEOUT_MS, explorerTxUrl, safeQueueUrl, type BridgePhase, type SafeTxLookup,
} from "@/lib/evm/safeTx";

const ERC20_ABI = [
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
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
        leftIcon={<TokenChainLogo token={token} size="28px" />}
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
        activeChainId={token.chainId}
      />
    </>
  );
}

// ─── Bridge ──────────────────────────────────────────────────────────────────

export default function BridgeSection() {
  const t = useTranslations();
  const toast = useToast();
  const { address, isConnected, connector } = useAccount();
  const walletChainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  const [fromToken, setFromToken] = useState<SwapToken>(() => nativeOn(1)); // ETH mainnet
  const [toToken, setToToken] = useState<SwapToken>(() => nativeOn(8453)); // ETH Base
  const [amount, setAmount] = useState("");

  const [quote, setQuote] = useState<LifiQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const [needsApproval, setNeedsApproval] = useState(false);
  const [approvalSpender, setApprovalSpender] = useState<Address | null>(null);

  /** Whatever the wallet handed back from eth_sendTransaction (may be a safeTxHash). */
  const [walletHash, setWalletHash] = useState<`0x${string}` | undefined>();
  /** The real on-chain hash — only set once we are sure it exists on the from chain. */
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [bridgeTool, setBridgeTool] = useState<string | null>(null);
  const [bridgeStatus, setBridgeStatus] = useState<LifiStatusState | null>(null);
  const [phase, setPhase] = useState<BridgePhase | null>(null);
  const [safeSigs, setSafeSigs] = useState<{ have: number; need: number } | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [receivingTx, setReceivingTx] = useState<{ hash: string; chainId: number } | null>(null);
  const [doneVia, setDoneVia] = useState<"lifi" | "balance" | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const destBalanceAtStartRef = useRef<bigint | null>(null);
  const trackingActive = phase === "safe-pending" || phase === "submitted";

  // Contract wallet (Safe etc.) detection: bytecode at the connected address on
  // the from chain, or a connector that calls itself Safe. Only affects the
  // initial label — the resolver below copes either way.
  const { data: fromBytecode } = useBytecode({ address, chainId: fromToken.chainId, query: { enabled: !!address } });
  const isContractWallet = !!fromBytecode && fromBytecode !== "0x";
  const isSafeWallet = isContractWallet || /safe/i.test(connector?.name ?? "");

  const fromClient = usePublicClient({ chainId: fromToken.chainId });
  const onFromChain = walletChainId === fromToken.chainId;
  const fromIsNative = isNativeToken(fromToken.address);

  // ── Balance of the from token — read on the FROM chain, not the wallet's
  //    current chain (bridging FROM Ethereum while connected to Base, etc.) ──
  const { data: fromNativeBal } = useBalance({
    address,
    chainId: fromToken.chainId,
    query: { enabled: !!address && fromIsNative },
  });
  const { data: fromErc20Bal } = useReadContract({
    address: fromToken.address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: fromToken.chainId,
    query: { enabled: !!address && !fromIsNative },
  });

  const fromBalance = useMemo(() => {
    if (fromIsNative) {
      return fromNativeBal ? parseFloat(formatUnits(fromNativeBal.value, fromNativeBal.decimals)) : 0;
    }
    if (fromErc20Bal != null) {
      return parseFloat(formatUnits(fromErc20Bal as bigint, fromToken.decimals));
    }
    return 0;
  }, [fromIsNative, fromNativeBal, fromErc20Bal, fromToken.decimals]);

  // ── Destination balance (fallback completion signal while tracking) ──────
  const toIsNative = isNativeToken(toToken.address);
  const { data: toNativeBal } = useBalance({
    address,
    chainId: toToken.chainId,
    query: { enabled: !!address && toIsNative, refetchInterval: trackingActive ? 10_000 : false },
  });
  const { data: toErc20Bal } = useReadContract({
    address: toToken.address as Address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: toToken.chainId,
    query: { enabled: !!address && !toIsNative, refetchInterval: trackingActive ? 10_000 : false },
  });
  const destBalance: bigint | null = toIsNative
    ? (toNativeBal ? toNativeBal.value : null)
    : (toErc20Bal != null ? (toErc20Bal as bigint) : null);

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
  /** Surface server-side fee status; never let "no fee" be silent. */
  const warnIfNoFee = (res: Response) => {
    const status = res.headers.get(LIFI_FEE_STATUS_HEADER);
    if (status !== "applied") {
      console.warn(
        `[bridge] LI.FI quote returned WITHOUT SkateHive integrator fee (${LIFI_FEE_STATUS_HEADER}=${status ?? "missing"}). ` +
          `Bridge will work but SkateHive collects nothing. Check LIFI_INTEGRATOR on the server.`
      );
    }
  };

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
        warnIfNoFee(res);
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
  // Only ever fed the REAL hash (never a safeTxHash), so it can actually resolve.
  const { isSuccess: isMined } = useWaitForTransactionReceipt({ hash: txHash, chainId: fromToken.chainId });

  const notifiedRef = useRef(false);
  const resetTracking = useCallback(() => {
    setWalletHash(undefined); setTxHash(undefined); setBridgeTool(null); setBridgeStatus(null);
    setPhase(null); setSafeSigs(null); setStatusError(null); setReceivingTx(null); setDoneVia(null);
    setStartedAt(null); destBalanceAtStartRef.current = null; notifiedRef.current = false;
  }, []);

  const handleBridge = useCallback(async () => {
    if (!address) return;
    try {
      // Fetch a fresh quote at execution time so the tx isn't stale.
      const res = await fetch(`/api/lifi/quote?${buildParams()}`);
      warnIfNoFee(res);
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
      // Log the hash the wallet returned. For a Safe over WalletConnect this is
      // the safeTxHash, NOT an on-chain hash — the resolver effect below sorts
      // that out and logs what it resolved to, so the next incident explains itself.
      console.info(
        `[bridge] wallet returned ${hash} (connector=${connector?.name ?? "?"}, contractWallet=${isContractWallet}, treatAsSafe=${isSafeWallet}, ${fromToken.chainId}→${toToken.chainId})`
      );
      resetTracking();
      setWalletHash(hash);
      setBridgeTool(q.tool);
      setBridgeStatus("PENDING");
      setStartedAt(Date.now());
      destBalanceAtStartRef.current = destBalance;
      setPhase(isSafeWallet ? "safe-pending" : "submitted");
      if (!isSafeWallet) setTxHash(hash);
      toast({ title: t("bridge.submitted"), description: hash, status: "success", duration: 6000, isClosable: true });
      setAmount("");
      setQuote(null);
    } catch (e) {
      if (isUserRejection(e)) toast({ title: t("bridge.cancelled"), status: "info", duration: 2000, isClosable: true });
      else toast({ title: t("bridge.failed"), description: friendlyError(e), status: "error", duration: 4000, isClosable: true });
    }
  }, [address, buildParams, sendTransactionAsync, fromToken.chainId, toToken.chainId, toast, t, connector?.name, isContractWallet, isSafeWallet, resetTracking, destBalance]);

  const finish = useCallback((ok: boolean, via: "lifi" | "balance") => {
    setPhase(ok ? "done" : "failed");
    setBridgeStatus(ok ? "DONE" : "FAILED");
    setDoneVia(via);
    if (!notifiedRef.current) {
      notifiedRef.current = true;
      toast({ title: t(ok ? "bridge.done" : "bridge.failed"), status: ok ? "success" : "error", duration: 8000, isClosable: true });
    }
  }, [toast, t]);

  // ── Resolve the wallet hash into a real on-chain hash ─────────────────────
  // Runs until txHash is known. Each tick: (a) does the from chain know this
  // hash? then it IS the tx hash. (b) otherwise ask the Safe Transaction
  // Service — a Safe proposal (safeTxHash) gains a transactionHash when executed.
  useEffect(() => {
    if (!walletHash || txHash || !trackingActive) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const onChain = await fromClient?.getTransaction({ hash: walletHash }).catch(() => null);
        if (cancelled) return;
        if (onChain) {
          console.info(`[bridge] ${walletHash} exists on chain ${fromToken.chainId} — using it as the tx hash`);
          setTxHash(walletHash);
          setPhase("submitted");
          return;
        }
        const res = await fetch(`/api/safe/tx?chainId=${fromToken.chainId}&safeTxHash=${walletHash}`);
        const data: SafeTxLookup = await res.json();
        if (cancelled) return;
        if (!res.ok || !data?.found) {
          console.warn(`[bridge] ${walletHash} is not on chain ${fromToken.chainId} and not (yet) in the Safe service: ${data?.message ?? `HTTP ${res.status}`}`);
          if (!isSafeWallet) setStatusError(data?.message ?? `HTTP ${res.status}`);
          return;
        }
        setStatusError(null);
        setPhase("safe-pending");
        setSafeSigs({ have: data.confirmations, need: data.confirmationsRequired });
        if (data.isExecuted && data.isSuccessful === false) {
          console.error(`[bridge] Safe tx ${walletHash} executed but REVERTED`);
          finish(false, "lifi");
          return;
        }
        if (data.transactionHash) {
          console.info(`[bridge] safeTxHash ${walletHash} executed as on-chain tx ${data.transactionHash}`);
          setTxHash(data.transactionHash);
          setPhase("submitted");
        }
      } catch (e) {
        console.error(`[bridge] resolving ${walletHash} failed:`, e);
      }
    };
    tick();
    const id = setInterval(tick, 6000);
    return () => { cancelled = true; clearInterval(id); };
  }, [walletHash, txHash, trackingActive, fromClient, fromToken.chainId, isSafeWallet, finish]);

  // ── LI.FI cross-chain status polling (real hash only) ─────────────────────
  useEffect(() => {
    if (!txHash || !bridgeTool || phase !== "submitted") return;
    let cancelled = false;
    let consecutiveErrors = 0;
    const poll = async () => {
      try {
        const p = new URLSearchParams({
          txHash,
          fromChain: String(fromToken.chainId),
          toChain: String(toToken.chainId),
          bridge: bridgeTool,
        });
        const res = await fetch(`/api/lifi/status?${p}`);
        const data: LifiStatus & { message?: string; code?: number } = await res.json();
        if (cancelled) return;
        if (!res.ok || !data?.status) {
          // Never swallow this: the old code discarded ~1,200 "1003 not found"
          // answers in silence while the UI spun forever.
          consecutiveErrors += 1;
          const msg = data?.message ?? `HTTP ${res.status}`;
          console.error(`[bridge] LI.FI status error #${consecutiveErrors} for ${txHash}: ${data?.code ?? ""} ${msg}`);
          if (consecutiveErrors >= 3) setStatusError(msg);
          return;
        }
        consecutiveErrors = 0;
        setStatusError(null);
        setBridgeStatus(data.status);
        if (data.status === "DONE") {
          console.info(`[bridge] LI.FI reports DONE for ${txHash} (receiving ${data.receiving?.txHash ?? "?"})`);
          if (data.receiving?.txHash) setReceivingTx({ hash: data.receiving.txHash, chainId: data.receiving.chainId ?? toToken.chainId });
          finish(true, "lifi");
        } else if (data.status === "FAILED") {
          console.error(`[bridge] LI.FI reports FAILED for ${txHash}: ${data.substatus ?? ""} ${data.substatusMessage ?? ""}`);
          finish(false, "lifi");
        }
      } catch (e) {
        console.error(`[bridge] LI.FI status fetch failed for ${txHash}:`, e);
      }
    };
    poll();
    const id = setInterval(poll, 6000);
    return () => { cancelled = true; clearInterval(id); };
  }, [txHash, bridgeTool, phase, fromToken.chainId, toToken.chainId, finish]);

  // ── Fallback: destination balance went up while we were waiting ───────────
  useEffect(() => {
    if (!trackingActive || destBalance == null || destBalanceAtStartRef.current == null) return;
    if (destBalance > destBalanceAtStartRef.current) {
      console.info(`[bridge] destination balance rose ${destBalanceAtStartRef.current} → ${destBalance} on chain ${toToken.chainId}; marking done by balance`);
      finish(true, "balance");
    }
  }, [destBalance, trackingActive, toToken.chainId, finish]);

  // ── Honest timeout ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!trackingActive || !startedAt) return;
    const id = setInterval(() => {
      if (Date.now() - startedAt > BRIDGE_TRACK_TIMEOUT_MS) {
        console.error(`[bridge] no terminal status after ${BRIDGE_TRACK_TIMEOUT_MS / 60000} min (walletHash=${walletHash}, txHash=${txHash ?? "-"}, phase=${phase})`);
        setPhase("timeout");
      }
    }, 15_000);
    return () => clearInterval(id);
  }, [trackingActive, startedAt, walletHash, txHash, phase]);

  // ── Derived display ──────────────────────────────────────────────────────
  const fromChainName = getSwapChain(fromToken.chainId)?.name ?? "?";
  const toChainName = getSwapChain(toToken.chainId)?.name ?? "?";
  const estOut = quote ? fmtAmount(quote.estimate.toAmount, toToken.decimals) : "—";
  const minOut = quote ? fmtAmount(quote.estimate.toAmountMin, toToken.decimals) : null;
  const totalCostUsd = useMemo(() => {
    if (!quote) return null;
    // Sum EVERY fee cost, including ones LI.FI marks `included` (they are
    // deducted from toAmount — the 0.5% SkateHive integrator fee is one of
    // them). Summing only the non-included ones showed "$0.10" while the user
    // actually paid ~0.5% more; the fee must be visible where it is charged.
    const fees = (quote.estimate.feeCosts ?? []).reduce((s, f) => s + Number(f.amountUSD ?? 0), 0);
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

  const isBusy = isFetching || isSending || isApproving || trackingActive || isSwitching;
  const canBridge = isConnected && onFromChain && !!quote && !needsApproval && !insufficient && !isBusy && !!amount;

  return (
    <VStack spacing={0} align="stretch">
      {/* From + Flip + To (flip button overlaps the seam) */}
      <Box mb={3}>
        {/* From */}
        <Box border="1px solid" borderColor={insufficient ? "red.400" : "border"} bg="muted" p={4}>
          <HStack justify="space-between" mb={2}>
            <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider">
              {t("bridge.from")} · {fromChainName}
            </Text>
            {isConnected && (
              <HStack spacing={2}>
                <Text fontSize="11px" color={insufficient ? "red.400" : "dim"} fontFamily="mono">
                  {t("bridge.balance")}: {fromBalance < 0.0001 ? fromBalance.toExponential(2) : fromBalance < 1 ? fromBalance.toFixed(4) : fromBalance.toFixed(2)}
                </Text>
                <Button size="xs" h="20px" px={1.5} variant="outline" borderColor="border" borderRadius="none"
                  color="primary" fontFamily="mono" fontSize="9px" fontWeight="black"
                  onClick={setMax} isDisabled={fromBalance <= 0} _hover={{ bg: "background", borderColor: "primary" }}>
                  {t("bridge.max")}
                </Button>
              </HStack>
            )}
          </HStack>
          <HStack spacing={3}>
            <Input
              type="number" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              fontSize="3xl" fontFamily="mono" fontWeight="black" color="primary" variant="unstyled"
              flex={1} minW={0} h="44px" _placeholder={{ color: "dim" }}
            />
            <SideSelector token={fromToken} onSelect={setFromToken} />
          </HStack>
        </Box>

        {/* Flip — square button punched into the seam between the two boxes */}
        <Box h="0" position="relative" zIndex={2} textAlign="center">
          <Button
            position="absolute" top="0" left="50%" transform="translate(-50%, -50%)"
            w="40px" h="40px" minW="40px" p={0}
            borderRadius="none" border="2px solid" borderColor="primary"
            bg="background" color="primary" onClick={handleFlip} aria-label="Flip chains"
            _hover={{ bg: "primary", color: "background" }}
            _active={{ transform: "translate(-50%, -50%) scale(0.94)" }}
            transition="all 0.15s"
          >
            <FaArrowDown />
          </Button>
        </Box>

        {/* To */}
        <Box border="1px solid" borderColor="border" bg="muted" p={4}>
          <Text fontSize="xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={2}>
            {t("bridge.to")} · {toChainName}
          </Text>
          <HStack spacing={3}>
            <Text fontSize="3xl" fontFamily="mono" fontWeight="black" color={estOut === "—" ? "dim" : "primary"} flex={1} minW={0} isTruncated>
              {isFetching ? <Spinner size="md" color="primary" /> : estOut}
            </Text>
            <SideSelector token={toToken} onSelect={setToToken} />
          </HStack>
        </Box>
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

      {phase && (() => {
        const fromTx = txHash ? explorerTxUrl(fromToken.chainId, txHash) : null;
        const recvTx = receivingTx ? explorerTxUrl(receivingTx.chainId, receivingTx.hash) : null;
        const safeUrl = address ? safeQueueUrl(fromToken.chainId, address) : null;
        const spinning = phase === "safe-pending" || phase === "submitted";
        const color = phase === "done" ? "green.400" : phase === "failed" ? "red.400" : phase === "timeout" ? "orange.300" : "primary";
        let label: string;
        if (phase === "safe-pending") {
          label = t("bridge.safePending").replace("{have}", String(safeSigs?.have ?? 0)).replace("{need}", String(safeSigs?.need ?? "?"));
        } else if (phase === "submitted") {
          label = isMined ? t("bridge.safeExecuted") : t("bridge.txSent");
        } else if (phase === "done") {
          label = doneVia === "balance" ? t("bridge.doneByBalance").replace("{chain}", toChainName) : t("bridge.done");
        } else if (phase === "failed") {
          label = t("bridge.failed");
        } else {
          label = t("bridge.timeout");
        }
        const link = (href: string, text: string) => (
          <Text as="a" href={href} target="_blank" rel="noopener noreferrer" textDecoration="underline" color="text" key={href}>{text}</Text>
        );
        return (
          <VStack align="stretch" spacing={1} border="1px solid" borderColor={color} p={2} mb={3} fontSize="xs" fontFamily="mono" data-bridge-phase={phase}>
            <HStack spacing={2}>
              {spinning && <Spinner size="xs" color={color} />}
              <Text color={color}>{label}</Text>
            </HStack>
            {statusError && <Text color="orange.300">{t("bridge.statusError").replace("{msg}", statusError)}</Text>}
            <HStack spacing={3} color="dim" flexWrap="wrap">
              {phase === "safe-pending" && safeUrl && link(safeUrl, t("bridge.openSafe"))}
              {fromTx && link(fromTx, t("bridge.viewTx"))}
              {recvTx && link(recvTx, t("bridge.viewReceiving").replace("{chain}", toChainName))}
              {!spinning && <Text as="button" onClick={resetTracking} textDecoration="underline">{t("bridge.dismiss")}</Text>}
            </HStack>
          </VStack>
        );
      })()}

      {/* CTA */}
      {!isConnected ? (
        <Box border="1px solid" borderColor="border" bg="muted" p={4} textAlign="center">
          <Text fontSize="xs" color="dim" fontFamily="mono">{t("bridge.connectWallet")}</Text>
        </Box>
      ) : !onFromChain ? (
        <Button w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest" fontFamily="mono"
          colorScheme="orange" h="54px" fontSize="md" sx={{ textTransform: "uppercase" }} isLoading={isSwitching}
          onClick={() => switchChain({ chainId: fromToken.chainId })}>
          {t("bridge.switchTo").replace("{chain}", fromChainName)}
        </Button>
      ) : needsApproval ? (
        <Button w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest" fontFamily="mono"
          colorScheme="orange" h="54px" fontSize="md" sx={{ textTransform: "uppercase" }} isLoading={isApproving}
          loadingText={t("bridge.approving")} onClick={handleApprove}>
          {t("bridge.approve").replace("{symbol}", fromToken.symbol)}
        </Button>
      ) : (
        <Button w="100%" borderRadius="none" fontWeight="black" letterSpacing="widest" fontFamily="mono"
          colorScheme="green" h="54px" fontSize="md" sx={{ textTransform: "uppercase" }} isDisabled={!canBridge || trackingActive}
          isLoading={isSending} loadingText={t("bridge.bridging")}
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
