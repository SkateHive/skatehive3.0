import { useEffect, useMemo, useState } from "react";
import { VStack, HStack, Box, Text, Button } from "@chakra-ui/react";
import { BaseWalletModal } from "./BaseWalletModal";
import { AmountInput } from "./components";
import type { SavingsJar } from "@/hooks/wallet/useSavingsJars";

export type AllocateMode = "add" | "take";

interface JarAllocateModalProps {
  isOpen: boolean;
  onClose: () => void;
  jar: SavingsJar | null;
  mode: AllocateMode;
  /** Savings not yet assigned to any jar. */
  unallocated: number;
  /** Liquid wallet HBD balance (string like "12.345"). */
  walletHbd: string;
  allocate: (id: string, delta: number) => Promise<{ success: boolean; error?: string }>;
  fundFromWallet: (id: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  withdrawToWallet: (id: string, amount: number) => Promise<{ success: boolean; error?: string }>;
}

/**
 * Add money to a jar (from unallocated savings or from the wallet) or take it
 * out (back to unallocated savings, or cash out to the wallet with a 3-day delay).
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
}: JarAllocateModalProps) {
  // "savings" = instant metadata move; "wallet" = real on-chain transfer.
  const [source, setSource] = useState<"savings" | "wallet">("savings");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setSource("savings");
    }
  }, [isOpen, mode]);

  const max = useMemo(() => {
    if (!jar) return 0;
    if (mode === "add") {
      return source === "savings" ? unallocated : parseFloat(walletHbd) || 0;
    }
    return Number(jar.allocated_hbd);
  }, [jar, mode, source, unallocated, walletHbd]);

  const handleConfirm = async () => {
    if (!jar) return;
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error("Enter a valid amount");
    }
    if (value > max + 1e-6) {
      throw new Error("Amount exceeds the available balance");
    }

    let result;
    if (mode === "add") {
      result = source === "savings"
        ? await allocate(jar.id, value)
        : await fundFromWallet(jar.id, value);
    } else {
      result = source === "savings"
        ? await allocate(jar.id, -value)
        : await withdrawToWallet(jar.id, value);
    }

    if (!result.success) throw new Error(result.error || "Operation failed");
    onClose();
  };

  const addOptions = [
    { key: "savings" as const, label: "Unallocated savings", hint: "instant" },
    { key: "wallet" as const, label: "Wallet HBD", hint: "deposit" },
  ];
  const takeOptions = [
    { key: "savings" as const, label: "Unallocated savings", hint: "instant" },
    { key: "wallet" as const, label: "Wallet (cash out)", hint: "3-day delay" },
  ];
  const options = mode === "add" ? addOptions : takeOptions;

  return (
    <BaseWalletModal
      isOpen={isOpen}
      onClose={onClose}
      title={`${mode === "add" ? "Add to" : "Take from"} ${jar?.name ?? "jar"}`}
      onConfirm={handleConfirm}
      isConfirmDisabled={!amount || parseFloat(amount) <= 0}
      confirmText={mode === "add" ? "Add" : "Take out"}
    >
      <VStack spacing={4} align="stretch">
        <Box>
          <Text fontSize="xs" color="dim" mb={2} fontFamily="mono" textTransform="uppercase">
            {mode === "add" ? "Source" : "Destination"}
          </Text>
          <HStack spacing={2}>
            {options.map((opt) => (
              <Button
                key={opt.key}
                flex={1}
                size="sm"
                borderRadius="none"
                variant={source === opt.key ? "solid" : "outline"}
                colorScheme={source === opt.key ? "orange" : "gray"}
                onClick={() => setSource(opt.key)}
                flexDirection="column"
                height="auto"
                py={2}
                whiteSpace="normal"
              >
                <Text fontSize="xs" fontWeight="bold">{opt.label}</Text>
                <Text fontSize="2xs" opacity={0.8}>{opt.hint}</Text>
              </Button>
            ))}
          </HStack>
        </Box>

        <AmountInput
          value={amount}
          onChange={setAmount}
          balance={max.toFixed(3)}
          currency="HBD"
          placeholder="0.000"
          onMaxClick={() => setAmount(max.toFixed(3))}
        />

        {mode === "take" && source === "wallet" && (
          <Box p={2} bg="muted" borderLeft="4px solid" borderColor="yellow.500">
            <Text fontSize="xs" color="yellow.200">
              ⚠️ Cashing out of savings to your wallet has a 3-day waiting period (Hive protocol).
            </Text>
          </Box>
        )}
        {mode === "add" && source === "wallet" && (
          <Box p={2} bg="muted" borderLeft="4px solid" borderColor="green.500">
            <Text fontSize="xs" color="green.200">
              💰 Deposits your wallet HBD into savings (15% APR) and assigns it to this jar.
            </Text>
          </Box>
        )}
      </VStack>
    </BaseWalletModal>
  );
}
