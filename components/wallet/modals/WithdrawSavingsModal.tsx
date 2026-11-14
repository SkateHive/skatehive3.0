import { useState } from "react";
import { Text, VStack, Box, useToast } from "@chakra-ui/react";
import { BaseWalletModal, showTransactionSuccess, isUserCancelled } from "./BaseWalletModal";
import { AmountInput } from "./components";
import { WithdrawHBDSavingsModalProps } from "./types";
import { useBankActions } from "@/hooks/wallet";
import { useTranslations } from "@/contexts/LocaleContext";
import { useHbdSavingsRate, formatRate } from "@/hooks/wallet/useHbdSavingsRate";

/**
 * Modal for withdrawing HBD from savings
 */
export function WithdrawSavingsModal({
    isOpen,
    onClose,
    savingsBalance,
}: WithdrawHBDSavingsModalProps) {
    const [amount, setAmount] = useState("");
    const { withdrawFromSavings } = useBankActions();
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

        const result = await withdrawFromSavings(parsedAmount, "HBD");

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
            title={t('wallet.withdrawSavings')}
            onConfirm={handleConfirm}
            isConfirmDisabled={isConfirmDisabled}
            confirmText={t('buttons.withdraw')}
        >
            <VStack spacing={4} align="stretch">
                <Text fontSize="sm" color="text">
                    Withdraw HBD from your savings account.
                </Text>

                <Box p={3} bg="orange.900" borderRadius="md" borderLeft="4px solid" borderColor="orange.500">
                    <Text fontSize="sm" fontWeight="bold" color="orange.200" mb={2}>
                        ⏱️ 3-Day Waiting Period
                    </Text>
                    <Text fontSize="xs" color="orange.100">
                        HBD savings withdrawals are subject to a 3-day security waiting
                        period. Your funds will be available in your liquid balance after 3
                        days.
                    </Text>
                </Box>

                <AmountInput
                    value={amount}
                    onChange={setAmount}
                    balance={savingsBalance}
                    currency="HBD"
                    placeholder={t('forms.placeholders.enterAmount')}
                />

                <Box p={2} bg="muted" borderRadius="md">
                    <Text fontSize="xs" color="gray.400">
                        {t("wallet.savingsRate.withdrawCancel")}
                    </Text>
                </Box>

                <Box p={2} bg="red.900" borderRadius="md" borderLeft="4px solid" borderColor="red.500">
                    <Text fontSize="xs" color="red.200">
                        {t("wallet.savingsRate.withdrawWarning").replace("{rate}", formatRate(hbdRate))}
                    </Text>
                </Box>
            </VStack>
        </BaseWalletModal>
    );
}
