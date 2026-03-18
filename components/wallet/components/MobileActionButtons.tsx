import { HStack, VStack, Text, Box, useDisclosure } from "@chakra-ui/react";
import {
  FaPaperPlane,
  FaDownload,
  FaExchangeAlt,
  FaEthereum,
} from "react-icons/fa";
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import TokenSearchModal from "./TokenSearchModal";
import ReceiveModal from "./ReceiveModal";
import { TokenDetail } from "../../../types/portfolio";
import { useTranslations } from "@/contexts/LocaleContext";

interface HiveToken {
  symbol: string;
  name: string;
  balance: string;
  balanceUSD: number;
  logo: string;
  network: "hive";
  type: "liquid" | "savings" | "power";
}

interface MobileActionButtonsProps {
  onSend: (token: TokenDetail | HiveToken) => void;
  onSwap: (token: TokenDetail | HiveToken) => void;
  onHiveSend?: (hiveToken: HiveToken) => void;
  onHiveSwap?: (hiveToken: HiveToken) => void;
}

export default function MobileActionButtons({
  onSend,
  onSwap,
  onHiveSend,
  onHiveSwap,
}: MobileActionButtonsProps) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [isMounted, setIsMounted] = useState(false);
  const t = useTranslations();

  // Prevent hydration issues by only rendering after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const {
    isOpen: isSendModalOpen,
    onOpen: openSendModal,
    onClose: closeSendModal,
  } = useDisclosure();
  const {
    isOpen: isReceiveModalOpen,
    onOpen: openReceiveModal,
    onClose: closeReceiveModal,
  } = useDisclosure();
  const {
    isOpen: isSwapModalOpen,
    onOpen: openSwapModal,
    onClose: closeSwapModal,
  } = useDisclosure();

  const handleSendTokenSelect = (token: TokenDetail | HiveToken) => {
    onSend(token);
    closeSendModal();
  };

  const handleSendHiveTokenSelect = (hiveToken: HiveToken) => {
    if (onHiveSend) {
      onHiveSend(hiveToken);
    }
    closeSendModal();
  };

  const handleSwapTokenSelect = (token: TokenDetail | HiveToken) => {
    onSwap(token);
    closeSwapModal();
  };

  const handleSwapHiveTokenSelect = (hiveToken: HiveToken) => {
    if (onHiveSwap) {
      onHiveSwap(hiveToken);
    }
    closeSwapModal();
  };

  return (
    <>
      <HStack spacing={4} justify="center" py={4}>
        <VStack spacing={2}>
          <Box
            as="button"
            onClick={openReceiveModal}
            w="56px"
            h="56px"
            bg="rgba(255, 255, 255, 0.1)"
            borderRadius="full"
            display="flex"
            alignItems="center"
            justifyContent="center"
            _hover={{
              bg: "rgba(255, 255, 255, 0.15)",
              transform: "scale(1.05)",
            }}
            transition="all 0.2s ease"
          >
            <FaDownload size="20px" color="white" />
          </Box>
          <Text fontSize="sm" color="rgba(255, 255, 255, 0.8)" fontWeight="500">
            {t('common.receive')}
          </Text>
        </VStack>

        <VStack spacing={2}>
          <Box
            as="button"
            onClick={openSendModal}
            w="56px"
            h="56px"
            bg="primary"
            borderRadius="full"
            display="flex"
            alignItems="center"
            justifyContent="center"
            _hover={{
              bg: "rgba(96, 165, 250, 0.9)",
              transform: "scale(1.05)",
            }}
            transition="all 0.2s ease"
          >
            <FaPaperPlane size="20px" color="background" />
          </Box>
          <Text fontSize="sm" color="rgba(255, 255, 255, 0.8)" fontWeight="500">
            {t('common.send')}
          </Text>
        </VStack>

        <VStack spacing={2}>
          <Box
            as="button"
            onClick={openSwapModal}
            w="56px"
            h="56px"
            bg="rgba(255, 255, 255, 0.1)"
            borderRadius="full"
            display="flex"
            alignItems="center"
            justifyContent="center"
            _hover={{
              bg: "rgba(255, 255, 255, 0.15)",
              transform: "scale(1.05)",
            }}
            transition="all 0.2s ease"
          >
            <FaExchangeAlt size="20px" color="white" />
          </Box>
          <Text fontSize="sm" color="rgba(255, 255, 255, 0.8)" fontWeight="500">
            {t('common.swap')}
          </Text>
        </VStack>

        {/* Disguised Ethereum Connect Button - only shows when not connected */}
        {isMounted && !isConnected && (
          <VStack spacing={2}>
            <Box
              w="56px"
              h="56px"
              borderRadius="full"
              display="flex"
              alignItems="center"
              justifyContent="center"
              bg="transparent"
              _hover={{
                bg: "transparent",
                transform: "scale(1.05)",
              }}
              _active={{
                bg: "transparent",
              }}
              transition="all 0.2s ease"
              cursor="pointer"
            >
              <Box onClick={() => openConnectModal?.()}>
                <FaEthereum />
              </Box>
            </Box>

            <Text
              fontSize="sm"
              color="rgba(255, 255, 255, 0.8)"
              fontWeight="500"
            >
              {t('common.connect')}
            </Text>
          </VStack>
        )}
      </HStack>

      {/* Token Search Modals */}
      <TokenSearchModal
        isOpen={isSendModalOpen}
        onClose={closeSendModal}
        onTokenSelect={handleSendTokenSelect}
        onHiveTokenSelect={handleSendHiveTokenSelect}
        title={t('wallet.sendToken')}
      />

      <ReceiveModal isOpen={isReceiveModalOpen} onClose={closeReceiveModal} />

      <TokenSearchModal
        isOpen={isSwapModalOpen}
        onClose={closeSwapModal}
        onTokenSelect={handleSwapTokenSelect}
        onHiveTokenSelect={handleSwapHiveTokenSelect}
        title={t('wallet.swapToken')}
      />
    </>
  );
}
