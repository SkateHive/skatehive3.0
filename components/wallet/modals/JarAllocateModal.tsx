import { useEffect, useMemo, useState } from "react";
import { VStack, HStack, Box, Text, Button } from "@chakra-ui/react";
import { BaseWalletModal } from "./BaseWalletModal";
import { AmountInput } from "./components";
import { useTranslations } from "@/contexts/LocaleContext";
import { tVars } from "@/lib/i18n/format";
import type { SavingsJar } from "@/hooks/wallet/useSavingsJars";

export type AllocateMode = "add" | "take";

const QUICK_AMOUNTS = [5, 10, 25];

interface JarAllocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  jar: SavingsJar | null;
  mode: AllocateMode;
  /** Savings not yet assigned to any jar. */
  unallocated: number;
  /** Liquid wallet HBD balance (string like "12.345"). */
  walletHbd: string;
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
 * the exact moment it applies.
 */
export function JarAllocateModal({
  isOpen,
  onClose,
  jar,
  mode,
  unallocated,
  walletHbd,
  allocate,
  fundFromWallet,
  withdrawToWallet,
  onGoalReached,
  onDone,
}: JarAllocateModalProps) {
  const t = useTranslations("cofrinhos");
  // "savings" = instant metadata move; "wallet" = real on-chain transfer.
  const [source, setSource] = useState<"savings" | "wallet">("savings");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setSource("savings");
    }
  }, [isOpen, mode]);

  const adding = mode === "add";
  const walletBalance = parseFloat(walletHbd) || 0;

  const max = useMemo(() => {
    if (!jar) return 0;
    if (adding) return source === "savings" ? Math.max(0, unallocated) : walletBalance;
    return Number(jar.allocated_hbd);
  }, [jar, adding, source, unallocated, walletBalance]);

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
      doneMessage = tVars(t("savedToast"), { amount: value.toFixed(3), name: jar.name });
    } else {
      result =
        source === "savings"
          ? await allocate(jar.id, -value)
          : await withdrawToWallet(jar.id, value);
      doneMessage =
        source === "wallet"
          ? tVars(t("withdrawnToast"), { amount: value.toFixed(3) })
          : tVars(t("returnedToast"), { amount: value.toFixed(3) });
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
          hint: tVars(t("srcFreeHint"), { amount: Math.max(0, unallocated).toFixed(3) }),
        },
        {
          key: "wallet" as const,
          label: t("srcWallet"),
          hint: tVars(t("srcWalletHint"), { amount: walletBalance.toFixed(3) }),
        },
      ]
    : [
        { key: "savings" as const, label: t("dstFree"), hint: t("dstFreeHint") },
        { key: "wallet" as const, label: t("dstWallet"), hint: t("dstWalletHint") },
      ];

  const cta = isValid
    ? tVars(t(adding ? "ctaSave" : "ctaWithdraw"), { amount: value.toFixed(3) })
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
            currency="HBD"
            placeholder="0.000"
            onMaxClick={() => setAmount(max.toFixed(3))}
          />
          <Text fontSize="2xs" color="dim" fontFamily="mono" mt={1} textAlign="center">
            {tVars(t("upTo"), { amount: max.toFixed(3) })}
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
              {t("depositNote")}
            </Text>
          </Box>
        )}
        {!adding && source === "wallet" && (
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
