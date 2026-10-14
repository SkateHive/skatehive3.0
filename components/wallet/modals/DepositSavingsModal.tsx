import { useState } from "react";
import { Text, VStack, Box, useToast } from "@chakra-ui/react";
import { BaseWalletModal, showTransactionSuccess, isUserCancelled } from "./BaseWalletModal";
import { AmountInput } from "./components";
import { DepositHBDSavingsModalProps } from "./types";
import { useBankActions } from "@/hooks/wallet";
import { useTranslations } from "@/contexts/LocaleContext";
import { useHbdSavingsRate, formatRate } from "@/hooks/wallet/useHbdSavingsRate";

/**
 * Modal for depositing HBD to savings (live witness-set APR)
 */
export function DepositSavingsModal({
    isOpen,
    onClose,
    hbdBalance,
}: DepositHBDSavingsModalProps) {
    const [amount, setAmount] = useState("");
    const { depositToSavings } = useBankActions();
    const toast = useToast();
    const t = useTranslations();
  const hbdRate = useHbdSavingsRate();

    const handleConfirm = async () => {
        const parsedAmount = parseFloat(amount);

        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            toast({
                title: t('forms.errors.invalidAmount'),
                description: t('forms.errors.amountRequired'),
                status: "error",
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        const result = await depositToSavings(parsedAmount, "HBD");

        if (result.success && result.result) {
            showTransactionSuccess(result.result, toast, t);
            onClose();
            setAmount("");
        } else if (result.error) {
            if (!isUserCancelled(result.error, result.errorCode)) {
                toast({
                    title: t('wallet.transactionFailed'),
                    description: result.error || t('notifications.error.failedToSend'),
                    status: "error",
                    duration: 5000,
                    isClosable: true,
                });
            }
        }
    };

    const isConfirmDisabled = !amount || parseFloat(amount) <= 0;

    return (
        <BaseWalletModal
            isOpen={isOpen}
            onClose={onClose}
            title={t('wallet.depositSavings')}
            onConfirm={handleConfirm}
            isConfirmDisabled={isConfirmDisabled}
            confirmText={t('buttons.deposit')}
        >
            <VStack spacing={4} align="stretch">
                <Text fontSize="sm" color="text">
                    Deposit HBD to your savings account and earn {formatRate(hbdRate)} APR!
                </Text>

                <Box p={3} bg="green.900" borderRadius="md" borderLeft="4px solid" borderColor="green.500">
                    <Text fontSize="sm" fontWeight="bold" color="green.200" mb={2}>
                        💰 Earn {formatRate(hbdRate)} APR
                    </Text>
                    <Text fontSize="xs" color="green.100">
                        • Current rate {formatRate(hbdRate)} a year, set by Hive witnesses (it can change)
                        <br />
                        • Interest paid monthly
                        <br />
                        • Completely safe and secure
                        <br />• Backed by the Hive blockchain
                    </Text>
                </Box>

                <AmountInput
                    value={amount}
                    onChange={setAmount}
                    balance={hbdBalance}
                    currency="HBD"
                    placeholder={t('forms.placeholders.enterAmount')}
                />

                <Box p={2} bg="yellow.900" borderRadius="md" borderLeft="4px solid" borderColor="yellow.500">
                    <Text fontSize="xs" color="yellow.200">
                        ⚠️ Withdrawals from savings have a 3-day waiting period
                    </Text>
                </Box>

                <Box p={2} bg="muted" borderRadius="md">
                    <Text fontSize="xs" color="gray.400">
                        💡 Interest compounds monthly when claimed
                    </Text>
                </Box>
            </VStack>
        </BaseWalletModal>
    );
}
