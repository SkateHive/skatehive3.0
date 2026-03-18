import React, { useState, useEffect, useCallback } from "react";
import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  VStack,
  HStack,
  Box,
  Text,
  Image,
  Button,
  useClipboard,
  useToast,
  Spinner,
  Badge,
  Divider,
  IconButton,
  Tooltip,
  Icon,
  Avatar as ChakraAvatar,
} from "@chakra-ui/react";
import { FiCopy } from "react-icons/fi";
import SkateModal from "@/components/shared/SkateModal";
import { useAccount } from "wagmi";
import * as QRCode from "qrcode";
import { EnsName as Name, EnsAvatar as OnchainAvatar } from "@/components/shared/EnsIdentity";
import { FaEthereum, FaHive, FaShare } from "react-icons/fa";
import { useAioha } from "@aioha/react-ui";
import { useTranslations } from "@/contexts/LocaleContext";
interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
}
const ReceiveModal: React.FC<ReceiveModalProps> = ({ isOpen, onClose }) => {
  const { isConnected, address } = useAccount();
  const { user } = useAioha();
  const [ethereumQR, setEthereumQR] = useState<string>("");
  const [hiveQR, setHiveQR] = useState<string>("");
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const toast = useToast();
  const t = useTranslations();
  const { hasCopied: hasEthCopied, onCopy: onEthCopy } = useClipboard(
    address || ""
  );
  const { hasCopied: hasHiveCopied, onCopy: onHiveCopy } = useClipboard(
    user || ""
  );

  const generateQRCode = useCallback(
    async (text: string, type: "ethereum" | "hive") => {
      try {
        setIsGeneratingQR(true);
        const qrDataURL = await QRCode.toDataURL(text, {
          width: 256,
          margin: 2,
          color: {
            dark: "#000000",
            light: "#ffffff",
          },
        });
        if (type === "ethereum") {
          setEthereumQR(qrDataURL);
        } else {
          setHiveQR(qrDataURL);
        }
      } catch (error) {
        toast({
          title: t('common.error'),
          description: t('wallet.qrCodeError'),
          status: "error",
          duration: 3000,
          isClosable: true,
        });
      } finally {
        setIsGeneratingQR(false);
      }
    },
    [toast, t]
  );

  useEffect(() => {
    // Only generate QR if address changes and modal is open
    if (isOpen && address && ethereumQR === "") {
      generateQRCode(address, "ethereum");
    }
    // Reset QR when modal closes
    if (!isOpen && ethereumQR !== "") {
      setEthereumQR("");
    }
  }, [isOpen, address, ethereumQR, generateQRCode]);

  useEffect(() => {
    // Only generate QR if username changes and modal is open, and username is not empty
    if (isOpen && user.trim() !== "" && hiveQR === "") {
      generateQRCode(user, "hive");
    }
    // Reset QR when modal closes
    if (!isOpen && hiveQR !== "") {
      setHiveQR("");
    }
  }, [isOpen, user, hiveQR, generateQRCode]);

  const shortenAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const shareAddress = async (addr: string, type: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `My ${type} Address`,
          text: `Here's my ${type} address: ${addr}`,
        });
      } catch (error) {
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(addr);
      toast({
        title: t('wallet.copiedToClipboard'),
        description: t('wallet.addressCopied').replace('{type}', type),
        status: "success",
        duration: 2000,
        isClosable: true,
      });
    }
  };

  return (
    <SkateModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={t('wallet.receiveCrypto')}
      size="md"
    >
      <Box p={0}>
        <VStack spacing={0} w="100%">
            <Tabs variant="soft-rounded" w="100%">
              <TabList p={4} bg="background">
                <Tab
                  flex={1}
                  color="text"
                  bg="background"
                  _selected={{
                    bg: "primary",
                    color: "text",
                    fontWeight: "bold",
                  }}
                  _hover={{
                    bg: "primary",
                    color: "text",
                  }}
                  borderRadius="lg"
                  transition="all 0.2s ease"
                >
                  <HStack spacing={2}>
                    <FaEthereum size="20px" color="text" />
                    <Text color="text">Ethereum</Text>
                  </HStack>
                </Tab>
                <Tab
                  flex={1}
                  color="text"
                  bg="background"
                  _selected={{
                    bg: "secondary",
                    color: "text",
                    fontWeight: "bold",
                  }}
                  _hover={{
                    bg: "secondary",
                    color: "text",
                  }}
                  borderRadius="lg"
                  transition="all 0.2s ease"
                >
                  <HStack spacing={2}>
                    <FaHive size="20px" color="text" />
                    <Text color="text">Hive</Text>
                  </HStack>
                </Tab>
              </TabList>

              <TabPanels>
                {/* Ethereum Tab */}
                <TabPanel px={6} py={8}>
                  {isConnected && address ? (
                    <VStack spacing={6} align="center">
                      {/* Header with OnchainKit Identity */}
                      <VStack spacing={2}>
                        <HStack spacing={3}>
                          <OnchainAvatar address={address} />
                          <VStack align="start" spacing={0}>
                            <Name address={address} />
                            <Text fontSize="sm" color="textSecondary">
                              ERC-20 tokens supported
                            </Text>
                          </VStack>
                        </HStack>
                      </VStack>

                      <Divider />

                      {/* QR Code */}
                      <VStack spacing={4}>
                        <Box
                          p={6}
                          bg="white"
                          borderRadius="2xl"
                          border="3px solid"
                          borderColor="primary"
                          boxShadow="0 10px 30px rgba(0, 0, 0, 0.1)"
                          position="relative"
                          _hover={{
                            transform: "scale(1.02)",
                            boxShadow: "0 15px 40px rgba(0, 0, 0, 0.15)",
                          }}
                          transition="all 0.3s ease"
                        >
                          {isGeneratingQR ? (
                            <Box
                              w="200px"
                              h="200px"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                            >
                              <Spinner
                                size="xl"
                                color="primary"
                                thickness="4px"
                              />
                            </Box>
                          ) : ethereumQR ? (
                            <Image
                              src={ethereumQR}
                              alt="Ethereum Address QR Code"
                              w="200px"
                              h="200px"
                            />
                          ) : (
                            <Box
                              w="200px"
                              h="200px"
                              bg="gray.100"
                              borderRadius="lg"
                            />
                          )}

                          {ethereumQR && !isGeneratingQR && (
                            <HStack
                              position="absolute"
                              top={2}
                              right={2}
                              spacing={1}
                            >
                              <Tooltip label={t('tooltips.shareAddress')}>
                                <IconButton
                                  aria-label={t('tooltips.shareAddress')}
                                  icon={<Icon as={FaShare} />}
                                  size="sm"
                                  variant="ghost"
                                  bg="white"
                                  color="primary"
                                  _hover={{ bg: "gray.50" }}
                                  onClick={() =>
                                    shareAddress(address, "ethereum")
                                  }
                                />
                              </Tooltip>
                            </HStack>
                          )}
                        </Box>
                      </VStack>

                      {/* Address Display */}
                      <VStack spacing={4} w="100%">
                        <VStack spacing={3} w="100%">
                          <HStack spacing={2}>
                            <Text
                              fontSize="md"
                              color="text"
                              fontWeight="medium"
                            >
                              Wallet Address
                            </Text>
                            <Badge colorScheme="green" borderRadius="full">
                              Connected
                            </Badge>
                          </HStack>

                          <Box
                            w="100%"
                            p={4}
                            bg="rgba(59, 130, 246, 0.05)"
                            border="2px solid"
                            borderColor="rgba(59, 130, 246, 0.2)"
                            borderRadius="xl"
                            _hover={{
                              borderColor: "primary",
                              transform: "scale(1.01)",
                            }}
                            transition="all 0.2s ease"
                            cursor="pointer"
                            onClick={onEthCopy}
                          >
                            <HStack justify="space-between" w="100%">
                              <VStack align="start" spacing={1} flex={1}>
                                <Text
                                  fontSize="sm"
                                  fontFamily="mono"
                                  color="text"
                                  fontWeight="medium"
                                  wordBreak="break-all"
                                  display={{ base: "none", md: "block" }}
                                >
                                  {address}
                                </Text>
                                <Text
                                  fontSize="sm"
                                  fontFamily="mono"
                                  color="text"
                                  fontWeight="medium"
                                  display={{ base: "block", md: "none" }}
                                >
                                  {shortenAddress(address)}
                                </Text>
                              </VStack>
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<Icon as={FiCopy} />}
                                colorScheme={hasEthCopied ? "green" : "blue"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEthCopy();
                                }}
                              >
                                {hasEthCopied ? "Copied!" : "Copy"}
                              </Button>
                            </HStack>
                          </Box>
                        </VStack>

                        <VStack spacing={3} w="100%">
                          <Text
                            fontSize="sm"
                            color="textSecondary"
                            textAlign="center"
                            fontWeight="medium"
                          >
                            Supported Networks
                          </Text>
                          <HStack spacing={2} flexWrap="wrap" justify="center">
                            <Badge colorScheme="blue" borderRadius="full">
                              Ethereum
                            </Badge>
                            <Badge colorScheme="purple" borderRadius="full">
                              Polygon
                            </Badge>
                            <Badge colorScheme="orange" borderRadius="full">
                              BSC
                            </Badge>
                            <Badge colorScheme="green" borderRadius="full">
                              Arbitrum
                            </Badge>
                          </HStack>
                          <Text
                            fontSize="sm"
                            color="textSecondary"
                            lineHeight="1.4"
                            textAlign="center"
                          >
                            This address supports Ethereum and ERC-20 tokens
                            across multiple networks. Always verify the network
                            before sending.
                          </Text>
                        </VStack>
                      </VStack>
                    </VStack>
                  ) : (
                    <VStack spacing={6} align="center" py={12}>
                      <Box
                        fontSize="64px"
                        opacity={0.5}
                        filter="grayscale(100%)"
                      >
                        🔗
                      </Box>
                      <VStack spacing={2}>
                        <Text fontSize="lg" fontWeight="semibold" color="text">
                          Wallet Not Connected
                        </Text>
                        <Text
                          fontSize="sm"
                          color="textSecondary"
                          textAlign="center"
                        >
                          Connect your Ethereum wallet to generate a receive
                          address and QR code
                        </Text>
                      </VStack>
                      <Button
                        size="lg"
                        colorScheme="blue"
                        borderRadius="xl"
                        px={8}
                        py={6}
                        fontSize="md"
                        fontWeight="semibold"
                        bg="linear-gradient(135deg, #3b82f6, #1d4ed8)"
                        _hover={{
                          transform: "translateY(-2px)",
                          boxShadow: "0 8px 25px rgba(59, 130, 246, 0.3)",
                        }}
                        transition="all 0.3s ease"
                      >
                        Connect Wallet
                      </Button>
                    </VStack>
                  )}
                </TabPanel>

                {/* Hive Tab */}
                <TabPanel px={6} py={8}>
                  {user ? (
                    <VStack spacing={6} align="center">
                      {/* Header */}
                      <VStack spacing={2}>
                        <HStack spacing={3}>
                          <FaHive size="24px" color="text" />
                          <VStack align="start" spacing={0}>
                            <Text fontWeight="bold" fontSize="lg" color="text">
                              Hive Wallet
                            </Text>
                            <Text fontSize="sm" color="textSecondary">
                              HIVE, HBD, and Hive Engine tokens
                            </Text>
                          </VStack>
                        </HStack>
                      </VStack>

                      <Divider />

                      {/* QR Code */}
                      <VStack spacing={4}>
                        <Box
                          p={6}
                          bg="white"
                          borderRadius="2xl"
                          border="3px solid"
                          borderColor="red.400"
                          boxShadow="0 10px 30px rgba(0, 0, 0, 0.1)"
                          position="relative"
                          _hover={{
                            transform: "scale(1.02)",
                            boxShadow: "0 15px 40px rgba(0, 0, 0, 0.15)",
                          }}
                          transition="all 0.3s ease"
                        >
                          {isGeneratingQR ? (
                            <Box
                              w="200px"
                              h="200px"
                              display="flex"
                              alignItems="center"
                              justifyContent="center"
                            >
                              <Spinner
                                size="xl"
                                color="red.400"
                                thickness="4px"
                              />
                            </Box>
                          ) : hiveQR ? (
                            <Image
                              src={hiveQR}
                              alt="Hive Username QR Code"
                              w="200px"
                              h="200px"
                            />
                          ) : (
                            <Box
                              w="200px"
                              h="200px"
                              bg="gray.100"
                              borderRadius="lg"
                            />
                          )}
                        </Box>
                      </VStack>

                      {/* Username Display */}
                      <VStack spacing={4} w="100%">
                        <VStack spacing={3} w="100%">
                          <HStack spacing={2}>
                            <Text
                              fontSize="md"
                              color="text"
                              fontWeight="medium"
                            >
                              Hive Username
                            </Text>
                            <Badge colorScheme="green" borderRadius="full">
                              Connected
                            </Badge>
                          </HStack>

                          <Box
                            w="100%"
                            p={4}
                            bg="rgba(239, 68, 68, 0.05)"
                            border="2px solid"
                            borderColor="rgba(239, 68, 68, 0.2)"
                            borderRadius="xl"
                            _hover={{
                              borderColor: "red.400",
                              transform: "scale(1.01)",
                            }}
                            transition="all 0.2s ease"
                            cursor="pointer"
                            onClick={onHiveCopy}
                          >
                            <HStack justify="space-between" w="100%">
                              <Text
                                fontSize="lg"
                                fontFamily="mono"
                                color="text"
                                fontWeight="medium"
                              >
                                @{user}
                              </Text>
                              <Button
                                size="sm"
                                variant="ghost"
                                leftIcon={<Icon as={FiCopy} />}
                                colorScheme={hasHiveCopied ? "green" : "red"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onHiveCopy();
                                }}
                              >
                                {hasHiveCopied ? "Copied!" : "Copy"}
                              </Button>
                            </HStack>
                          </Box>
                        </VStack>

                        <VStack spacing={3} w="100%">
                          <Text
                            fontSize="sm"
                            color="textSecondary"
                            textAlign="center"
                            fontWeight="medium"
                          >
                            Supported Tokens
                          </Text>
                          <HStack spacing={2} flexWrap="wrap" justify="center">
                            <Badge colorScheme="red" borderRadius="full">
                              HIVE
                            </Badge>
                            <Badge colorScheme="orange" borderRadius="full">
                              HBD
                            </Badge>
                            <Badge colorScheme="purple" borderRadius="full">
                              Hive Engine
                            </Badge>
                          </HStack>
                          <Text
                            fontSize="sm"
                            color="textSecondary"
                            lineHeight="1.4"
                            textAlign="center"
                          >
                            Send HIVE, HBD, and other Hive Engine tokens to this
                            username. No memo required for basic transfers.
                          </Text>
                        </VStack>
                      </VStack>
                    </VStack>
                  ) : (
                    <VStack spacing={6} align="center" py={12}>
                      <Box
                        fontSize="64px"
                        opacity={0.5}
                        filter="grayscale(100%)"
                      >
                        🟥
                      </Box>
                      <VStack spacing={2}>
                        <Text fontSize="lg" fontWeight="semibold" color="text">
                          Not Connected to Hive
                        </Text>
                        <Text
                          fontSize="sm"
                          color="textSecondary"
                          textAlign="center"
                        >
                          Connect your Hive account to generate a receive QR
                          code
                        </Text>
                      </VStack>
                      <Button
                        size="lg"
                        colorScheme="red"
                        borderRadius="xl"
                        px={8}
                        py={6}
                        fontSize="md"
                        fontWeight="semibold"
                        bg="linear-gradient(135deg, #ef4444, #dc2626)"
                        _hover={{
                          transform: "translateY(-2px)",
                          boxShadow: "0 8px 25px rgba(239, 68, 68, 0.3)",
                        }}
                        transition="all 0.3s ease"
                      >
                        Connect Hive Account
                      </Button>
                    </VStack>
                  )}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </VStack>
      </Box>
    </SkateModal>
  );
};

export default ReceiveModal;
