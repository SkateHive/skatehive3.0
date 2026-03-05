"use client";

import {
  Box,
  VStack,
  Spinner,
  Alert,
  AlertIcon,
  Flex,
  useDisclosure,
  useBreakpointValue,
} from "@chakra-ui/react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount } from "wagmi";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { usePortfolioContext } from "../../contexts/PortfolioContext";
import { TokenDetail } from "../../types/portfolio";
import {
  preloadTokenLogos,
  subscribeToLogoUpdates,
  forceRefreshTokenData,
  consolidateTokensBySymbol,
  filterConsolidatedTokensByBalance,
  sortConsolidatedTokensByBalance,
  ConsolidatedToken,
} from "../../lib/utils/portfolioUtils";
import SendTokenModal from "./SendTokenModal";
import TokenControlsBar from "./components/TokenControlsBar";
import MobileTokenTable from "./components/MobileTokenTable";
import DesktopTokenTable from "./components/DesktopTokenTable";

export default function EthereumAssetsSection() {
  const { isConnected, address } = useAccount();
  const { isAuthenticated: isFarcasterConnected, profile: farcasterProfile } =
    useFarcasterSession();
  const {
    aggregatedPortfolio,
    portfolio,
    farcasterPortfolio,
    farcasterVerifiedPortfolios,
    isLoading,
    error,
    refetch,
  } = usePortfolioContext();

  const [hideSmallBalances, setHideSmallBalances] = useState(true);
  const minBalanceThreshold = 1;
  const [logoUpdateTrigger, setLogoUpdateTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenDetail | null>(null);
  const [selectedTokenLogo, setSelectedTokenLogo] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
  const {
    isOpen: isSendModalOpen,
    onOpen: onSendModalOpen,
    onClose: onSendModalClose,
  } = useDisclosure();

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Toggle expanded token details
  const toggleTokenExpansion = useCallback((symbol: string) => {
    setExpandedTokens((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(symbol)) {
        newSet.delete(symbol);
      } else {
        newSet.add(symbol);
      }
      return newSet;
    });
  }, []);

  // Responsive breakpoint for mobile/desktop layout
  const isMobile = useBreakpointValue({ base: true, md: false });

  // Memoize consolidated tokens to prevent unnecessary re-computation
  const memoizedConsolidatedTokens = useMemo(() => {
    const consolidated = consolidateTokensBySymbol(aggregatedPortfolio?.tokens);
    const filtered = filterConsolidatedTokensByBalance(
      consolidated,
      hideSmallBalances,
      minBalanceThreshold
    );
    return sortConsolidatedTokensByBalance(filtered);
  }, [aggregatedPortfolio?.tokens, hideSmallBalances, minBalanceThreshold]);

  // Effect to preload token logos and subscribe to updates - only run once per portfolio change
  useEffect(() => {
    if (aggregatedPortfolio?.tokens && aggregatedPortfolio.tokens.length > 0) {
      // Only preload if not already done for this portfolio
      const portfolioHash = aggregatedPortfolio.tokens
        .map((t) => `${t.network}-${t.token.address}`)
        .join(",");
      const lastHash = sessionStorage.getItem("lastPortfolioHash");

      if (portfolioHash !== lastHash) {
        preloadTokenLogos(aggregatedPortfolio.tokens);
        sessionStorage.setItem("lastPortfolioHash", portfolioHash);
      }

      // Subscribe to logo updates
      const unsubscribe = subscribeToLogoUpdates(() => {
        setLogoUpdateTrigger((prev) => prev + 1);
      });

      return () => {
        unsubscribe();
      };
    }
  }, [aggregatedPortfolio?.tokens]);

  const handleForceRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (aggregatedPortfolio?.tokens) {
        await forceRefreshTokenData(aggregatedPortfolio.tokens);
        // Clear the portfolio hash to allow fresh preloading
        sessionStorage.removeItem("lastPortfolioHash");
      }
      // Refetch portfolio data from API
      refetch();
    } catch (error) {
      console.error("Failed to refresh token data:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [aggregatedPortfolio?.tokens, refetch]);

  const handleSendToken = useCallback(
    (tokenDetail: TokenDetail, logoUrl?: string) => {
      setSelectedToken(tokenDetail);
      setSelectedTokenLogo(logoUrl || "");
      onSendModalOpen();
    },
    [onSendModalOpen]
  );

  const handleTokenSelect = useCallback(
    (consolidatedToken: ConsolidatedToken) => {
      // For now, select the primary chain token for sending
      const primaryToken = consolidatedToken.primaryChain;
      handleSendToken(primaryToken);
    },
    [handleSendToken]
  );

  const handleToggleSmallBalances = useCallback((checked: boolean) => {
    setHideSmallBalances(checked);
  }, []);

  // Log the condition check for showing assets
  const shouldShowAssets = useMemo(() => {
    if (!isMounted) return false;

    // Show assets if:
    // 1. Ethereum wallet is connected
    // 2. Farcaster is connected with custody address
    // 3. We have any portfolio data (ethereum, farcaster, or verified addresses)
    const hasEthereumWallet = isConnected && address;
    const hasFarcasterWithCustody =
      isFarcasterConnected && farcasterProfile?.custody;
    const hasAnyPortfolioData = !!(
      portfolio ||
      farcasterPortfolio ||
      (farcasterVerifiedPortfolios &&
        Object.keys(farcasterVerifiedPortfolios).length > 0) ||
      aggregatedPortfolio
    );

    return hasEthereumWallet || hasFarcasterWithCustody || hasAnyPortfolioData;
  }, [
    isMounted,
    isConnected,
    address,
    isFarcasterConnected,
    farcasterProfile?.custody,
    portfolio,
    farcasterPortfolio,
    farcasterVerifiedPortfolios,
    aggregatedPortfolio,
  ]);

  return (
    <Box mt={8} p={2} borderRadius="base" bg="muted" w="100%" textAlign="left">
      {shouldShowAssets && (
        <Box overflowX="hidden">
          {isLoading && (
            <Flex justify="center" align="center" py={4}>
              <Spinner color="primary" />
            </Flex>
          )}

          {error && (
            <Alert status="error" mb={4}>
              <AlertIcon />
              {error}
            </Alert>
          )}

          {/* Always show Ethereum assets if connected */}
          {aggregatedPortfolio && (
            <>
              {isMobile ? (
                // Mobile Layout with Token Table
                <VStack spacing={4} align="stretch">
                  <TokenControlsBar
                    isRefreshing={isRefreshing}
                    hideSmallBalances={hideSmallBalances}
                    onRefresh={handleForceRefresh}
                    onToggleSmallBalances={handleToggleSmallBalances}
                  />
                  {/* Token Table */}
                  <MobileTokenTable
                    consolidatedTokens={memoizedConsolidatedTokens}
                    expandedTokens={expandedTokens}
                    onToggleExpansion={toggleTokenExpansion}
                    onTokenSelect={handleTokenSelect}
                  />
                </VStack>
              ) : (
                // Desktop Table Layout
                <Box overflowX="hidden" w="100%">
                  <TokenControlsBar
                    isRefreshing={isRefreshing}
                    hideSmallBalances={hideSmallBalances}
                    onRefresh={handleForceRefresh}
                    onToggleSmallBalances={handleToggleSmallBalances}
                  />
                  <DesktopTokenTable
                    consolidatedTokens={memoizedConsolidatedTokens}
                    expandedTokens={expandedTokens}
                    onToggleExpansion={toggleTokenExpansion}
                    onSendToken={handleSendToken}
                  />
                  {/* Token Controls */}
                </Box>
              )}
            </>
          )}
        </Box>
      )}

      {/* Send Token Modal */}
      {selectedToken && (
        <SendTokenModal
          isOpen={isSendModalOpen}
          onClose={onSendModalClose}
          token={selectedToken}
          tokenLogo={selectedTokenLogo}
        />
      )}
    </Box>
  );
}
