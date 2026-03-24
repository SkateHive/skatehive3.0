import {
  Box,
  Text,
  HStack,
  VStack,
  Tooltip,
  Image,
  Button,
  useDisclosure,
} from "@chakra-ui/react";
import {
  FaArrowDown,
  FaArrowUp,
} from "react-icons/fa";
import { useMemo, memo } from "react";
import { DepositSavingsModal, WithdrawSavingsModal } from "./modals";
import { useTranslations } from "@/contexts/LocaleContext";
import { shimmerStyles } from "@/lib/utils/animations";

interface HBDSectionProps {
  hbdBalance: string;
  hbdSavingsBalance: string;
  hbdPrice: number | null;
  estimatedClaimableInterest: number;
  daysUntilClaim: number;
  lastInterestPayment?: string;
  savings_withdraw_requests?: number;
  onClaimInterest: () => void;
  isWalletView?: boolean;
  isBankView?: boolean;
}

function daysAgo(dateString: string) {
  const last = new Date(dateString);
  const now = new Date();
  const diff = Math.floor(
    (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.max(0, diff);
}

const SkateBankSection = memo(function HBDSection({
  hbdBalance,
  hbdSavingsBalance,
  hbdPrice,
  estimatedClaimableInterest,
  daysUntilClaim,
  lastInterestPayment,
  savings_withdraw_requests,
  onClaimInterest,
}: HBDSectionProps) {
  const t = useTranslations();

  const { isOpen: isDepositOpen, onOpen: onDepositOpen, onClose: onDepositClose } = useDisclosure();
  const { isOpen: isWithdrawOpen, onOpen: onWithdrawOpen, onClose: onWithdrawClose } = useDisclosure();

  const savingsUsdValue = useMemo(() => {
    if (
      hbdSavingsBalance === "N/A" ||
      !hbdPrice ||
      parseFloat(hbdSavingsBalance) <= 0
    ) {
      return null;
    }
    return (parseFloat(hbdSavingsBalance) * hbdPrice).toFixed(2);
  }, [hbdSavingsBalance, hbdPrice]);

  const lastPaymentDays = useMemo(() => {
    return lastInterestPayment ? daysAgo(lastInterestPayment) : 0;
  }, [lastInterestPayment]);

  return (
    <>
      <Box
        position="relative"
        border="2px solid"
        borderColor="primary"
        overflow="hidden"
        sx={shimmerStyles}
      >
        {/* Header */}
        <HStack px={3} py={2} bg="primary" justify="space-between">
          <HStack spacing={2}>
            <Image src="/images/hbd_savings.png" alt="HBD Savings" w="18px" h="18px" />
            <Text fontWeight="black" fontSize="sm" color="background" textTransform="uppercase" letterSpacing="widest" fontFamily="mono">
              HBD Savings
            </Text>
          </HStack>
          <VStack spacing={0} align="end">
            <Text fontSize="xl" fontWeight="black" color="background" fontFamily="mono">
              {hbdSavingsBalance} HBD
            </Text>
            {savingsUsdValue && (
              <Text fontSize="xs" color="background" opacity={0.75} fontFamily="mono">${savingsUsdValue}</Text>
            )}
          </VStack>
        </HStack>

        {/* Body */}
        <Box px={3} py={3}>
          {/* Info box */}
          <Box p={3} bg="muted" mb={3}>
            <Text color="dim" fontSize="xs" fontFamily="mono" lineHeight="tall">
              15% APR on your dollar savings. Monthly interest. 3-day withdrawal period.
            </Text>
          </Box>

          {/* Withdrawal warning */}
          {savings_withdraw_requests && savings_withdraw_requests > 0 && (
            <Box p={2} bg="muted" mb={2} border="1px solid" borderColor="orange.400">
              <Text color="orange.400" fontSize="xs" fontFamily="mono">
                {savings_withdraw_requests} withdrawal{savings_withdraw_requests > 1 ? "s" : ""} in progress
              </Text>
            </Box>
          )}

          {/* Available to invest */}
          <Box p={3} bg="muted" mb={3}>
            <Text fontSize="xs" color="dim" fontFamily="mono">
              Available to invest:{" "}
              <Text as="span" color="primary" fontWeight="bold">{hbdBalance} HBD</Text>
            </Text>
          </Box>

          {/* Actions */}
          <HStack spacing={2} mb={3}>
            <Tooltip label={t("tooltips.addToSavings")} hasArrow>
              <Box
                as="button" px={4} py={2} fontSize="sm"
                bg="primary" color="background"
                borderRadius="none" fontWeight="bold"
                fontFamily="mono" textTransform="uppercase" letterSpacing="wide"
                _hover={{ opacity: 0.85 }}
                onClick={onDepositOpen} flex={1}
                display="flex" alignItems="center" justifyContent="center" gap="8px"
              >
                <FaArrowDown style={{ display: "inline" }} /> Deposit
              </Box>
            </Tooltip>
            <Tooltip label={t("tooltips.withdrawSavings")} hasArrow>
              <Box
                as="button" px={4} py={2} fontSize="sm"
                bg="muted" color="text"
                borderRadius="none" fontWeight="bold"
                fontFamily="mono" textTransform="uppercase" letterSpacing="wide"
                _hover={{ bg: "accent", color: "background" }}
                onClick={onWithdrawOpen} flex={1}
                display="flex" alignItems="center" justifyContent="center" gap="8px"
              >
                <FaArrowUp style={{ display: "inline" }} /> Withdraw
              </Box>
            </Tooltip>
          </HStack>

          {/* Claimable interest */}
          {estimatedClaimableInterest > 0 && (
            <Box p={3} bg="muted" border="1px solid" borderColor={daysUntilClaim === 0 ? "primary" : "border"}>
              <HStack justify="space-between" align="center">
                <Box>
                  <Text fontWeight="bold" color="primary" fontFamily="mono" fontSize="sm">
                    CLAIMABLE INTEREST
                  </Text>
                  <Text color="dim" fontSize="xs" fontFamily="mono">
                    {daysUntilClaim === 0 ? "Ready to claim!" : `${daysUntilClaim}d until next claim`}
                  </Text>
                  {lastInterestPayment && (
                    <Text color="dim" fontSize="xs" fontFamily="mono">
                      Last: {lastPaymentDays}d ago
                    </Text>
                  )}
                </Box>
                <Box textAlign="right">
                  <Text fontWeight="bold" fontSize="lg" color="primary" fontFamily="mono">
                    {estimatedClaimableInterest.toFixed(3)} HBD
                  </Text>
                  <Button
                    size="sm" borderRadius="none" fontFamily="mono" fontWeight="black"
                    letterSpacing="wide" colorScheme="green"
                    isDisabled={daysUntilClaim > 0 || estimatedClaimableInterest <= 0}
                    onClick={onClaimInterest}
                  >
                    {daysUntilClaim > 0 ? `${daysUntilClaim}D` : "CLAIM"}
                  </Button>
                </Box>
              </HStack>
            </Box>
          )}
        </Box>
      </Box>

      <DepositSavingsModal
        isOpen={isDepositOpen}
        onClose={onDepositClose}
        hbdBalance={hbdBalance}
      />
      <WithdrawSavingsModal
        isOpen={isWithdrawOpen}
        onClose={onWithdrawClose}
        savingsBalance={hbdSavingsBalance}
      />
    </>
  );
});

export default SkateBankSection;
