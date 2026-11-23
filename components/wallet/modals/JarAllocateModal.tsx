import { useEffect, useMemo, useState } from "react";
import { VStack, HStack, Box, Text, Button } from "@chakra-ui/react";
import { BaseWalletModal } from "./BaseWalletModal";
import { AmountInput } from "./components";
import { useTranslations } from "@/contexts/LocaleContext";
import { tVars } from "@/lib/i18n/format";
import { formatRate } from "@/hooks/wallet/useHbdSavingsRate";
import { useJarRate } from "@/hooks/wallet/useJarRate";
import type { SavingsJar } from "@/hooks/wallet/useSavingsJars";

export type AllocateMode = "add" | "take";

const QUICK_AMOUNTS = [5, 10, 25];

interface JarAllocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  jar: SavingsJar | null;
  mode: AllocateMode;
  /** Savings not yet assigned to any jar, in the jar's currency. */
  unallocated: number;
  /** Liquid wallet balance in the jar's currency (HBD, or USDC on Base). */
  walletBalance: number;
  /**
   * Most that can go back to the wallet right now. USDC: what the Morpho vault
   * can pay out (its liquidity). Omitted for HBD (no on-chain limit beyond the jar).
   */
  walletWithdrawLimit?: number;
  allocate: (
    id: string,
    delta: number,
    options?: { skipRefresh?: boolean; via?: "savings" | "wallet" }
  ) => Promise<{ success: boolean; error?: string }>;
  fundFromWallet: (id: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  withdrawToWallet: (id: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  /** Fired when a save pushes the jar across its target for the first time. */
  onGoalReached?: (jar: SavingsJar) => void;
  /** Success feedback (already localized). */
  onDone?: (message: string) => void;
}

/**
 * "Guardar / Resgatar" bottom-sheet-style flow: quick amounts, source and
 * destination in the user's words, and the Hive 3-day delay explained only at
 * the exact moment it applies (HBD only; USDC leaves the Morpho vault at once).
 */
export function JarAllocateModal({
  isOpen,
  onClose,
  jar,
  mode,
  unallocated,
  walletBalance,
  walletWithdrawLimit,
  allocate,
  fundFromWallet,
  withdrawToWallet,
  onGoalReached,
  onDone,
}: JarAllocateModalProps) {
  const t = useTranslations("cofrinhos");
  const currency = jar?.currency ?? "HBD";
  const usdc = currency === "USDC";
  const rate = useJarRate(currency);
  const rateLabel = rate != null ? formatRate(rate) : "—";
  // "savings" = instant metadata move; "wallet" = real on-chain transfer.
  const [source, setSource] = useState<"savings" | "wallet">("savings");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      // Nothing free to move: start from the wallet, which deposits first
      // (HBD to Hive savings, USDC to the Morpho vault).
      setSource(mode === "add" && unallocated <= 0 && walletBalance > 0 ? "wallet" : "savings");
    }
    // Pick the default only when the sheet opens, not on every balance refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode]);

  const adding = mode === "add";
  const max = useMemo(() => {
    if (!jar) return 0;
    if (adding) return source === "savings" ? Math.max(0, unallocated) : walletBalance;
    const inJar = Number(jar.allocated_hbd);
    if (source === "wallet" && walletWithdrawLimit != null) {
      return Math.max(0, Math.min(inJar, walletWithdrawLimit));
    }
    return inJar;
  }, [jar, adding, source, unallocated, walletBalance, walletWithdrawLimit]);
  // The vault can't pay out the whole jar right now (Morpho liquidity).
  const vaultLimited =
    !adding &&
    source === "wallet" &&
    walletWithdrawLimit != null &&
    !!jar &&
    walletWithdrawLimit < Number(jar.allocated_hbd);

  const value = parseFloat(amount);
  const isValid = Number.isFinite(value) && value > 0 && value <= max + 1e-6;

  const handleConfirm = async () => {
    if (!jar || !isValid) return;

    let result;
    let doneMessage = "";
    if (adding) {
      result =
        source === "savings"
          ? await allocate(jar.id, value)
          : await fundFromWallet(jar.id, value);
      doneMessage = tVars(t("savedToast"), { amount: value.toFixed(3), name: jar.name, currency });
    } else {
      result =
        source === "savings"
          ? await allocate(jar.id, -value)
          : await withdrawToWallet(jar.id, value);
      doneMessage =
        source === "wallet"
          ? tVars(t(usdc ? "withdrawnToastUsdc" : "withdrawnToast"), { amount: value.toFixed(3) })
          : tVars(t("returnedToast"), { amount: value.toFixed(3), currency });
    }

    if (!result.success) throw new Error(result.error || "Operation failed");

    const before = Number(jar.allocated_hbd);
    if (
      adding &&
      jar.target_hbd &&
      before < jar.target_hbd &&
      before + value >= jar.target_hbd - 1e-6
    ) {
      onGoalReached?.(jar);
    }
    onDone?.(doneMessage);
    onClose();
  };

  const options = adding
    ? [
        {
          key: "savings" as const,
          label: t("srcFree"),
          hint: tVars(t("srcFreeHint"), { amount: Math.max(0, unallocated).toFixed(3), currency }),
        },
        {
          key: "wallet" as const,
          label: tVars(t("srcWallet"), { currency }),
          hint: tVars(t(usdc ? "srcWalletHintUsdc" : "srcWalletHint"), {
            amount: walletBalance.toFixed(3),
            rate: rateLabel,
          }),
        },
      ]
    : [
        { key: "savings" as const, label: t("dstFree"), hint: t("dstFreeHint") },
        { key: "wallet" as const, label: t("dstWallet"), hint: t(usdc ? "dstWalletHintUsdc" : "dstWalletHint") },
      ];

  const cta = isValid
    ? tVars(t(adding ? "ctaSave" : "ctaWithdraw"), { amount: value.toFixed(3), currency })
    : t(adding ? "save" : "withdraw");

  return (
    <BaseWalletModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t(adding ? "saveTo" : "withdrawFrom")} ${jar?.icon ?? ""} ${jar?.name ?? ""}`}
      onConfirm={handleConfirm}
      isConfirmDisabled={!isValid}
      confirmText={cta}
    >
      <VStack spacing={4} align="stretch">
        <Box>
          <Text fontSize="xs" color="dim" mb={2} fontFamily="mono" textTransform="uppercase" letterSpacing="wider">
            {t("howMuch")}
          </Text>
          <HStack spacing={2} mb={2}>
            {QUICK_AMOUNTS.map((quick) => (
              <Button
                key={quick}
                flex={1}
                size="sm"
                borderRadius="none"
                fontFamily="mono"
                variant="outline"
                borderColor={value === quick ? "primary" : "border"}
                color={value === quick ? "primary" : "text"}
                onClick={() => setAmount(String(Math.min(quick, max)))}
                isDisabled={max <= 0}
              >
                +{quick}
              </Button>
            ))}
            <Button
              flex={1}
              size="sm"
              borderRadius="none"
              fontFamily="mono"
              variant="outline"
              borderColor="border"
              color="text"
              onClick={() => setAmount(max.toFixed(3))}
              isDisabled={max <= 0}
            >
              {t("max")}
            </Button>
          </HStack>
          <AmountInput
            value={amount}
            onChange={setAmount}
            balance={max.toFixed(3)}
            currency={currency}
            placeholder="0.000"
            onMaxClick={() => setAmount(max.toFixed(3))}
          />
          <Text fontSize="2xs" color="dim" fontFamily="mono" mt={1} textAlign="center">
            {tVars(t("upTo"), { amount: max.toFixed(3), currency })}
          </Text>
        </Box>

        <Box>
          <Text fontSize="xs" color="dim" mb={2} fontFamily="mono" textTransform="uppercase" letterSpacing="wider">
            {t(adding ? "fromWhere" : "toWhere")}
          </Text>
          <VStack spacing={2} align="stretch">
            {options.map((opt) => {
              const selected = source === opt.key;
              return (
                <Button
                  key={opt.key}
                  onClick={() => setSource(opt.key)}
                  variant="unstyled"
                  h="auto"
                  py={2.5}
                  px={3}
                  bg={selected ? "muted" : "panel"}
                  border="1px solid"
                  borderColor={selected ? "primary" : "border"}
                  borderRadius="none"
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  textAlign="left"
                  whiteSpace="normal"
                >
                  <Box>
                    <Text fontSize="sm" fontWeight="bold" color="text" fontFamily="mono">
                      {opt.label}
                    </Text>
                    <Text fontSize="2xs" color="dim" fontFamily="mono" mt={0.5}>
                      {opt.hint}
                    </Text>
                  </Box>
                  <Text fontSize="sm" color="primary" opacity={selected ? 1 : 0}>
                    ◉
                  </Text>
                </Button>
              );
            })}
          </VStack>
        </Box>

        {adding && source === "wallet" && (
          <Box p={2} bg="muted" borderLeft="3px solid" borderColor="success">
            <Text fontSize="xs" color="success" fontFamily="mono" lineHeight="tall">
              {tVars(t(usdc ? "depositNoteUsdc" : "depositNote"), { rate: rateLabel })}
            </Text>
          </Box>
        )}
        {vaultLimited && (
          <Box p={2} bg="muted" borderLeft="3px solid" borderColor="warning">
            <Text fontSize="xs" color="warning" fontFamily="mono" lineHeight="tall">
              {tVars(t("vaultLimitNote"), { amount: (walletWithdrawLimit ?? 0).toFixed(3) })}
            </Text>
          </Box>
        )}
        {/* Hive's 3-day savings withdrawal; the Morpho vault pays out at once. */}
        {!adding && source === "wallet" && !usdc && (
          <Box p={2} bg="muted" borderLeft="3px solid" borderColor="warning">
            <Text fontSize="xs" color="warning" fontFamily="mono" lineHeight="tall">
              {t("delayNote")}
            </Text>
          </Box>
        )}
      </VStack>
    </BaseWalletModal>
  );
}
