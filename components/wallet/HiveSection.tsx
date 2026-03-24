import { Box, Text, HStack, Tooltip, IconButton, useDisclosure } from "@chakra-ui/react";
import { FaPaperPlane, FaQuestionCircle } from "react-icons/fa";
import { useState, useCallback, useMemo, memo } from "react";
import { CustomHiveIcon } from "./CustomHiveIcon";
import { useTheme } from "@/app/themeProvider";
import { SendHiveModal } from "./modals";
import { useTranslations } from "@/contexts/LocaleContext";

interface HiveSectionProps {
  balance: string;
  hivePrice: number | null;
}

const HiveSection = memo(function HiveSection({
  balance,
  hivePrice,
}: HiveSectionProps) {
  const { theme } = useTheme();
  const [showInfo, setShowInfo] = useState(false);
  const { isOpen: isSendOpen, onOpen: onSendOpen, onClose: onSendClose } = useDisclosure();
  const t = useTranslations();

  const usdValue = useMemo(() => {
    if (balance === "N/A" || !hivePrice || parseFloat(balance) <= 0) return null;
    return (parseFloat(balance) * hivePrice).toFixed(2);
  }, [balance, hivePrice]);

  const handleInfoToggle = useCallback(() => {
    setShowInfo((prev) => !prev);
  }, []);

  return (
    <>
      <Box
        p={4}
        bg="transparent"
        border="1px solid"
        borderColor="border"
      >
        <HStack justify="space-between" align="center">
          <HStack spacing={3}>
            <CustomHiveIcon color={"red"} />
            <Box>
              <HStack spacing={2} align="center">
                <Text fontSize="lg" fontWeight="bold" color="red">
                  HIVE
                </Text>
                <IconButton
                  aria-label={t('tooltips.infoHive')}
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
            <Tooltip label={t('tooltips.sendHive')} hasArrow>
              <IconButton
                aria-label={t('tooltips.sendHive')}
                icon={<FaPaperPlane />}
                size="sm"
                colorScheme="blue"
                variant="outline"
                onClick={onSendOpen}
              />
            </Tooltip>
            <Box textAlign="right">
              <Text fontSize="2xl" fontWeight="bold" color="primary">
                {balance}
              </Text>
              {usdValue && (
                <Text fontSize="sm" color="dim">
                  (${usdValue})
                </Text>
              )}
            </Box>
          </HStack>
        </HStack>

        {showInfo && (
          <Box mt={3} p={3} bg="muted">
            <Text color="dim" fontSize="sm">
              The primary token of the Hive Blockchain. Liquid and transferable.
              Can be powered up to Hive Power for governance and curation rewards.
            </Text>
          </Box>
        )}
      </Box>

      <SendHiveModal
        isOpen={isSendOpen}
        onClose={onSendClose}
        balance={balance}
      />
    </>
  );
});

export default HiveSection;
