"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useFarcasterSession } from "../../hooks/useFarcasterSession";
import useHiveAccount from "@/hooks/useHiveAccount";
import useMarketPrices from "@/hooks/useMarketPrices";
import { useBankActions } from "@/hooks/wallet";
import { useAccount } from "wagmi";
import { useTranslations } from "@/contexts/LocaleContext";
import {
  Box,
  Grid,
  Text,
  Spinner,
  useDisclosure,
  VStack,
  HStack,
  Button,
  Image,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  useToast,
} from "@chakra-ui/react";
import { useAioha } from "@aioha/react-ui";
import HiveLoginModal from "@/components/layout/HiveLoginModal";
import { convertVestToHive } from "@/lib/hive/client-functions";
import { extractNumber } from "@/lib/utils/extractNumber";
import { Asset } from "@hiveio/dhive";
import HivePowerSection from "./HivePowerSection";
import SkateBankSection from "./SkateBankSection";
import NFTSection from "./NFTSection";

import { PortfolioProvider } from "@/contexts/PortfolioContext";
import { FarcasterEnhancedUserData } from "@/types/farcaster";
import TotalPortfolioValue from "./components/TotalPortfolioValue";
import PIXTabContent from "./components/PIXTabContent";
import HiveTransactionHistory from "./components/HiveTransactionHistory";
import ClaimRewards from "./components/ClaimRewards";
import UnifiedWalletTable from "./UnifiedWalletTable";
import UnifiedSwapSection from "./UnifiedSwapSection";
import WalletErrorBoundary from "./WalletErrorBoundary";

const HBD_SAVINGS_APR = 0.15; // 15% annual interest rate on HBD Savings

type ChainFilter = "all" | "hive" | "evm" | "farcaster";

interface MainWalletProps {
  username?: string;
}

