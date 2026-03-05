"use client";

import {
  Box,
  VStack,
  useToast,

} from "@chakra-ui/react";
import { useAccount, useDisconnect } from "wagmi";
import { useFarcasterSession } from "../../hooks/useFarcasterSession";
import { useSignIn } from "@farcaster/auth-kit";

import { memo, useCallback, useMemo } from "react";
import { usePortfolioContext } from "../../contexts/PortfolioContext";
import { WalletDistributionChart } from "./WalletDistributionChart";

interface WalletSummaryProps {
  hiveUsername?: string;
  totalHiveValue: number;
  isPriceLoading: boolean;
  onConnectEthereum: () => void;
  onConnectHive: () => void;
}

const WalletSummary = memo(function WalletSummary({
  hiveUsername,
  totalHiveValue,
  onConnectEthereum,
  onConnectHive,
}: WalletSummaryProps) {
  const { isConnected: isEthConnected, address } = useAccount();
  const {
    isAuthenticated: isFarcasterConnected,
    profile: farcasterProfile,
    clearSession,
  } = useFarcasterSession();
  const { signOut } = useSignIn({});
  const {
    farcasterVerifiedPortfolios,
    portfolio,
    farcasterPortfolio,
  } = usePortfolioContext();
  const { disconnect } = useDisconnect();
  const toast = useToast();

  // Memoize connection status
  const connectionStatus = useMemo(
    () => ({
      hasWallets: isEthConnected || !!hiveUsername || isFarcasterConnected,
      needsEthereum: !isEthConnected,
      needsHive: !hiveUsername,
      needsFarcaster: !isFarcasterConnected,
      hasDigitalAssets: isEthConnected || isFarcasterConnected,
    }),
    [isEthConnected, hiveUsername, isFarcasterConnected]
  );

  // Case 1: No wallets connected
  if (!connectionStatus.hasWallets) {
    return <></>;
  }

  // Case 2: At least one wallet connected - show summary
  return (
    <Box
      p={6}
      bg="background"
      border="1px solid"
      borderColor="border"
      position="relative"
      overflow="hidden"
    >
      <VStack spacing={6} align="stretch" position="relative" zIndex={1}>
        {/* Portfolio Distribution Chart */}
        <WalletDistributionChart
          ethPortfolio={portfolio?.totalNetWorth || 0}
          farcasterPortfolio={farcasterPortfolio?.totalNetWorth || 0}
          farcasterVerifiedPortfolios={farcasterVerifiedPortfolios}
          hiveValue={totalHiveValue}
          farcasterProfile={farcasterProfile}
          connectedEthAddress={address}
        />
      </VStack>
    </Box>
  );
});

export default WalletSummary;
