"use client";
import React from "react";
import {
  Button,
  HStack,
  VStack,
  Text,
  Icon,
  useToast,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  Badge,
  Flex,
  Tooltip,
  Image,
} from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useAioha } from "@aioha/react-ui";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { useFarcasterMiniapp } from "@/hooks/useFarcasterMiniapp";
import { useSignIn } from "@farcaster/auth-kit";
import { FaEthereum, FaHive, FaInfoCircle } from "react-icons/fa";
import { SiFarcaster } from "react-icons/si";

interface ConnectionStatus {
  name: string;
  connected: boolean;
  icon: any;
  color: string;
  priority: number;
}

// Network information texts - easily editable
const NETWORK_INFO = {
  Hive: {
    description:
      "Create posts, vote on content, earn rewards, and access your Hive wallet",
    features: [
      "✍️ Create & share content",
      "🗳️ Vote & earn rewards",
      "💰 Access Hive wallet",
      "🎯 Full platform access",
    ],
  },
  Ethereum: {
    description:
      "Connect your Ethereum wallet for Web3 features and token interactions",
    features: [
      "💎 Access NFTs",
      "🔗 Web3 integrations",
      "💸 Token transactions",
      "🛡️ Decentralized identity",
    ],
  },
  Farcaster: {
    description:
      "Connect with the Farcaster ecosystem and cross-post your content",
    features: [
      "🌐 Cross-platform posting",
      "👥 Farcaster community",
      "📡 Protocol integrations",
      "🔄 Social sync",
    ],
  },
};

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHiveLogin: () => void;
  onFarcasterConnect: () => void;
  isFarcasterAuthInProgress: boolean;
  primaryConnection?: ConnectionStatus | undefined;
  // Add props for Farcaster connection state to avoid hook duplication
  actualFarcasterConnection?: boolean;
  actualFarcasterProfile?: any;
}

