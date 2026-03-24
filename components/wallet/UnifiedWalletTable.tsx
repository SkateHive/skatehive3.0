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
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useCallback } from "react";
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
} from "@/lib/utils/portfolioUtils";
import SendTokenModal from "./SendTokenModal";
import TokenControlsBar from "./components/TokenControlsBar";
import MobileTokenTable from "./components/MobileTokenTable";
import DesktopTokenTable from "./components/DesktopTokenTable";
import { SendHiveModal, SendHBDModal } from "./modals";

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

export default function UnifiedWalletTable({
  chainFilter,
  hiveBalance,
  hbdBalance,
  hivePower,
  hbdSavingsBalance,
  hivePrice,
  hbdPrice,
  hiveUser,
}: UnifiedWalletTableProps) {
  const { isConnected } = useAccount();
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

  const isMobile = useBreakpointValue({ base: true, md: false });

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
    const unsub = subscribeToLogoUpdates(() => {
      setLogoUpdateTrigger((prev) => prev + 1);
    });
    return () => { unsub(); };
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

  // Filter EVM tokens by source
  const filteredEVMTokens = useMemo<TokenDetail[]>(() => {
    const all = aggregatedPortfolio?.tokens || [];
    if (chainFilter === "hive") return [];
    if (chainFilter === "evm") return all.filter((t) => t.source === "ethereum");
    if (chainFilter === "farcaster") return all.filter((t) => t.source === "farcaster" || t.source === "verified");
    return all; // "all"
  }, [aggregatedPortfolio?.tokens, chainFilter]);

  // Merge, consolidate, filter (Hive tokens always bypass dust filter)
  const consolidatedTokens = useMemo(() => {
    const showHive = chainFilter === "all" || chainFilter === "hive";
    const combined = [...(showHive ? hiveTokens : []), ...filteredEVMTokens];
    const consolidated = consolidateTokensBySymbol(combined);

    const filtered = consolidated.filter((token) => {
      // Hive tokens always show regardless of dust filter
      if (token.chains.some((c) => c.network === "hive")) return true;
      if (!hideSmallBalances) return true;
      return token.totalBalanceUSD >= minBalanceThreshold || token.symbol.toLowerCase() === "higher";
    });

    return sortConsolidatedTokensByBalance(filtered);
  }, [hiveTokens, filteredEVMTokens, hideSmallBalances, chainFilter]);

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
          <DesktopTokenTable
            consolidatedTokens={consolidatedTokens}
            expandedTokens={expandedTokens}
            onToggleExpansion={toggleTokenExpansion}
            onSendToken={handleSendToken}
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
    </Box>
  );
}
