"use client";
import { useState, useEffect, useMemo, Fragment } from "react";
import { Box, Text, Button, HStack, VStack } from "@chakra-ui/react";
import { FaExchangeAlt, FaHive, FaCog, FaBitcoin } from "react-icons/fa";
import CrossChainSwapPanel from "./CrossChainSwapPanel";
import { useAioha } from "@aioha/react-ui";
import { shimmerStyles } from "@/lib/utils/animations";
import { useAccount } from "wagmi";
import { useTranslations } from "@/contexts/LocaleContext";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import ERC20SwapSection from "./ERC20SwapSection";
import HiveSwapPanel from "./HiveSwapPanel";
import BridgeSection from "./BridgeSection";
import SwapFeeAdminPanel from "./admin/SwapFeeAdminPanel";
import { useSplitFeeAdmin } from "@/hooks/useSplitFeeAdmin";

// ─── Props ────────────────────────────────────────────────────────────────────
interface UnifiedSwapSectionProps {
  /** Pass through to ERC20SwapSection */
  showFeeOption?: boolean;
  /** Always show both tabs even if one chain isn't connected. For standalone pages. */
  alwaysShowToggle?: boolean;
}

// ─── EVM Swap + Bridge (one tab, sub-toggle) ──────────────────────────────────
function EvmSwapBridge({ showFeeOption }: { showFeeOption?: boolean }) {
  const t = useTranslations();
  const [sub, setSub] = useState<"swap" | "bridge">("swap");
  return (
    <VStack spacing={3} align="stretch">
      <HStack spacing={0} border="1px solid" borderColor="border" alignSelf="center">
        {(["swap", "bridge"] as const).map((k) => {
          const active = sub === k;
          return (
            <Button
              key={k}
              size="xs"
              h="26px"
              px={5}
              borderRadius="none"
              fontFamily="mono"
              fontWeight="bold"
              fontSize="10px"
              textTransform="uppercase"
              letterSpacing="wider"
              bg={active ? "primary" : "transparent"}
              color={active ? "background" : "dim"}
              onClick={() => setSub(k)}
              _hover={{ color: active ? "background" : "primary" }}
              _active={{}}
            >
              {k === "swap" ? t("common.swap") : t("bridge.tab")}
            </Button>
          );
        })}
      </HStack>
      {sub === "swap" ? (
        <ERC20SwapSection compact showFeeOption={showFeeOption} />
      ) : (
        <BridgeSection />
      )}
    </VStack>
  );
}

// ─── Unified wrapper ──────────────────────────────────────────────────────────
type SwapMode = "hive" | "crosschain" | "erc20" | "admin";

export default function UnifiedSwapSection(props: UnifiedSwapSectionProps) {
  const t = useTranslations();
  const { isConnected } = useAccount();
  const { user: hiveUser } = useAioha();
  const { isAuthenticated: isFarcasterConnected, profile: farcasterProfile } =
    useFarcasterSession();

  // Admin gate for the fee-split panel (EVM owner or allowlist). Cheap reads only.
  const { isAdmin: isSplitAdmin } = useSplitFeeAdmin();

  const hasHive = !!hiveUser;
  const farcasterVerifications =
    (farcasterProfile as { verifications?: string[] } | null)?.verifications ?? [];
  const hasEVMLinked =
    isConnected || (isFarcasterConnected && farcasterVerifications.length > 0);

  const showBothCore =
    props.alwaysShowToggle || (hasHive && (hasEVMLinked || isConnected));

  const tabs = useMemo<SwapMode[]>(() => {
    const core: SwapMode[] = showBothCore
      ? ["hive", "erc20"]
      : hasHive
        ? ["hive"]
        : ["erc20"];
    // Magi cross-chain (→ real BTC) — available to any Hive user.
    if (hasHive) core.splice(1, 0, "crosschain");
    if (isSplitAdmin) core.push("admin");
    return core;
  }, [showBothCore, hasHive, isSplitAdmin]);

  const [mode, setMode] = useState<SwapMode>(() =>
    props.alwaysShowToggle ? "erc20" : hasHive ? "hive" : "erc20",
  );

  // Keep the active mode valid as tab availability changes.
  useEffect(() => {
    if (!tabs.includes(mode)) setMode(tabs[0]);
  }, [tabs, mode]);

  const showTabBar = tabs.length > 1;

  const tabMeta: Record<SwapMode, { label: string; icon: React.ReactElement }> = {
    hive: { label: t("swapAdmin.hiveTab"), icon: <FaHive /> },
    crosschain: { label: "Bitcoin", icon: <FaBitcoin /> },
    erc20: { label: t("swapAdmin.erc20Tab"), icon: <FaExchangeAlt /> },
    admin: { label: t("swapAdmin.tab"), icon: <FaCog /> },
  };

  return (
    <Box
      position="relative"
      border="2px solid"
      borderColor="primary"
      overflow="visible"
      width="100%"
      sx={shimmerStyles}
    >
      {showTabBar ? (
        <HStack px={0} bg="primary" spacing={0}>
          {tabs.map((tabKey, i) => (
            <Fragment key={tabKey}>
              {i > 0 && <Box w="1px" h="32px" bg="background" opacity={0.3} />}
              <Button
                flex={1}
                size="sm"
                px={1}
                minW={0}
                borderRadius="none"
                fontFamily="mono"
                fontWeight="black"
                letterSpacing="wider"
                fontSize="xs"
                textTransform="uppercase"
                bg={mode === tabKey ? "primary" : "transparent"}
                color="background"
                opacity={mode === tabKey ? 1 : 0.45}
                leftIcon={tabMeta[tabKey].icon}
                onClick={() => setMode(tabKey)}
                _hover={{ opacity: 1 }}
                _active={{}}
              >
                {tabMeta[tabKey].label}
              </Button>
            </Fragment>
          ))}
        </HStack>
      ) : (
        <HStack px={3} py={2} bg="primary">
          {mode === "hive" ? (
            <FaHive color="var(--chakra-colors-background)" />
          ) : (
            <FaExchangeAlt color="var(--chakra-colors-background)" />
          )}
          <Text
            fontFamily="mono"
            fontWeight="black"
            fontSize="xs"
            color="background"
            textTransform="uppercase"
            letterSpacing="widest"
          >
            {mode === "hive" ? t("swapAdmin.hiveSwapTitle") : t("swapAdmin.erc20SwapTitle")}
          </Text>
        </HStack>
      )}

      <Box px={3} py={3}>
        {mode === "hive" ? (
          <HiveSwapPanel />
        ) : mode === "crosschain" ? (
          <CrossChainSwapPanel />
        ) : mode === "admin" ? (
          <SwapFeeAdminPanel />
        ) : (
          <EvmSwapBridge showFeeOption={props.showFeeOption} />
        )}
      </Box>
    </Box>
  );
}