export default function ConnectionModal({
  isOpen,
  onClose,
  onHiveLogin,
  onFarcasterConnect,
  isFarcasterAuthInProgress,
  primaryConnection,
  actualFarcasterConnection,
  actualFarcasterProfile,
}: ConnectionModalProps) {
  const { user, aioha } = useAioha();
  const router = useRouter();
  const toast = useToast();
  // Get connection states
  const { isConnected: isEthereumConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const {
    isAuthenticated: isFarcasterConnected,
    profile: farcasterProfile,
    clearSession,
  } = useFarcasterSession();
  const { isInMiniapp, user: miniappUser } = useFarcasterMiniapp();
  const { signOut } = useSignIn({});

  // Use passed props if available, otherwise fall back to hook values
  const finalFarcasterConnection =
    actualFarcasterConnection !== undefined
      ? actualFarcasterConnection
      : isFarcasterConnected || (isInMiniapp && !!miniappUser);
  const finalFarcasterProfile =
    actualFarcasterProfile !== undefined
      ? actualFarcasterProfile
      : farcasterProfile || miniappUser;

  // Connection status data with priority (Hive > Ethereum > Farcaster)
  const connections: ConnectionStatus[] = [
    {
      name: "Hive",
      connected: !!user,
      icon: FaHive,
      color: "red",
      priority: 1,
    },
    {
      name: "Ethereum",
      connected: isEthereumConnected,
      icon: FaEthereum,
      color: "blue.200",
      priority: 2,
    },
    {
      name: "Farcaster",
      connected: finalFarcasterConnection,
      icon: SiFarcaster,
      color: "purple.400",
      priority: 3,
    },
  ];

  // Connection handlers
  const handleHiveLogout = async () => {
    await aioha.logout();
    toast({
      status: "success",
      title: "Logged out from Hive",
      description: "You have been disconnected from Hive",
    });
  };

  const handleEthereumConnect = () => {
    try {
      openConnectModal?.();
    } catch (error) {
      toast({
        status: "error",
        title: "Connection failed",
        description: "Failed to connect to Ethereum wallet",
      });
    }
  };

  const handleEthereumDisconnect = () => {
    disconnect();
    toast({
      status: "success",
      title: "Disconnected from Ethereum",
      description: "Your Ethereum wallet has been disconnected",
    });
  };

  const handleFarcasterDisconnect = async () => {
    if (isInMiniapp) {
      toast({
        status: "info",
        title: "Miniapp Context",
        description:
          "You're connected via Farcaster miniapp. Close the app to disconnect.",
      });
    } else {
      console.log("[FarcasterDisconnect] Starting disconnect process...");

      // Step 1: Clear the custom session first
      clearSession();
      console.log("[FarcasterDisconnect] Custom session cleared");

      // Step 2: Sign out from Auth Kit
      signOut();
      console.log("[FarcasterDisconnect] Auth Kit signOut called");

      // Step 3: Force a small delay and try to clear again to ensure it sticks
      setTimeout(() => {
        clearSession();
        console.log(
          "[FarcasterDisconnect] Second clearSession call for safety"
        );
      }, 200);

      toast({
        status: "success",
        title: "Disconnected from Farcaster",
        description: "You have been signed out from Farcaster",
      });
    }
  };

  const handleProfileClick = () => {
    if (user) {
      router.push(`/user/${user}?view=snaps`);
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered>
      <ModalOverlay bg="blackAlpha.700" backdropFilter="blur(8px)" />{" "}
      <ModalContent bg={"background"}>
        <ModalHeader>
          {primaryConnection ? "Manage Connections" : "Connect to SkateHive"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={4} align="stretch">
            {/* Show profile option if connected to Hive */}
            {user && (
              <Button
                leftIcon={
                  <Image
                    src={`https://images.hive.blog/u/${user}/avatar/small`}
                    boxSize={5}
                    borderRadius="full"
                    alt="Hive Profile Picture"
                  />
                }
                onClick={handleProfileClick}
                variant="outline"
                justifyContent="flex-start"
              >
                View Profile
              </Button>
            )}

            {/* Show Farcaster profile option if connected to Farcaster but not Hive */}
            {!user && finalFarcasterProfile && (
              <Button
                leftIcon={
                  <Image
                    src={finalFarcasterProfile.pfpUrl || ""}
                    boxSize={5}
                    borderRadius="full"
                    alt="Farcaster Profile Picture"
                  />
                }
                onClick={() => {
                  // Could navigate to a Farcaster-specific page or close modal
                  onClose();
                }}
                variant="outline"
                justifyContent="flex-start"
              >
                @
                {finalFarcasterProfile.username ||
                  finalFarcasterProfile.displayName}
              </Button>
            )}

            {/* Connection options */}
            {connections.map((connection) => (
              <Flex
                key={connection.name}
                align="center"
                justify="space-between"
                p={4}
                border="1px solid"
                borderColor="border"
                borderRadius="md"
              >
                <HStack spacing={3}>
                  <Icon
                    as={connection.icon}
                    boxSize={5}
                    color={connection.color}
                  />
                  <VStack align="start" spacing={0}>
                    <HStack spacing={2} align="center">
                      <Text fontWeight="medium">{connection.name}</Text>
                      <Tooltip
                        label={
                          <VStack align="start" spacing={2} p={2}>
                            <Text fontSize="sm" fontWeight="medium">
                              {
                                NETWORK_INFO[
                                  connection.name as keyof typeof NETWORK_INFO
                                ]?.description
                              }
                            </Text>
                            <VStack align="start" spacing={1}>
                              {NETWORK_INFO[
                                connection.name as keyof typeof NETWORK_INFO
                              ]?.features.map((feature, index) => (
                                <Text
                                  key={index}
                                  fontSize="xs"
                                  color="gray.300"
                                >
                                  {feature}
                                </Text>
                              ))}
                            </VStack>
                          </VStack>
                        }
                        placement="top"
                        hasArrow
                        bg="gray.800"
                        color="white"
                        borderRadius="md"
                        p={3}
                        maxW="300px"
                      >
                        <Icon
                          as={FaInfoCircle}
                          boxSize={3}
                          color="gray.400"
                          cursor="pointer"
                          _hover={{ color: "primary" }}
                        />
                      </Tooltip>
                    </HStack>
                    {connection.connected && (
                      <Badge size="sm" colorScheme="green" variant="subtle">
                        Connected
                      </Badge>
                    )}
                  </VStack>
                </HStack>

                {connection.connected ? (
                  <Button
                    size="sm"
                    colorScheme="red"
                    variant="outline"
                    onClick={() => {
                      switch (connection.name) {
                        case "Hive":
                          handleHiveLogout();
                          break;
                        case "Ethereum":
                          handleEthereumDisconnect();
                          break;
                        case "Farcaster":
                          handleFarcasterDisconnect();
                          break;
                      }
                    }}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    colorScheme="blue"
                    onClick={() => {
                      switch (connection.name) {
                        case "Hive":
                          onHiveLogin();
                          break;
                        case "Ethereum":
                          handleEthereumConnect();
                          break;
                        case "Farcaster":
                          onFarcasterConnect();
                          break;
                      }
                    }}
                    isLoading={
                      connection.name === "Farcaster" &&
                      isFarcasterAuthInProgress
                    }
                    loadingText="Connecting..."
                  >
                    Connect
                  </Button>
                )}
              </Flex>
            ))}
            {!connections.some((conn) => conn.connected) && (
              <Button
                colorScheme="green"
                onClick={() =>
                  window.open(
                    "https://docs.skatehive.app/docs/create-account",
                    "_blank"
                  )
                }
                leftIcon={<Icon as={FaInfoCircle} />}
                variant="outline"
              >
                <Text display={{ base: "none", md: "inline" }}>
                  How the F. I connect to this shit?
                </Text>
                <Text display={{ base: "inline", md: "none" }}>
                  How to connect?
                </Text>
              </Button>
            )}
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
