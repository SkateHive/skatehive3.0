import {
    Box,
    Text,
    HStack,
    Tooltip,
    IconButton,
    useDisclosure,
} from "@chakra-ui/react";
import {
    FaPaperPlane,
    FaQuestionCircle,
    FaPiggyBank,
} from "react-icons/fa";
import { useState, useCallback, useMemo, memo } from "react";
import { CustomHiveIcon } from "./CustomHiveIcon";
import { useTheme } from "@/app/themeProvider";
import useIsMobile from "@/hooks/useIsMobile";
import { SendHBDModal, DepositSavingsModal } from "./modals";
import { useTranslations } from "@/contexts/LocaleContext";

interface HBDSectionProps {
    hbdBalance: string;
    hbdSavingsBalance: string;
    hbdPrice: number | null;
    estimatedClaimableInterest: number;
    daysUntilClaim: number;
    lastInterestPayment?: string;
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

const HBDSection = memo(function HBDSection({
    hbdBalance,
    hbdSavingsBalance,
    hbdPrice,
    estimatedClaimableInterest,
    daysUntilClaim,
    lastInterestPayment,
    onClaimInterest,
}: HBDSectionProps) {
    const { theme } = useTheme();
    const [showInfo, setShowInfo] = useState(false);
    const isMobile = useIsMobile();
    const t = useTranslations();

    const { isOpen: isSendOpen, onOpen: onSendOpen, onClose: onSendClose } = useDisclosure();
    const { isOpen: isDepositOpen, onOpen: onDepositOpen, onClose: onDepositClose } = useDisclosure();

    const liquidUsdValue = useMemo(() => {
        if (hbdBalance === "N/A" || !hbdPrice || parseFloat(hbdBalance) <= 0) return null;
        return (parseFloat(hbdBalance) * hbdPrice).toFixed(2);
    }, [hbdBalance, hbdPrice]);

    const handleInfoToggle = useCallback(() => {
        setShowInfo((prev) => !prev);
    }, []);

    return (
        <>
            <Box
                p={4}
                mt={2}
                mb={2}
                bg="transparent"
                border="1px solid"
                borderColor="border"
            >
                <HStack justify="space-between" align="center">
                    <HStack spacing={3}>
                        <CustomHiveIcon color="lime" />
                        <Box>
                            <HStack spacing={2} align="center">
                                <Text fontSize="lg" fontWeight="bold" color="primary">
                                    HBD
                                </Text>
                                <IconButton
                                    aria-label={t('tooltips.infoHBD')}
                                    icon={<FaQuestionCircle />}
                                    size="xs"
                                    variant="ghost"
                                    color="dim"
                                    onClick={handleInfoToggle}
                                />
                            </HStack>
                        </Box>
                    </HStack>

                    <HStack spacing={3} align="center">
                        <HStack spacing={1}>
                            <Tooltip label={t('tooltips.sendHBD')} hasArrow>
                                <IconButton
                                    aria-label={t('tooltips.sendHBD')}
                                    icon={<FaPaperPlane />}
                                    size="sm"
                                    colorScheme="blue"
                                    variant="outline"
                                    onClick={onSendOpen}
                                />
                            </Tooltip>
                            <Tooltip label={t('tooltips.convertToSavings')} hasArrow>
                                <IconButton
                                    aria-label={t('tooltips.convertToSavings')}
                                    icon={<FaPiggyBank />}
                                    size="sm"
                                    colorScheme="green"
                                    variant="outline"
                                    onClick={onDepositOpen}
                                />
                            </Tooltip>
                        </HStack>
                        <Box textAlign="right">
                            <Text fontSize="2xl" fontWeight="bold" color="primary">
                                {hbdBalance}
                            </Text>
                            {liquidUsdValue && (
                                <Text fontSize="sm" color="dim">
                                    (${liquidUsdValue})
                                </Text>
                            )}
                        </Box>
                    </HStack>
                </HStack>

                {showInfo && (
                    <Box mt={3} p={3} bg="muted">
                        <Text color="dim" fontSize="sm">
                            Liquid HBD ready for transactions. Convert to Savings in SkateBank
                            to earn 15% APR!
                        </Text>
                    </Box>
                )}
            </Box>

            <SendHBDModal
                isOpen={isSendOpen}
                onClose={onSendClose}
                balance={hbdBalance}
            />

            <DepositSavingsModal
                isOpen={isDepositOpen}
                onClose={onDepositClose}
                hbdBalance={hbdBalance}
            />
        </>
    );
});

export default HBDSection;
