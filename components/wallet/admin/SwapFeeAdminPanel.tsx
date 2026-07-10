"use client";

/**
 * Admin panel for the Skatehive swap-fee split (0xSplits PullSplit V2.2 on Base).
 * Read-only status plus a one-click `distribute` per fee token. Visibility is
 * gated by the parent (UnifiedSwapSection) via `useSplitFeeAdmin().isAdmin`, but
 * the panel also guards chain / config / authorization defensively.
 *
 * Architecture note: recipient editing (`updateSplit`) is intentionally not
 * wired here yet — the hook and ABI already expose it for a future iteration.
 */
import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  HStack,
  Image,
  Link,
  Spinner,
  Text,
  Tooltip,
  VStack,
  useToast,
} from "@chakra-ui/react";
import {
  FaCheckCircle,
  FaCopy,
  FaExternalLinkAlt,
  FaExclamationTriangle,
  FaSyncAlt,
} from "react-icons/fa";
import { UserRejectedRequestError, type Address } from "viem";
import { useAccount } from "wagmi";
import { useTranslations } from "@/contexts/LocaleContext";
import { useSplitFeeAdmin, type SplitTokenBalance } from "@/hooks/useSplitFeeAdmin";
import { shortAddress } from "@/lib/evm/splits";

function isUserRejection(e: unknown): boolean {
  if (e instanceof UserRejectedRequestError) return true;
  const text = `${(e as { shortMessage?: string })?.shortMessage ?? ""} ${
    (e as { message?: string })?.message ?? ""
  }`.toLowerCase();
  return text.includes("user denied") || text.includes("user rejected");
}

function friendlyError(e: unknown): string {
  return (
    (e as { shortMessage?: string })?.shortMessage ||
    (e instanceof Error ? e.message : null) ||
    "Unknown error"
  );
}

// ─── Small building blocks ─────────────────────────────────────────────────

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <HStack justify="space-between" align="center" spacing={3}>
      <Text
        fontSize="xs"
        color="dim"
        fontFamily="mono"
        textTransform="uppercase"
        letterSpacing="wider"
        flexShrink={0}
      >
        {label}
      </Text>
      <Box textAlign="right" minW={0}>
        {children}
      </Box>
    </HStack>
  );
}

function CopyableAddress({ address, label }: { address: string; label: string }) {
  const toast = useToast();
  const copy = useCallback(() => {
    navigator.clipboard?.writeText(address);
    toast({ title: label, status: "success", duration: 1500, isClosable: true });
  }, [address, label, toast]);
  return (
    <HStack spacing={1} justify="flex-end">
      <Text fontSize="xs" color="text" fontFamily="mono">
        {shortAddress(address)}
      </Text>
      <Button
        aria-label={label}
        size="xs"
        h="16px"
        minW="16px"
        px={0}
        variant="ghost"
        color="dim"
        onClick={copy}
        _hover={{ color: "primary" }}
      >
        <FaCopy size={10} />
      </Button>
    </HStack>
  );
}

