"use client";

import {
  Box,
  Alert,
  AlertIcon,
  VStack,
  HStack,
  Skeleton,
  SkeletonCircle,
  useDisclosure,
  useBreakpointValue,
  Button,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  IconButton,
  useToast,
  Image,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import * as QRCode from "qrcode";
import { useAccount } from "wagmi";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { usePortfolioContext } from "@/contexts/PortfolioContext";
import { TokenDetail } from "@/types/portfolio";
import {
  preloadTokenLogos,
  subscribeToLogoUpdates,
  forceRefreshTokenData,
  consolidateTokensBySymbol,
  sortConsolidatedTokensByBalance,
  ConsolidatedToken,
  formatValue,
} from "@/lib/utils/portfolioUtils";
import { FaPaperPlane, FaQrcode, FaCopy } from "react-icons/fa";
import SendTokenModal from "./SendTokenModal";
import TokenControlsBar from "./components/TokenControlsBar";
import MobileTokenTable from "./components/MobileTokenTable";
import DesktopTokenTable from "./components/DesktopTokenTable";
import TokenLogo from "./components/TokenLogo";
import { SendHiveModal, SendHBDModal } from "./modals";

// Tokens that cannot be sent directly (locked / staked / no send flow)
const NON_SENDABLE = new Set(["HP", "HBDS", "BTC"]);

type ChainFilter = "all" | "hive" | "evm" | "farcaster";

interface UnifiedWalletTableProps {
  chainFilter: ChainFilter;
  hiveBalance: string;
  hbdBalance: string;
  hivePower: string;
  hbdSavingsBalance: string;
  hivePrice: number | null;
  hbdPrice: number | null;
  hiveUser?: string;
  /** Self-claimed BTC address (from Hive metadata); enables the aggregated BTC row. */
  btcAddress?: string;
  /** Confirmed on-chain BTC balance, or null while loading / unavailable. */
  btcBalance?: number | null;
  btcPrice?: number | null;
}

function makeSyntheticToken(
  symbol: string,
  name: string,
  balance: string,
  price: number | null,
  addressSuffix?: string
): TokenDetail {
  const bal = balance === "N/A" || balance === "" ? 0 : parseFloat(balance);
  const usd = bal * (price || 0);
  const id = `hive-${addressSuffix || symbol.toLowerCase()}`;
  return {
    address: id,
    assetCaip: `hive:native/${id}`,
    key: id,
    network: "hive",
    token: {
      address: id,
      balance: bal,
      balanceRaw: balance,
      balanceUSD: usd,
      canExchange: true,
      coingeckoId: symbol === "HIVE" || symbol === "HP" ? "hive" : "hive_dollar",
      createdAt: "",
      decimals: 3,
      externallyVerified: false,
      hide: false,
      holdersEnabled: false,
      id,
      label: null,
      name,
      networkId: 0,
      price: price || 0,
      priceUpdatedAt: "",
      status: "active",
      symbol,
      totalSupply: "",
      updatedAt: "",
      verified: true,
    },
    updatedAt: "",
    source: "hive" as any,
  };
}

// Synthetic BTC token — non-EVM, injected client-side like the Hive tokens.
function makeBtcToken(balance: number, price: number | null): TokenDetail {
  const usd = balance * (price || 0);
  const id = "bitcoin-native";
  return {
    address: id,
    assetCaip: `bitcoin:native/${id}`,
    key: id,
    network: "bitcoin",
    token: {
      address: id,
      balance,
      balanceRaw: String(balance),
      balanceUSD: usd,
      canExchange: true,
      coingeckoId: "bitcoin",
      createdAt: "",
      decimals: 8,
      externallyVerified: false,
      hide: false,
      holdersEnabled: false,
      id,
      label: null,
      name: "Bitcoin",
      networkId: 0,
      price: price || 0,
      priceUpdatedAt: "",
      status: "active",
      symbol: "BTC",
      totalSupply: "",
      updatedAt: "",
      verified: true,
    },
    updatedAt: "",
    source: "bitcoin" as any,
  };
}

function TokenRowSkeletons({ count }: { count: number }) {
  return (
    <VStack spacing={0} align="stretch" w="100%">
      {Array.from({ length: count }).map((_, i) => (
        <HStack
          key={i}
          py={3}
          px={2}
          justify="space-between"
          borderBottom="1px solid"
          borderColor="border"
          opacity={1 - i * 0.15}
        >
          <HStack spacing={3}>
            <SkeletonCircle size="8" startColor="muted" endColor="panel" />
            <VStack spacing={1.5} align="start">
              <Skeleton h="12px" w="60px" startColor="muted" endColor="panel" />
              <Skeleton h="10px" w="90px" startColor="muted" endColor="panel" />
            </VStack>
          </HStack>
          <Skeleton h="14px" w="55px" startColor="muted" endColor="panel" />
        </HStack>
      ))}
    </VStack>
  );
}

// ─── Send Picker Modal ────────────────────────────────────────────────────────
function SendPickerModal({ isOpen, onClose, consolidatedTokens, onSelect, requireChainSelect, defaultChain }: {
  isOpen: boolean;
  onClose: () => void;
  consolidatedTokens: ConsolidatedToken[];
  onSelect: (token: ConsolidatedToken) => void;
  requireChainSelect?: boolean;
  defaultChain?: "hive" | "evm";
}) {
  const [selectedChain, setSelectedChain] = useState<"hive" | "evm" | null>(
    requireChainSelect ? null : (defaultChain ?? "evm")
  );

  // Reset chain selection when modal opens/closes
  useEffect(() => {
    if (isOpen) setSelectedChain(requireChainSelect ? null : (defaultChain ?? "evm"));
  }, [isOpen, requireChainSelect, defaultChain]);

  const sendable = consolidatedTokens.filter((ct) => !NON_SENDABLE.has(ct.symbol));
  const filtered = selectedChain === "hive"
    ? sendable.filter((ct) => ct.chains.some((c) => c.network === "hive"))
    : selectedChain === "evm"
    ? sendable.filter((ct) => ct.chains.every((c) => c.network !== "hive"))
    : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalOverlay />
      <ModalContent bg="background" borderRadius="none" border="2px solid" borderColor="primary">
        <ModalHeader
          fontFamily="mono" fontWeight="black" textTransform="uppercase"
          letterSpacing="widest" fontSize="sm" color="primary"
          borderBottom="1px solid" borderColor="border"
        >
          {selectedChain ? (
            <HStack>
              <Box
                as="button"
                onClick={() => requireChainSelect && setSelectedChain(null)}
                cursor={requireChainSelect ? "pointer" : "default"}
                opacity={requireChainSelect ? 1 : 0.5}
                mr={2}
                fontSize="md"
              >
                ←
              </Box>
              Send {selectedChain === "hive" ? "Hive" : "EVM"} Token
            </HStack>
          ) : "Select Chain"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={0}>
          {/* Step 1: chain selector */}
          {!selectedChain && (
            <VStack spacing={0} align="stretch">
              <Box
                px={4} py={4} cursor="pointer" borderBottom="1px solid" borderColor="border"
                _hover={{ bg: "muted" }}
                onClick={() => setSelectedChain("hive")}
              >
                <HStack spacing={3}>
                  <Image src="/logos/hiveLogo.png" w="28px" h="28px" alt="Hive" borderRadius="none" />
                  <Text fontFamily="mono" fontWeight="bold" color="text">Hive</Text>
                </HStack>
              </Box>
              <Box
                px={4} py={4} cursor="pointer"
                _hover={{ bg: "muted" }}
                onClick={() => setSelectedChain("evm")}
              >
                <HStack spacing={3}>
                  <Image src="/logos/ethereum_logo.png" w="28px" h="28px" alt="EVM" borderRadius="none" />
                  <Text fontFamily="mono" fontWeight="bold" color="text">EVM</Text>
                </HStack>
              </Box>
            </VStack>
          )}
          {/* Step 2: token list */}
          {selectedChain && (
            <Box maxH="400px" overflowY="auto">
              {filtered.map((ct) => (
                <Box
                  key={ct.symbol}
                  px={4} py={3}
                  cursor="pointer"
                  borderBottom="1px solid" borderColor="border"
                  _hover={{ bg: "muted" }}
                  onClick={() => { onSelect(ct); onClose(); }}
                >
                  <HStack justify="space-between">
                    <HStack spacing={3}>
                      <TokenLogo token={ct.primaryChain} size="28px" showNetworkBadge={false} />
                      <VStack spacing={0} align="start">
                        <Text fontFamily="mono" fontWeight="bold" color="text" fontSize="sm">{ct.symbol}</Text>
                        {ct.name !== ct.symbol && (
                          <Text fontFamily="mono" fontSize="xs" color="dim">{ct.name}</Text>
                        )}
                      </VStack>
                    </HStack>
                    <VStack spacing={0} align="end">
                      <Text fontFamily="mono" fontSize="sm" color="primary" fontWeight="bold">{formatValue(ct.totalBalanceUSD)}</Text>
                      <Text fontFamily="mono" fontSize="xs" color="dim">
                        {ct.chains.reduce((s, c) => s + c.token.balance, 0).toFixed(4).replace(/\.?0+$/, "")} {ct.symbol}
                      </Text>
                    </VStack>
                  </HStack>
                </Box>
              ))}
              {filtered.length === 0 && (
                <Box px={4} py={6} textAlign="center">
                  <Text fontFamily="mono" fontSize="sm" color="dim">No sendable tokens found.</Text>
                </Box>
              )}
            </Box>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// ─── Receive Modal ────────────────────────────────────────────────────────────
function ReceiveModal({ isOpen, onClose, hiveUser, evmAddress, btcAddress }: {
  isOpen: boolean;
  onClose: () => void;
  hiveUser?: string;
  evmAddress?: string;
  btcAddress?: string;
}) {
  const toast = useToast();
  const copy = (val: string) => {
    navigator.clipboard.writeText(val);
    toast({ title: "Copied!", status: "success", duration: 1500, isClosable: true });
  };

  // Wallets to show, in order. `value` is displayed + copied; `qr` is encoded.
  const wallets = useMemo(
    () =>
      [
        hiveUser ? { key: "hive", label: "Hive", value: `@${hiveUser}`, qr: hiveUser } : null,
        evmAddress ? { key: "evm", label: "EVM", value: evmAddress, qr: evmAddress } : null,
        btcAddress ? { key: "btc", label: "Bitcoin", value: btcAddress, qr: btcAddress } : null,
      ].filter(Boolean) as { key: string; label: string; value: string; qr: string }[],
    [hiveUser, evmAddress, btcAddress]
  );

  const [selected, setSelected] = useState<string>("");
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  // Default selection to the first wallet whenever the set changes / opens.
  useEffect(() => {
    if (isOpen && wallets.length && !wallets.some((w) => w.key === selected)) {
      setSelected(wallets[0].key);
    }
  }, [isOpen, wallets, selected]);

  // Pre-generate a QR per wallet (black-on-white for scannability) on open.
  useEffect(() => {
    if (!isOpen) { setQrMap({}); return; }
    let cancelled = false;
    (async () => {
      const out: Record<string, string> = {};
      for (const w of wallets) {
        try {
          out[w.key] = await QRCode.toDataURL(w.qr, { width: 240, margin: 2, color: { dark: "#000000", light: "#ffffff" } });
        } catch { /* skip a failed QR */ }
      }
      if (!cancelled) setQrMap(out);
    })();
    return () => { cancelled = true; };
  }, [isOpen, wallets]);

  const active = wallets.find((w) => w.key === selected) || wallets[0];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" isCentered>
      <ModalOverlay />
      <ModalContent bg="background" borderRadius="none" border="2px solid" borderColor="primary">
        <ModalHeader
          fontFamily="mono" fontWeight="black" textTransform="uppercase"
          letterSpacing="widest" fontSize="sm" color="primary"
          borderBottom="1px solid" borderColor="border"
        >
          Receive
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody py={5}>
          {!wallets.length ? (
            <Text fontFamily="mono" fontSize="sm" color="dim" textAlign="center" py={6}>
              No linked addresses found.
            </Text>
          ) : (
            <VStack spacing={4} align="stretch">
              {/* wallet picker (only when there's more than one) */}
              {wallets.length > 1 && (
                <HStack spacing={0} border="1px solid" borderColor="primary">
                  {wallets.map((w) => {
                    const on = active?.key === w.key;
                    return (
                      <Button
                        key={w.key}
                        flex={1}
                        size="sm"
                        borderRadius="none"
                        fontFamily="mono"
                        fontSize="xs"
                        textTransform="uppercase"
                        bg={on ? "primary" : "transparent"}
                        color={on ? "background" : "primary"}
                        opacity={on ? 1 : 0.6}
                        _hover={{ opacity: 1 }}
                        onClick={() => setSelected(w.key)}
                      >
                        {w.label}
                      </Button>
                    );
                  })}
                </HStack>
              )}

              {active && (
                <>
                  {/* QR (white quiet-zone box for scannability) */}
                  <Box alignSelf="center" bg="white" p={3} border="1px solid" borderColor="border">
                    {qrMap[active.key] ? (
                      <Image src={qrMap[active.key]} alt={`${active.label} address QR`} boxSize="200px" />
                    ) : (
                      <Box boxSize="200px" display="flex" alignItems="center" justifyContent="center">
                        <Text fontFamily="mono" fontSize="xs" color="black" opacity={0.5}>generating…</Text>
                      </Box>
                    )}
                  </Box>

                  {/* address + inline copy */}
                  <Box>
                    <Text fontSize="2xs" color="dim" fontFamily="mono" textTransform="uppercase" letterSpacing="wider" mb={1}>
                      {active.label} address
                    </Text>
                    <HStack border="1px solid" borderColor="border" p={3} spacing={2}>
                      <Text fontFamily="mono" fontSize="xs" color="primary" flex={1} wordBreak="break-all">
                        {active.value}
                      </Text>
                      <IconButton aria-label="Copy" icon={<FaCopy />} size="xs" variant="ghost" color="dim" onClick={() => copy(active.value)} />
                    </HStack>
                  </Box>

                  <Button
                    leftIcon={<FaCopy />}
                    bg="primary" color="background" fontFamily="mono" fontSize="xs"
                    textTransform="uppercase" borderRadius="none" size="sm"
                    _hover={{ opacity: 0.85 }}
                    onClick={() => copy(active.value)}
                  >
                    Copy {active.label} address
                  </Button>
                </>
              )}
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function UnifiedWalletTable({
  chainFilter,
  hiveBalance,
  hbdBalance,
  hivePower,
  hbdSavingsBalance,
  hivePrice,
  hbdPrice,
  hiveUser,
  btcAddress,
  btcBalance,
  btcPrice,
}: UnifiedWalletTableProps) {
  const { isConnected, address } = useAccount();
  const { isAuthenticated: isFarcasterConnected } = useFarcasterSession();
  const { aggregatedPortfolio, isLoading, error, refetch } = usePortfolioContext();

  const [hideSmallBalances, setHideSmallBalances] = useState(true);
  const minBalanceThreshold = 1;
  const [logoUpdateTrigger, setLogoUpdateTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());

  const [selectedEVMToken, setSelectedEVMToken] = useState<TokenDetail | null>(null);
  const [selectedTokenLogo, setSelectedTokenLogo] = useState<string>("");
  const { isOpen: isSendEVMOpen, onOpen: onSendEVMOpen, onClose: onSendEVMClose } = useDisclosure();
  const { isOpen: isSendHiveOpen, onOpen: onSendHiveOpen, onClose: onSendHiveClose } = useDisclosure();
  const { isOpen: isSendHBDOpen, onOpen: onSendHBDOpen, onClose: onSendHBDClose } = useDisclosure();

  // Send picker + receive modals
  const { isOpen: isSendPickerOpen, onOpen: onSendPickerOpen, onClose: onSendPickerClose } = useDisclosure();
  const { isOpen: isReceiveOpen, onOpen: onReceiveOpen, onClose: onReceiveClose } = useDisclosure();
  const [sendTarget, setSendTarget] = useState<ConsolidatedToken | null>(null);

  const isMobile = useBreakpointValue({ base: true, md: false });

  // Always-active subscription — logo fetches can resolve before portfolio tokens load
  useEffect(() => {
    const unsub = subscribeToLogoUpdates(() => {
      setLogoUpdateTrigger((prev) => prev + 1);
    });
    return () => { unsub(); };
  }, []);

  // Preload GeckoTerminal logos whenever the token list changes
  useEffect(() => {
    if (!aggregatedPortfolio?.tokens || aggregatedPortfolio.tokens.length === 0) return;
    const portfolioHash = aggregatedPortfolio.tokens
      .map((t) => `${t.network}-${t.token.address}`)
      .join(",");
    const lastHash = sessionStorage.getItem("lastPortfolioHash");
    if (portfolioHash !== lastHash) {
      preloadTokenLogos(aggregatedPortfolio.tokens);
      sessionStorage.setItem("lastPortfolioHash", portfolioHash);
    }
  }, [aggregatedPortfolio?.tokens]);

  const toggleTokenExpansion = useCallback((symbol: string) => {
    setExpandedTokens((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  }, []);

  const handleForceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (aggregatedPortfolio?.tokens) {
        await forceRefreshTokenData(aggregatedPortfolio.tokens);
        sessionStorage.removeItem("lastPortfolioHash");
      }
      refetch();
    } catch (e) {
      console.error("Failed to refresh token data:", e);
    } finally {
      setIsRefreshing(false);
    }
  }, [aggregatedPortfolio?.tokens, refetch]);

  const handleSendToken = useCallback(
    (tokenDetail: TokenDetail, logoUrl?: string) => {
      // BTC has no send flow — clicking the row is a no-op.
      if (tokenDetail.network === "bitcoin") return;
      if (tokenDetail.network === "hive") {
        if (tokenDetail.token.symbol === "HIVE") {
          onSendHiveOpen();
        } else if (tokenDetail.token.symbol === "HBD" || tokenDetail.token.symbol === "HBDS") {
          onSendHBDOpen();
        }
      } else {
        setSelectedEVMToken(tokenDetail);
        setSelectedTokenLogo(logoUrl || "");
        onSendEVMOpen();
      }
    },
    [onSendHiveOpen, onSendHBDOpen, onSendEVMOpen]
  );

  const handleTokenSelect = useCallback(
    (consolidatedToken: ConsolidatedToken) => {
      handleSendToken(consolidatedToken.primaryChain);
    },
    [handleSendToken]
  );

  const handleSendPickerSelect = useCallback(
    (consolidatedToken: ConsolidatedToken) => {
      setSendTarget(consolidatedToken);
      handleSendToken(consolidatedToken.primaryChain);
    },
    [handleSendToken]
  );

  // Build all Hive synthetic tokens
  const hiveTokens = useMemo<TokenDetail[]>(() => {
    if (!hiveUser) return [];
    const tokens: TokenDetail[] = [];

    // Liquid HIVE
    tokens.push(makeSyntheticToken("HIVE", "Hive", hiveBalance, hivePrice, "hive-liquid"));

    // Hive Power (HP) — same price as HIVE
    if (hivePower && hivePower !== "N/A") {
      tokens.push(makeSyntheticToken("HP", "Hive Power", hivePower, hivePrice, "hive-power"));
    }

    // Liquid HBD
    tokens.push(makeSyntheticToken("HBD", "Hive Dollars", hbdBalance, hbdPrice, "hbd-liquid"));

    // HBD Savings
    if (hbdSavingsBalance && hbdSavingsBalance !== "N/A" && parseFloat(hbdSavingsBalance) > 0) {
      tokens.push(makeSyntheticToken("HBDS", "HBD Savings (15% APR)", hbdSavingsBalance, hbdPrice, "hbd-savings"));
    }

    return tokens;
  }, [hiveUser, hiveBalance, hivePower, hbdBalance, hbdSavingsBalance, hivePrice, hbdPrice]);

  // Synthetic BTC token (only when the user has a self-claimed address with a balance)
  const btcTokens = useMemo<TokenDetail[]>(() => {
    if (!btcAddress || btcBalance == null || btcBalance <= 0) return [];
    return [makeBtcToken(btcBalance, btcPrice ?? null)];
  }, [btcAddress, btcBalance, btcPrice]);

  // Filter EVM tokens by source
  const filteredEVMTokens = useMemo<TokenDetail[]>(() => {
    const all = aggregatedPortfolio?.tokens || [];
    if (chainFilter === "hive") return [];
    // "verified" = DB-linked EVM addresses → belong in EVM view, not Farcaster-only
    if (chainFilter === "evm") return all.filter((t) => t.source === "ethereum" || t.source === "verified");
    if (chainFilter === "farcaster") return all.filter((t) => t.source === "farcaster");
    return all; // "all"
  }, [aggregatedPortfolio?.tokens, chainFilter]);

  // Merge, consolidate, filter (Hive tokens always bypass dust filter)
  const consolidatedTokens = useMemo(() => {
    const showHive = chainFilter === "all" || chainFilter === "hive";
    // BTC is non-EVM/non-Hive — only surface it in the aggregated "all" view.
    const showBtc = chainFilter === "all";
    const combined = [
      ...(showHive ? hiveTokens : []),
      ...(showBtc ? btcTokens : []),
      ...filteredEVMTokens,
    ];
    const consolidated = consolidateTokensBySymbol(combined);

    const filtered = consolidated.filter((token) => {
      // Hive + BTC tokens always show regardless of dust filter
      if (token.chains.some((c) => c.network === "hive" || c.network === "bitcoin")) return true;
      if (!hideSmallBalances) return true;
      return token.totalBalanceUSD >= minBalanceThreshold || token.symbol.toLowerCase() === "higher";
    });

    return sortConsolidatedTokensByBalance(filtered);
  // logoUpdateTrigger forces re-evaluation so fresh logo cache entries are picked up
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hiveTokens, btcTokens, filteredEVMTokens, hideSmallBalances, chainFilter, logoUpdateTrigger]);

  // EVM is still loading but we already have Hive tokens to show
  const showEVMSkeleton = isLoading && (chainFilter === "all" || chainFilter === "evm" || chainFilter === "farcaster");

  return (
    <Box w="100%">
      {error && (
        <Alert status="error" mb={4}>
          <AlertIcon />
          {error}
        </Alert>
      )}

      {isMobile ? (
        <VStack spacing={4} align="stretch">
          <TokenControlsBar
            isRefreshing={isRefreshing}
            hideSmallBalances={hideSmallBalances}
            onRefresh={handleForceRefresh}
            onToggleSmallBalances={setHideSmallBalances}
          />
          {/* Send / Receive buttons — hidden on Farcaster (read-only) */}
          {chainFilter !== "farcaster" && (
            <HStack spacing={2} px={4} py={2}>
              <Button
                flex={1} size="sm" variant="outline" borderRadius="none"
                borderColor="primary" color="primary" fontFamily="mono"
                fontWeight="black" letterSpacing="wide" textTransform="uppercase"
                leftIcon={<FaPaperPlane />}
                onClick={onSendPickerOpen}
              >
                Send
              </Button>
              <Button
                flex={1} size="sm" variant="outline" borderRadius="none"
                borderColor="border" color="text" fontFamily="mono"
                fontWeight="black" letterSpacing="wide" textTransform="uppercase"
                leftIcon={<FaQrcode />}
                onClick={onReceiveOpen}
              >
                Receive
              </Button>
            </HStack>
          )}
          <MobileTokenTable
            consolidatedTokens={consolidatedTokens}
            expandedTokens={expandedTokens}
            onToggleExpansion={toggleTokenExpansion}
            onTokenSelect={handleTokenSelect}
          />
          {showEVMSkeleton && <TokenRowSkeletons count={4} />}
        </VStack>
      ) : (
        <Box overflowX="hidden" w="100%">
          <TokenControlsBar
            isRefreshing={isRefreshing}
            hideSmallBalances={hideSmallBalances}
            onRefresh={handleForceRefresh}
            onToggleSmallBalances={setHideSmallBalances}
          />
          {/* Send / Receive buttons — hidden on Farcaster (read-only) */}
          {chainFilter !== "farcaster" && (
            <HStack spacing={2} px={4} py={2}>
              <Button
                flex={1} size="sm" variant="outline" borderRadius="none"
                borderColor="primary" color="primary" fontFamily="mono"
                fontWeight="black" letterSpacing="wide" textTransform="uppercase"
                leftIcon={<FaPaperPlane />}
                onClick={onSendPickerOpen}
              >
                Send
              </Button>
              <Button
                flex={1} size="sm" variant="outline" borderRadius="none"
                borderColor="border" color="text" fontFamily="mono"
                fontWeight="black" letterSpacing="wide" textTransform="uppercase"
                leftIcon={<FaQrcode />}
                onClick={onReceiveOpen}
              >
                Receive
              </Button>
            </HStack>
          )}
          <DesktopTokenTable
            consolidatedTokens={consolidatedTokens}
            expandedTokens={expandedTokens}
            onToggleExpansion={toggleTokenExpansion}
          />
          {showEVMSkeleton && <TokenRowSkeletons count={5} />}
        </Box>
      )}

      {selectedEVMToken && (
        <SendTokenModal
          isOpen={isSendEVMOpen}
          onClose={onSendEVMClose}
          token={selectedEVMToken}
          tokenLogo={selectedTokenLogo}
        />
      )}

      <SendHiveModal
        isOpen={isSendHiveOpen}
        onClose={onSendHiveClose}
        balance={hiveBalance}
      />
      <SendHBDModal
        isOpen={isSendHBDOpen}
        onClose={onSendHBDClose}
        balance={hbdBalance}
      />

      <SendPickerModal
        isOpen={isSendPickerOpen}
        onClose={onSendPickerClose}
        consolidatedTokens={consolidatedTokens}
        onSelect={handleSendPickerSelect}
        requireChainSelect={chainFilter === "all"}
        defaultChain={chainFilter === "hive" ? "hive" : chainFilter === "evm" ? "evm" : undefined}
      />

      <ReceiveModal
        isOpen={isReceiveOpen}
        onClose={onReceiveClose}
        hiveUser={hiveUser}
        evmAddress={address}
        btcAddress={btcAddress}
      />
    </Box>
  );
}
