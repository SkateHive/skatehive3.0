import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Text,
  Divider,
  Box,
  useToast,
  Center,
} from "@chakra-ui/react";
import { Wallet, ConnectWallet } from "@coinbase/onchainkit/wallet";
import {
  Identity,
  Avatar,
  Name,
  Badge,
  Address,
} from "@coinbase/onchainkit/identity";
import { useAccount } from "wagmi";
import FarcasterUniversalWallet from "@/components/farcaster/FarcasterUniversalWallet";

export default function ConnectModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { address, isConnected } = useAccount();

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="lg">
      <ModalOverlay bg="muted" backdropFilter="blur(10px)" />
      <ModalContent
        bg="background"
        color="text"
        borderRadius="20px"
        border="1px solid"
        borderColor="border"
        shadow="2xl"
        mx={4}
      >
        <ModalHeader
          textAlign="center"
          fontSize="2xl"
          fontWeight="bold"
          color="primary"
          pb={2}
        >
          🛹 Connect Wallet & Social
        </ModalHeader>
        <ModalCloseButton
          color="text"
          _hover={{ color: "background", bg: "primary" }}
          borderRadius="full"
        />
        <ModalBody px={8} pb={8}>
          <VStack spacing={6} align="stretch">
            {/* Unified Wallet Section */}
            <Box
              p={5}
              bg="background"
              borderRadius="16px"
              border="1px solid"
              borderColor="border"
              _hover={{ borderColor: "primary" }}
              transition="all 0.3s ease"
            >
              <Text
                fontSize="lg"
                color="primary"
                mb={4}
                fontWeight="bold"
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={2}
              >
                💰 Wallet Connection
              </Text>
              <Center>
                <Wallet>
                  <ConnectWallet
                    disconnectedLabel="Connect Wallet"
                    onConnect={onClose}
                  >
                    <Avatar className="h-8 w-8" />
                    <Name />
                  </ConnectWallet>
                </Wallet>
              </Center>
            </Box>

            <Divider borderColor="border" />

            {/* Farcaster Section */}
            <Box
              p={5}
              bg="background"
              borderRadius="16px"
              border="1px solid"
              borderColor="border"
              _hover={{ borderColor: "primary" }}
              transition="all 0.3s ease"
            >
              <Text
                fontSize="lg"
                color="primary"
                mb={4}
                fontWeight="bold"
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={2}
              >
                🛹 Social Connection
              </Text>
              <Center>
                <FarcasterUniversalWallet />
              </Center>
            </Box>

            {/* Identity Card Section - Only show when wallet is connected */}
            {isConnected && address && (
              <Box
                p={5}
                bg="background"
                borderRadius="16px"
                border="1px solid"
                borderColor="border"
                _hover={{ borderColor: "primary" }}
                transition="all 0.3s ease"
              >
                <Text
                  fontSize="lg"
                  color="primary"
                  mb={4}
                  fontWeight="bold"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={2}
                >
                  🔗 Identity
                </Text>
                <Center>
                  <Identity address={address}>
                    <VStack align="center" spacing={3}>
                      <Avatar className="h-12 w-12" />
                      <Name className="text-primary text-lg font-medium" />
                      <Address className="text-text text-sm" />
                      <Badge />
                    </VStack>
                  </Identity>
                </Center>
              </Box>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
