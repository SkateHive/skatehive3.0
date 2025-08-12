import {
  Box,
  Text,
  HStack,
  VStack,
  Tooltip,
  Icon,
  Image,
  Button,
  IconButton,
  Badge,
} from "@chakra-ui/react";
import {
  FaPaperPlane,
  FaArrowDown,
  FaArrowUp,
  FaQuestionCircle,
  FaPiggyBank,
} from "react-icons/fa";
import { useState, useCallback, useMemo, memo } from "react";
import { CustomHiveIcon } from "./CustomHiveIcon";
import { useTheme } from "@/app/themeProvider";
import useIsMobile from "@/hooks/useIsMobile";

interface HBDSectionProps {
  hbdBalance: string;
  hbdSavingsBalance: string;
  hbdPrice: number | null;
  estimatedClaimableInterest: number;
  daysUntilClaim: number;
  lastInterestPayment?: string;
  savings_withdraw_requests?: number | null;
  onModalOpen: (
    title: string,
    description?: string,
    showMemoField?: boolean,
    showUsernameField?: boolean
  ) => void;
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
  onModalOpen,
  onClaimInterest
}: HBDSectionProps) {
  const { theme } = useTheme();
  const [showInfo, setShowInfo] = useState(false);
  const isMobile = useIsMobile();

  // Memoized calculations
  const liquidUsdValue = useMemo(() => {
    if (hbdBalance === "N/A" || !hbdPrice || parseFloat(hbdBalance) <= 0) {
      return null;
    }
    return (parseFloat(hbdBalance) * hbdPrice).toFixed(2);
  }, [hbdBalance, hbdPrice]);

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

  // Memoized event handlers
  const handleInfoToggle = useCallback(() => {
    setShowInfo((prev) => !prev);
  }, []);

  const handleSendHBD = useCallback(() => {
    onModalOpen("Send HBD", "Send HBD to another account", true, true);
  }, [onModalOpen]);

  const handleHBDToSavings = useCallback(() => {
    onModalOpen("HBD Savings", "Convert HBD to Savings (15% APR)");
  }, [onModalOpen]);

  const handleAddToSavings = useCallback(() => {
    onModalOpen("HBD Savings", "Add HBD to Savings (Earn 15% APR)");
  }, [onModalOpen]);

  const handleWithdrawFromSavings = useCallback(() => {
    onModalOpen(
      "Withdraw HBD Savings",
      "HBD savings balance is subject to a 3-day unstake (withdraw) waiting period.",
      false,
      false
    );
  }, [onModalOpen]);

  const handleWithdrawFromSavingsAlt = useCallback(() => {
    onModalOpen(
      "Withdraw HBD Savings",
      "HBD savings balance is subject to a 3-day unstake (withdraw) waiting period.",
      true,
      false
    );
  }, [onModalOpen]);

  const handleSendToSavings = useCallback(() => {
    onModalOpen("HBD Savings", "Send HBD to Savings");
  }, [onModalOpen]);

  // Wallet view: Only show liquid HBD


  // Bank view: Show savings and investment options
  return (
    <Box mb={3}>
      {/* Current Savings Balance */}
      <HStack align="center" mb={4} spacing={2} width="100%">
        <Image
          src="/images/hbd_savings.png"
          alt="HBD Savings Logo"
          width="6"
          height="6"
        />
        <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="bold">
          HBD Savings
        </Text>

        <Box flex={1} />

        <VStack spacing={0} align="end">
          <Text
            fontSize={{ base: "xl", md: "2xl" }}
            fontWeight="extrabold"
            color="lime"
          >
            {hbdSavingsBalance} HBD
          </Text>
          {savingsUsdValue && (
            <Text fontSize="sm" color="gray.400">
              (${savingsUsdValue})
            </Text>
          )}
        </VStack>
      </HStack>

      <Box>
        <Text fontSize="sm" color="text" mb={3}>
          • Dollar Savings
          • Earn guaranteed 15% annual interest on your Dollar Savings.
          • Claim Monthly interest
          • 3-day withdrawal period for security
        </Text>
      </Box>

      {/* Available HBD to invest */}
      <Box p={3} borderRadius="md" bg={theme.colors.muted}>

        {savings_withdraw_requests && savings_withdraw_requests > 0 && (
            <Text color="orange.400" fontSize="sm" mt={1} mb={1}>
              🚨 You have {savings_withdraw_requests} savings withdrawal
              {savings_withdraw_requests > 1 ? "s" : ""} in progress.
            </Text>
          )}

        <Text fontSize="sm" color="text" mb={1}>
          Available HBD to invest:{" "}
          <Text as="span" fontWeight="bold" color="primary">
            {hbdBalance} HBD
          </Text>
        </Text>

        <Text fontSize="xs" color="gray.400">
          Convert your liquid HBD to savings to start earning passive
          income!
        </Text>
      </Box>


      {/* Investment Actions */}
      <VStack spacing={3} align="stretch">
        <HStack spacing={2}>
          <Tooltip label="Add HBD to Savings" hasArrow>
            <Box
              as="button"
              px={4}
              py={2}
              fontSize="sm"
              bg="primary"
              color="background"
              borderRadius="md"
              fontWeight="bold"
              _hover={{ bg: "accent" }}
              onClick={handleAddToSavings}
              flex={1}
            >
              💰 Save
            </Box>
          </Tooltip>
          <Tooltip label="Withdraw from Savings (3-day cooldown)" hasArrow>
            <Box
              as="button"
              px={4}
              py={2}
              fontSize="sm"
              bg="muted"
              color="text"
              borderRadius="md"
              fontWeight="bold"
              _hover={{ bg: "accent", color: "background" }}
              onClick={handleWithdrawFromSavings}
              flex={1}
            >
              📤 Withdraw
            </Box>
          </Tooltip>
        </HStack>


        {/* Claimable Interest */}
        {estimatedClaimableInterest > 0 && (
          <Box p={3} borderRadius="md" bg={theme.colors.muted}>
            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
            >
              <Box>
                <Text fontWeight="bold" color="lime">
                  Claimable Interest
                </Text>
                {daysUntilClaim === 0 && estimatedClaimableInterest > 0 ? (
                  <Text color="gray.400" fontSize="sm">
                    Your earned rewards are ready!
                  </Text>
                ) : daysUntilClaim > 0 ? (
                  <Text color="gray.400" fontSize="sm">
                    Rewards will be ready in {daysUntilClaim} day
                    {daysUntilClaim > 1 ? "s" : ""}
                  </Text>
                ) : (
                  <Text color="gray.400" fontSize="sm">
                    No claimable interest yet
                  </Text>
                )}
                {lastInterestPayment && (
                  <Text color="gray.400" fontSize="xs">
                    Last payment: {daysAgo(lastInterestPayment)} days ago
                  </Text>
                )}
              </Box>
              <Box display="flex" alignItems="center" gap={2}>
                <Text fontWeight="bold" fontSize="lg" color="lime">
                  {estimatedClaimableInterest.toFixed(3)} HBD
                </Text>
                <Button
                  bg="lime"
                  color="black"
                  _hover={{ bg: "green.400" }}
                  size="sm"
                  isDisabled={
                    daysUntilClaim > 0 || estimatedClaimableInterest <= 0
                  }
                  onClick={onClaimInterest}
                >
                  {daysUntilClaim > 0 ? `${daysUntilClaim}d` : "CLAIM"}
                </Button>
              </Box>
            </Box>
          </Box>
        )}

      </VStack>
    </Box>
  );

});

export default SkateBankSection;