export default function MainWallet({ username }: MainWalletProps) {
  const { user } = useAioha();
  const { hiveAccount, isLoading } = useHiveAccount(user || "");
  const { claimInterest } = useBankActions();
  const { isConnected, address } = useAccount();
  const { isAuthenticated: isFarcasterConnected, profile: farcasterProfile } =
    useFarcasterSession();

  const [farcasterUserData, setFarcasterUserData] =
    useState<FarcasterEnhancedUserData | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [chainFilter, setChainFilter] = useState<ChainFilter>("all");
  const [hivePower, setHivePower] = useState<string | undefined>(undefined);

  const { hivePrice, hbdPrice, isPriceLoading } = useMarketPrices();
  const toast = useToast();
  const t = useTranslations();

  const {
    isOpen: isHiveModalOpen,
    onOpen: openHiveModal,
    onClose: closeHiveModal,
  } = useDisclosure();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  function assetToString(val: string | Asset): string {
    return typeof val === "string" ? val : val.toString();
  }

  useEffect(() => {
    const fetchHivePower = async () => {
      if (hiveAccount?.vesting_shares) {
        try {
          const power = (
            await convertVestToHive(
              Number(extractNumber(String(hiveAccount.vesting_shares))),
            )
          ).toFixed(3);
          setHivePower(power.toString());
        } catch (err) {
          console.error("Failed to convert vesting shares", err);
        }
      }
    };
    fetchHivePower();
  }, [hiveAccount?.vesting_shares]);

  const handleConnectHive = useCallback(() => {
    if (!user) openHiveModal();
  }, [user, openHiveModal]);

  const handleClaimHbdInterest = useCallback(async () => {
    const result = await claimInterest();
    toast({
      title: result.success ? t("status.success") : t("common.error"),
      description: result.success
        ? t("notifications.success.transactionComplete")
        : result.error || t("notifications.error.failedToSend"),
      status: result.success ? "success" : "error",
      duration: 5000,
      isClosable: true,
    });
  }, [claimInterest, toast, t]);

  const hiveBalances = useMemo(() => {
    const balance =
      user && hiveAccount?.balance
        ? String(extractNumber(assetToString(hiveAccount.balance)))
        : "N/A";
    const hbdBalance =
      user && hiveAccount?.hbd_balance
        ? String(extractNumber(assetToString(hiveAccount.hbd_balance)))
        : "N/A";
    const hbdSavingsBalance =
      user && hiveAccount?.savings_hbd_balance
        ? String(extractNumber(assetToString(hiveAccount.savings_hbd_balance)))
        : "N/A";
    return { balance, hbdBalance, hbdSavingsBalance };
  }, [
    user,
    hiveAccount?.balance,
    hiveAccount?.hbd_balance,
    hiveAccount?.savings_hbd_balance,
  ]);

  const hbdInterestData = useMemo(() => {
    if (!user || !hiveAccount?.savings_hbd_balance) {
      return {
        savingsHbdBalance: 0,
        estimatedClaimableInterest: 0,
        daysUntilClaim: 0,
        lastInterestPayment: undefined,
      };
    }
    const savingsHbdBalance = parseFloat(
      String(hiveAccount.savings_hbd_balance || "0.000"),
    );
    const lastInterestPayment = hiveAccount.savings_hbd_last_interest_payment;
    let daysSinceLastPayment = 0;
    if (lastInterestPayment) {
      const last = new Date(lastInterestPayment);
      daysSinceLastPayment = Math.max(
        0,
        Math.floor((Date.now() - last.getTime()) / (1000 * 60 * 60 * 24)),
      );
    }
    const estimatedClaimableInterest =
      savingsHbdBalance * HBD_SAVINGS_APR * (daysSinceLastPayment / 365);
    let daysUntilClaim = 0;
    if (lastInterestPayment) {
      const nextClaimDate = new Date(
        new Date(lastInterestPayment).getTime() + 30 * 24 * 60 * 60 * 1000,
      );
      daysUntilClaim = Math.max(
        0,
        Math.ceil(
          (nextClaimDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        ),
      );
    }
    return {
      savingsHbdBalance,
      estimatedClaimableInterest,
      daysUntilClaim,
      lastInterestPayment,
    };
  }, [
    user,
    hiveAccount?.savings_hbd_balance,
    hiveAccount?.savings_hbd_last_interest_payment,
  ]);

  const totalHiveAssetsValue = useMemo(() => {
    if (!user || !hivePrice || !hbdPrice) return 0;
    const hive = parseFloat(
      hiveBalances.balance === "N/A" ? "0" : hiveBalances.balance,
    );
    const hp = parseFloat(hivePower || "0");
    const hbd = parseFloat(
      hiveBalances.hbdBalance === "N/A" ? "0" : hiveBalances.hbdBalance,
    );
    const hbdSav = parseFloat(
      hiveBalances.hbdSavingsBalance === "N/A"
        ? "0"
        : hiveBalances.hbdSavingsBalance,
    );
    return (hive + hp) * hivePrice + (hbd + hbdSav) * hbdPrice;
  }, [user, hivePrice, hbdPrice, hiveBalances, hivePower]);

  const hasEVM = isMounted && (isConnected || isFarcasterConnected);
  const hasFarcaster = isMounted && isFarcasterConnected;

  if ((isLoading && user) || !isMounted) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <Spinner size="xl" color="primary" />
      </Box>
    );
  }

  const chainFilterButtons: {
    key: ChainFilter;
    label: string;
    logo?: string;
    show: boolean;
  }[] = [
    { key: "all", label: "All Chains", show: true },
    { key: "hive", label: "Hive", logo: "/logos/hiveLogo.png", show: !!user },
    {
      key: "evm",
      label: "EVM",
      logo: "/logos/ethereum_logo.png",
      show: hasEVM,
    },
    {
      key: "farcaster",
      label: "Farcaster",
      logo: "/logos/farcaster.svg",
      show: hasFarcaster,
    },
  ];

  const showHiveExtras =
    (chainFilter === "all" || chainFilter === "hive") && !!user;

  return (
    <>
      <WalletErrorBoundary>
      <PortfolioProvider
        address={isConnected ? address : undefined}
        farcasterAddress={
          farcasterUserData && !farcasterUserData.failed
            ? farcasterUserData.custody
            : isFarcasterConnected &&
                farcasterProfile &&
                "custody" in farcasterProfile
              ? farcasterProfile?.custody
              : undefined
        }
        farcasterVerifiedAddresses={
          farcasterUserData && !farcasterUserData.failed
            ? farcasterUserData.verifications
            : isFarcasterConnected &&
                farcasterProfile &&
                "verifications" in farcasterProfile
              ? farcasterProfile?.verifications
              : undefined
        }
      >
        <Box
          w="100%"
          maxW="100vw"
          overflowX="hidden"
          sx={{ scrollbarWidth: "none" }}
        >
          <Grid
            templateColumns={{ base: "1fr", md: "2fr 1fr" }}
            gap={{ base: 4, md: 6 }}
            alignItems="stretch"
            m={{ base: 0, md: 4 }}
            height={{ md: "100%" }}
          >
            {/* ── LEFT: Main Wallet Panel ── */}
            <Box
              bg="muted"
              display="flex"
              flexDirection="column"
              height="100%"
              minW={0}
            >
              <Tabs variant="unstyled" size="md" flex={1}>
                <TabList
                  mb={4}
                  bg="background"
                  border="1px solid"
                  borderColor="border"
                  borderRadius="none"
                  p={0}
                  gap={0}
                >
                  {(
                    [
                      { label: "Wallet Overview", show: true },
                      { label: "Art", show: isConnected },
                      { label: "SkateBank", show: !!user },
                      { label: "PIX", show: !!user },
                    ] as { label: string; show: boolean }[]
                  )
                    .filter((t) => t.show)
                    .map((t, i, arr) => (
                      <Tab
                        key={t.label}
                        flex={1}
                        borderRadius="none"
                        borderRight={i < arr.length - 1 ? "1px solid" : "none"}
                        borderColor="border"
                        fontWeight="bold"
                        fontSize={{ base: "xs", md: "sm" }}
                        py={3}
                        letterSpacing="wide"
                        _selected={{
                          bg: "primary",
                          color: "background",
                          borderColor: "primary",
                        }}
                        _hover={{ opacity: 0.8 }}
                      >
                        {t.label}
                      </Tab>
                    ))}
                </TabList>

                <TabPanels flex={1}>
                  {/* ── WALLET OVERVIEW ── */}
                  <TabPanel p={0}>
                    {/* Total value */}
                    <TotalPortfolioValue
                      totalHiveAssetsValue={totalHiveAssetsValue}
                      chainFilter={chainFilter}
                    />

                    {/* Chain filter pills */}
                    <HStack spacing={2} mb={4} flexWrap="wrap" justify="center">
                      {chainFilterButtons
                        .filter((b) => b.show)
                        .map((btn) => (
                          <Button
                            key={btn.key}
                            size="sm"
                            variant={
                              chainFilter === btn.key ? "solid" : "outline"
                            }
                            colorScheme={
                              chainFilter === btn.key ? "orange" : "gray"
                            }
                            onClick={() => setChainFilter(btn.key)}
                            fontWeight={
                              chainFilter === btn.key ? "bold" : "normal"
                            }
                            borderRadius="none"
                            letterSpacing="wide"
                            leftIcon={
                              btn.logo ? (
                                <Image
                                  src={btn.logo}
                                  w="14px"
                                  h="14px"
                                  borderRadius="none"
                                  alt={btn.label}
                                />
                              ) : undefined
                            }
                          >
                            {btn.label}
                          </Button>
                        ))}
                    </HStack>

                    {/* Unified token table */}
                    <UnifiedWalletTable
                      chainFilter={chainFilter}
                      hiveBalance={hiveBalances.balance}
                      hbdBalance={hiveBalances.hbdBalance}
                      hivePower={hivePower || "0"}
                      hbdSavingsBalance={hiveBalances.hbdSavingsBalance}
                      hivePrice={hivePrice}
                      hbdPrice={hbdPrice}
                      hiveUser={user}
                    />

                    {/* Hive activity history */}
                    {showHiveExtras && (
                      <Box mt={4}>
                        <HiveTransactionHistory searchAccount={user} />
                      </Box>
                    )}
                  </TabPanel>

                  {/* ── ART ── */}
                  {isConnected && (
                    <TabPanel p={0}>
                      <NFTSection />
                    </TabPanel>
                  )}

                  {/* ── SKATEBANK ── */}
                  {user && (
                    <TabPanel p={0}>
                      <VStack spacing={4} align="stretch">
                        <HivePowerSection
                          hivePower={hivePower}
                          hivePrice={hivePrice}
                          hiveBalance={hiveBalances.balance}
                        />
                        <SkateBankSection
                          hbdBalance={hiveBalances.hbdBalance}
                          hbdSavingsBalance={hiveBalances.hbdSavingsBalance}
                          hbdPrice={hbdPrice}
                          estimatedClaimableInterest={
                            hbdInterestData.estimatedClaimableInterest
                          }
                          daysUntilClaim={hbdInterestData.daysUntilClaim}
                          lastInterestPayment={
                            hbdInterestData.lastInterestPayment
                          }
                          savings_withdraw_requests={
                            hiveAccount?.savings_withdraw_requests || 0
                          }
                          onClaimInterest={handleClaimHbdInterest}
                        />
                      </VStack>
                    </TabPanel>
                  )}

                  {/* ── PIX ── */}
                  {user && (
                    <TabPanel p={0}>
                      <VStack spacing={4} align="stretch">
                        <PIXTabContent />
                      </VStack>
                    </TabPanel>
                  )}
                </TabPanels>
              </Tabs>
            </Box>

            {/* ── RIGHT: Swap (desktop only) ── */}
            <VStack
              display={{ base: "none", md: "flex" }}
              spacing={4}
              align="stretch"
              maxW={{ base: "100%", md: "340px" }}
              mx={{ base: 0, md: "auto" }}
              height="100%"
              justifyContent="flex-start"
              minW={0}
            >
              <UnifiedSwapSection
                hivePrice={hivePrice}
                hbdPrice={hbdPrice}
                isPriceLoading={isPriceLoading}
              />
              {user && (
                <ClaimRewards
                  reward_hbd_balance={hiveAccount?.reward_hbd_balance}
                  reward_hive_balance={hiveAccount?.reward_hive_balance}
                  reward_vesting_balance={hiveAccount?.reward_vesting_balance}
                  reward_vesting_hive={hiveAccount?.reward_vesting_hive}
                />
              )}
            </VStack>
          </Grid>

          <HiveLoginModal isOpen={isHiveModalOpen} onClose={closeHiveModal} />
        </Box>
      </PortfolioProvider>
      </WalletErrorBoundary>
    </>
  );
}