function TokenBalanceRow({
  item,
  disabled,
  isBusy,
  onDistribute,
}: {
  item: SplitTokenBalance;
  disabled: boolean;
  isBusy: boolean;
  onDistribute: (token: SplitTokenBalance) => void;
}) {
  const t = useTranslations();
  return (
    <HStack
      justify="space-between"
      border="1px solid"
      borderColor="border"
      p={2.5}
      spacing={2}
    >
      <HStack spacing={2} flex={1} minW={0}>
        {item.token.logo ? (
          <Image
            src={item.token.logo}
            w="24px"
            h="24px"
            objectFit="contain"
            borderRadius="full"
            alt=""
            fallback={<Box w="24px" h="24px" borderRadius="full" bg="border" />}
          />
        ) : (
          <Box w="24px" h="24px" borderRadius="full" bg="border" />
        )}
        <VStack spacing={0} align="start" minW={0}>
          <Text fontSize="sm" fontWeight="black" fontFamily="mono" color="text">
            {item.token.symbol}
          </Text>
          <Text fontSize="xs" color="dim" fontFamily="mono" isTruncated maxW="140px">
            {item.formatted}
          </Text>
        </VStack>
      </HStack>
      <Button
        size="xs"
        borderRadius="none"
        fontFamily="mono"
        fontWeight="black"
        letterSpacing="wider"
        textTransform="uppercase"
        colorScheme="green"
        isDisabled={disabled || !item.distributable}
        isLoading={isBusy}
        loadingText={t("swapAdmin.distributing")}
        onClick={() => onDistribute(item)}
      >
        {t("swapAdmin.distribute")}
      </Button>
    </HStack>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

export default function SwapFeeAdminPanel() {
  const t = useTranslations();
  const toast = useToast();
  const { isConnected } = useAccount();

  const {
    isAdmin,
    onBase,
    switchToBase,
    isSwitching,
    owner,
    paused,
    isConfigCurrent,
    recipients,
    balances,
    isLoading,
    isRefetching,
    distribute,
    isConfirming,
    isConfirmed,
    resetTx,
    refetch,
    config,
  } = useSplitFeeAdmin({ balancesEnabled: true });

  const [pendingToken, setPendingToken] = useState<Address | null>(null);

  // Refetch balances once a distribution confirms.
  useEffect(() => {
    if (isConfirmed) {
      toast({
        title: t("swapAdmin.distributed"),
        status: "success",
        duration: 4000,
        isClosable: true,
      });
      refetch();
      setPendingToken(null);
      resetTx();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfirmed]);

  const handleDistribute = useCallback(
    async (item: SplitTokenBalance) => {
      setPendingToken(item.token.address);
      try {
        const hash = await distribute(item.token.address);
        toast({
          title: t("swapAdmin.txSubmitted"),
          description: hash,
          status: "info",
          duration: 5000,
          isClosable: true,
        });
      } catch (e: unknown) {
        setPendingToken(null);
        if (isUserRejection(e)) {
          toast({
            title: t("swapAdmin.txCancelled"),
            status: "warning",
            duration: 2500,
            isClosable: true,
          });
        } else {
          toast({
            title: t("swapAdmin.distributeFailed"),
            description: friendlyError(e),
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      }
    },
    [distribute, t, toast],
  );

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <Box border="1px solid" borderColor="border" p={4} textAlign="center">
        <Text fontSize="xs" color="dim" fontFamily="mono">
          {t("swapAdmin.connectWallet")}
        </Text>
      </Box>
    );
  }

  if (!isAdmin) {
    return (
      <Box border="1px solid" borderColor="border" p={4} textAlign="center">
        <Text fontSize="xs" color="dim" fontFamily="mono">
          {t("swapAdmin.notAuthorized")}
        </Text>
      </Box>
    );
  }

  const distributeDisabled = !onBase || isConfigCurrent === false || isConfirming;

  return (
    <VStack spacing={3} align="stretch">
      {/* Wrong network CTA */}
      {!onBase && (
        <Box border="1px solid" borderColor="warning" p={3}>
          <HStack spacing={2} mb={2}>
            <Box as="span" color="warning">
              <FaExclamationTriangle />
            </Box>
            <Text fontSize="xs" color="warning" fontFamily="mono">
              {t("swapAdmin.wrongNetwork")}
            </Text>
          </HStack>
          <Button
            w="100%"
            size="sm"
            borderRadius="none"
            fontFamily="mono"
            fontWeight="black"
            letterSpacing="wider"
            textTransform="uppercase"
            colorScheme="orange"
            isLoading={isSwitching}
            onClick={switchToBase}
          >
            {t("swapAdmin.switchToBase")}
          </Button>
        </Box>
      )}

      {/* Config-changed warning */}
      {isConfigCurrent === false && (
        <Box border="1px solid" borderColor="error" p={3}>
          <HStack spacing={2}>
            <Box as="span" color="error">
              <FaExclamationTriangle />
            </Box>
            <Text fontSize="xs" color="error" fontFamily="mono">
              {t("swapAdmin.configOutdated")}
            </Text>
          </HStack>
        </Box>
      )}

      {/* Contract status card */}
      <Box border="1px solid" borderColor="border" p={3}>
        <HStack justify="space-between" mb={3}>
          <Text
            fontSize="xs"
            color="primary"
            fontFamily="mono"
            fontWeight="black"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            {t("swapAdmin.contract")}
          </Text>
          <Button
            aria-label={t("swapAdmin.refresh")}
            size="xs"
            h="18px"
            variant="ghost"
            color="dim"
            leftIcon={<FaSyncAlt size={10} />}
            fontFamily="mono"
            fontSize="10px"
            isLoading={isRefetching}
            onClick={refetch}
            _hover={{ color: "primary" }}
          >
            {t("swapAdmin.refresh")}
          </Button>
        </HStack>

        <VStack spacing={2} align="stretch">
          <InfoRow label={t("swapAdmin.address")}>
            <CopyableAddress address={config.address} label={t("swapAdmin.copied")} />
          </InfoRow>
          <InfoRow label={t("swapAdmin.owner")}>
            {owner ? (
              <CopyableAddress address={owner} label={t("swapAdmin.copied")} />
            ) : (
              <Spinner size="xs" color="dim" />
            )}
          </InfoRow>
          <InfoRow label={t("swapAdmin.status")}>
            {paused === undefined ? (
              <Spinner size="xs" color="dim" />
            ) : (
              <Text
                fontSize="xs"
                fontFamily="mono"
                fontWeight="bold"
                color={paused ? "error" : "success"}
              >
                {paused ? t("swapAdmin.paused") : t("swapAdmin.active")}
              </Text>
            )}
          </InfoRow>
        </VStack>

        <HStack spacing={4} mt={3} pt={3} borderTop="1px solid" borderColor="border">
          <Link
            href={config.explorerUrl}
            isExternal
            fontSize="10px"
            fontFamily="mono"
            color="primary"
            _hover={{ textDecoration: "underline" }}
          >
            <HStack spacing={1}>
              <Text>{t("swapAdmin.viewOnExplorer")}</Text>
              <FaExternalLinkAlt size={8} />
            </HStack>
          </Link>
          <Link
            href={config.splitsAppUrl}
            isExternal
            fontSize="10px"
            fontFamily="mono"
            color="primary"
            _hover={{ textDecoration: "underline" }}
          >
            <HStack spacing={1}>
              <Text>{t("swapAdmin.viewOnSplits")}</Text>
              <FaExternalLinkAlt size={8} />
            </HStack>
          </Link>
        </HStack>
      </Box>

      {/* Recipients */}
      <Box border="1px solid" borderColor="border" p={3}>
        <Text
          fontSize="xs"
          color="primary"
          fontFamily="mono"
          fontWeight="black"
          textTransform="uppercase"
          letterSpacing="wider"
          mb={3}
        >
          {t("swapAdmin.recipients")}
        </Text>
        <VStack spacing={2} align="stretch">
          {recipients.map((r) => (
            <HStack key={r.address} justify="space-between">
              <CopyableAddress address={r.address} label={t("swapAdmin.copied")} />
              <Text fontSize="xs" fontFamily="mono" fontWeight="black" color="primary">
                {r.percent}%
              </Text>
            </HStack>
          ))}
        </VStack>
      </Box>

      {/* Distributable balances */}
      <Box border="1px solid" borderColor="border" p={3}>
        <HStack justify="space-between" mb={3}>
          <Text
            fontSize="xs"
            color="primary"
            fontFamily="mono"
            fontWeight="black"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            {t("swapAdmin.balances")}
          </Text>
          <Tooltip label={t("swapAdmin.balancesHint")}>
            <Box as="span" cursor="help" color="dim">
              <FaCheckCircle size={12} />
            </Box>
          </Tooltip>
        </HStack>

        {isLoading ? (
          <HStack spacing={2} py={2} justify="center">
            <Spinner size="sm" color="primary" />
            <Text fontSize="xs" color="dim" fontFamily="mono">
              {t("common.loading")}
            </Text>
          </HStack>
        ) : (
          <VStack spacing={2} align="stretch">
            {balances.map((item) => (
              <TokenBalanceRow
                key={item.token.address}
                item={item}
                disabled={distributeDisabled}
                isBusy={pendingToken === item.token.address}
                onDistribute={handleDistribute}
              />
            ))}
            {balances.every((b) => !b.distributable) && (
              <Text
                fontSize="xs"
                color="dim"
                fontFamily="mono"
                textAlign="center"
                py={2}
              >
                {t("swapAdmin.noBalances")}
              </Text>
            )}
          </VStack>
        )}
      </Box>

      <Text fontSize="10px" color="dim" fontFamily="mono" textAlign="center">
        {t("swapAdmin.footnote")}
      </Text>
    </VStack>
  );
}
