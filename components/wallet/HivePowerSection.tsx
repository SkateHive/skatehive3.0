import {
  Box,
  Text,
  Image,
  HStack,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react";
import { FaArrowDown, FaArrowUp } from "react-icons/fa";
import { useMemo, memo } from "react";
import { PowerUpModal, PowerDownModal } from "./modals";
import { useTranslations } from "@/contexts/LocaleContext";
import { shimmerStyles } from "@/lib/utils/animations";

interface HivePowerSectionProps {
  hivePower: string | undefined;
  hivePrice: number | null;
  hiveBalance: string; // Need this for PowerUpModal
}

const HivePowerSection = memo(function HivePowerSection({
  hivePower,
  hivePrice,
  hiveBalance,
}: HivePowerSectionProps) {
  const t = useTranslations();

  const { isOpen: isPowerUpOpen, onOpen: onPowerUpOpen, onClose: onPowerUpClose } = useDisclosure();
  const { isOpen: isPowerDownOpen, onOpen: onPowerDownOpen, onClose: onPowerDownClose } = useDisclosure();

  // Memoize USD value calculation
  const usdValue = useMemo(() => {
    if (hivePower === undefined || !hivePrice || parseFloat(hivePower) <= 0) {
      return null;
    }
    return (parseFloat(hivePower) * hivePrice).toFixed(2);
  }, [hivePower, hivePrice]);

  return (
    <>
      <Box
        position="relative"
        border="2px solid"
        borderColor="primary"
        overflow="hidden"
        sx={shimmerStyles}
      >
        {/* Header bar */}
        <HStack px={3} py={2} bg="primary" justify="space-between">
          <HStack spacing={2}>
            <Image src="/images/hp_logo.png" alt="HP" w="18px" h="18px" borderRadius="full" />
            <Text fontWeight="black" fontSize="sm" color="background" textTransform="uppercase" letterSpacing="widest" fontFamily="mono">
              Hive Power
            </Text>
          </HStack>
          <Text fontSize="xl" fontWeight="black" color="background" fontFamily="mono">
            {hivePower !== undefined ? hivePower : "—"}
          </Text>
        </HStack>

        {/* Body */}
        <Box px={3} py={3}>
          {usdValue && (
            <Text fontSize="sm" color="dim" fontFamily="mono" mb={2}>${usdValue} USD</Text>
          )}

          <Box p={3} bg="muted" mb={3}>
            <Text color="dim" fontSize="xs" fontFamily="mono" lineHeight="tall">
              More HP = more posting power, stronger votes, 3% interest + up to 10% APR from curation.
            </Text>
          </Box>

          <HStack spacing={2}>
            <Tooltip label={t("tooltips.powerUp")} hasArrow>
              <Box
                as="button"
                px={4} py={2} fontSize="sm"
                bg="primary" color="background"
                borderRadius="none" fontWeight="bold"
                fontFamily="mono" textTransform="uppercase"
                letterSpacing="wide"
                _hover={{ opacity: 0.85 }}
                onClick={onPowerUpOpen}
                flex={1}
                display="flex" alignItems="center" justifyContent="center" gap="8px"
              >
                <FaArrowUp style={{ display: "inline" }} /> Power Up
              </Box>
            </Tooltip>
            <Tooltip label={t("tooltips.powerDown")} hasArrow>
              <Box
                as="button"
                px={4} py={2} fontSize="sm"
                bg="muted" color="text"
                borderRadius="none" fontWeight="bold"
                fontFamily="mono" textTransform="uppercase"
                letterSpacing="wide"
                _hover={{ bg: "accent", color: "background" }}
                onClick={onPowerDownOpen}
                flex={1}
                display="flex" alignItems="center" justifyContent="center" gap="8px"
              >
                <FaArrowDown style={{ display: "inline" }} /> Power Down
              </Box>
            </Tooltip>
          </HStack>
        </Box>
      </Box>

      <PowerUpModal isOpen={isPowerUpOpen} onClose={onPowerUpClose} balance={hiveBalance} />
      <PowerDownModal isOpen={isPowerDownOpen} onClose={onPowerDownClose} hivePower={hivePower || "0"} />
    </>
  );
});

export default HivePowerSection;
