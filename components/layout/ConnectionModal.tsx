"use client";
import React, { useState } from "react";
import {
  Button,
  HStack,
  VStack,
  Text,
  Icon,
  useToast,
  Tooltip,
  Image,
  Box,
  Circle,
  Badge,
  IconButton,
  Fade,
} from "@chakra-ui/react";
import { InfoOutlineIcon, ArrowBackIcon } from "@chakra-ui/icons";

import { keyframes } from "@emotion/react";
import SkateModal from "@/components/shared/SkateModal";
import { useRouter } from "next/navigation";
import { useAioha } from "@aioha/react-ui";
import { useAccount, useDisconnect } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { useFarcasterMiniapp } from "@/hooks/useFarcasterMiniapp";
import { useFarcasterAuthMethods } from "@/components/farcaster/FarcasterAuthIsland";
import { FaEthereum, FaHive, FaLink } from "react-icons/fa";
import { FiLogOut } from "react-icons/fi";
import { IconType } from "react-icons";
import { SiFarcaster } from "react-icons/si";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { useTranslations } from "@/contexts/LocaleContext";
import useIsMobile from "@/hooks/useIsMobile";
import UserbaseEmailLoginForm from "@/components/userbase/UserbaseEmailLoginForm";
import AccountLinkingModal from "@/components/layout/AccountLinkingModal";
import { useAccountLinkingOpportunities } from "@/hooks/useAccountLinkingOpportunities";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";

// Blinking cursor animation
const blink = keyframes`
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
`;

const pulse = keyframes`
  0%, 100% { box-shadow: 0 0 0 0 var(--chakra-colors-primary); opacity: 1; }
  50% { box-shadow: 0 0 0 4px transparent; opacity: 0.6; }
`;

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHiveLogin: () => void;
  onFarcasterConnect: () => void;
  isFarcasterAuthInProgress: boolean;
  actualFarcasterConnection?: boolean;
  actualFarcasterProfile?: any;
}

// Info content for onboarding and identity linking (for modal back)
function InfoContent({ onBack }: { onBack: () => void }) {
  return (
    <VStack align="stretch" spacing={4} p={2} minH="340px">
      <HStack>
        <IconButton
          aria-label="Back"
          icon={<ArrowBackIcon />}
          size="sm"
          variant="ghost"
          colorScheme="primary"
          onClick={onBack}
        />
        <Text fontWeight="bold" fontSize="md">
          How Sign Up & Identity Linking Works
        </Text>
      </HStack>
      <Text>
        <b>New to Skatehive?</b> You can sign up with just an email, a Hive
        account, or an Ethereum wallet. No wallet is required to get started!
      </Text>
      <Text>
        <b>Why link more identities?</b> Linking Hive, Ethereum, and Farcaster
        lets you:
        <ul style={{ marginLeft: 18 }}>
          <li>• Earn rewards and post on Hive</li>
          <li>• Collect and mint NFTs on Ethereum</li>
          <li>• Use your Farcaster social identity</li>
          <li>• Secure your account and recover access</li>
        </ul>
      </Text>
      <Text>
        <b>OG Users:</b> Linking multiple identities gives you more ways to log
        in, post, and recover your account. You can start with one and add more
        anytime.
      </Text>
      <Text>
        <b>Best Practice:</b> Connect as many identities as possible for the
        best experience and security!
      </Text>
    </VStack>
  );
}

const connectionStateConfig = {
  "not-linked": {
    badgeBg: "whiteAlpha.50",
    badgeBorder: "whiteAlpha.200",
    badgeColor: "gray.600",
    dotColor: "gray.600",
    dotFilled: false,
    label: "not linked",
  },
  linked: {
    badgeBg: "whiteAlpha.100",
    badgeBorder: "primary",
    badgeColor: "gray.300",
    dotColor: "primary",
    dotFilled: false,
    label: "linked",
  },
  active: {
    badgeBg: "whiteAlpha.100",
    badgeBorder: "primary",
    badgeColor: "primary",
    dotColor: "primary",
    dotFilled: true,
    label: "active",
  },
};

// Connection status indicator - terminal style with badges
function ConnectionStatus({
  name,
  icon,
  color,
  state,
  onClick,
  subState,
}: {
  name: string;
  icon: IconType;
  color: string;
  state: "not-linked" | "linked" | "active";
  onClick: () => void;
  subState?: string;
}) {

  const config = connectionStateConfig[state];

  const rowContent = (
    <HStack
      spacing={3}
      py={2}
      px={2}
      cursor="pointer"
      onClick={onClick}
      transition="all 0.15s"
      _hover={{ bg: "whiteAlpha.50" }}
      borderRadius="sm"
      mx={-2}
    >
      <Icon
        as={icon}
        boxSize={3.5}
        color={color}
        opacity={state === "not-linked" ? 0.35 : 1}
        flexShrink={0}
      />
      <Text
        fontSize="xs"
        fontFamily="mono"
        color={state === "not-linked" ? "gray.600" : "gray.300"}
        textTransform="lowercase"
        flex={1}
      >
        {name}
        {subState && (
          <Text as="span" fontSize="2xs" color="gray.600" ml={2}>
            · {subState}
          </Text>
        )}
      </Text>

      {/* Status badge */}
      <HStack
        spacing={1.5}
        px={2}
        py={0.5}
        borderRadius="sm"
        border="1px solid"
        borderColor={config.badgeBorder}
        bg={config.badgeBg}
        flexShrink={0}
      >
        <Circle
          size="6px"
          bg={config.dotFilled ? config.dotColor : "transparent"}
          border="1.5px solid"
          borderColor={config.dotColor}
          boxShadow={config.dotFilled ? `0 0 4px var(--chakra-colors-primary)` : "none"}
          animation={config.dotFilled ? `${pulse} 2s ease-in-out infinite` : undefined}
        />
        <Text fontSize="2xs" fontFamily="mono" color={config.badgeColor} lineHeight={1}>
          {config.label}
        </Text>
      </HStack>
    </HStack>
  );

  return (
    <Box>
      {state === "active" ? (
        <Tooltip label="click to disconnect" placement="top" hasArrow>
          {rowContent}
        </Tooltip>
      ) : (
        rowContent
      )}
    </Box>
  );
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function ConnectionModal({
  isOpen,
  onClose,
  onHiveLogin,
  onFarcasterConnect,
  isFarcasterAuthInProgress,
  actualFarcasterConnection,
}: ConnectionModalProps) {
  const isMobile = useIsMobile();
  const { user, aioha } = useAioha();
  const { user: userbaseUser, signOut: signOutUserbase } = useUserbaseAuth();
  const { disconnect: disconnectEth } = useDisconnect();
  const router = useRouter();
  const toast = useToast();
  const t = useTranslations();

  // Account linking state
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const { opportunities, hasUnlinkedOpportunities, isLoading, refresh } =
    useAccountLinkingOpportunities(isOpen);
  const { identities, connections } = useLinkedIdentities();
  // Get connection states
  const { isConnected: isEthereumConnected } = useAccount();
  const { isAuthenticated: isFarcasterConnected, clearSession } =
    useFarcasterSession();
  const { isInMiniapp, user: miniappUser } = useFarcasterMiniapp();
  const { signOut } = useFarcasterAuthMethods();

  // Use passed props if available, otherwise fall back to hook values
  const finalFarcasterConnection =
    actualFarcasterConnection !== undefined
      ? actualFarcasterConnection
      : isFarcasterConnected || (isInMiniapp && !!miniappUser);

  // Determine if user is logged in (any method)
  const isLoggedIn = !!user || !!userbaseUser;

  // Priority: Hive username > Userbase handle > Userbase display_name
  const displayName = user
    ? user
    : userbaseUser?.handle || userbaseUser?.display_name || "";

  const avatarUrl = user
    ? `https://images.hive.blog/u/${user}/avatar/small`
    : userbaseUser?.avatar_url || "/skatehive_square_green.png";

  const hiveConnection = connections.hive;
  const evmConnection = connections.evm;
  const farcasterConnection = connections.farcaster;

  const getState = (connection: typeof hiveConnection) =>
    connection.active ? "active" : connection.linked ? "linked" : "not-linked";

  const hiveState = user ? "active" : getState(hiveConnection);
  const evmState = isEthereumConnected ? "active" : getState(evmConnection);
  const farcasterState = finalFarcasterConnection
    ? "active"
    : getState(farcasterConnection);

  const hiveLabel = hiveConnection.label;
  const evmLabel = evmConnection.label;
  const farcasterLabel = farcasterConnection.label;

  // Connection handlers
  const handleHiveLogout = async () => {
    await aioha.logout();
    toast({ status: "success", title: "disconnected: hive" });
  };

  const handleFarcasterDisconnect = async () => {
    if (isInMiniapp) {
      toast({ status: "info", title: "exit miniapp to disconnect" });
    } else {
      clearSession();
      signOut();
      setTimeout(() => clearSession(), 200);
      toast({ status: "success", title: "disconnected: farcaster" });
    }
  };

  const handleProfileClick = () => {
    const profileHandle =
      user || userbaseUser?.handle || userbaseUser?.id || "";
    if (profileHandle) {
      router.push(`/user/${encodeURIComponent(profileHandle)}?view=snaps`);
      onClose();
    }
  };

  // Ethereum connection handler using RainbowKit

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title={isLoggedIn ? "session" : "authenticate"}
      isCentered={true}
      resizable={!isMobile}
      preciseResize={!isMobile}
    >
      {/* Subtle noise overlay */}
      <Box
        position="absolute"
        inset={0}
        opacity={0.03}
        pointerEvents="none"
        bgImage="url('data:image/svg+xml,%3Csvg viewBox=%220 0 256 256%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noise)%22/%3E%3C/svg%3E')"
      />
      <Box p={4} position="relative" minHeight="420px">
        <Fade in={!showInfo} unmountOnExit>
          <VStack spacing={3} align="stretch">
            {/* === LOGGED IN STATE === */}
            {isLoggedIn ? (
              <>
                {/* Session Info */}
                <HStack
                  spacing={4}
                  py={3}
                  px={2}
                  align="center"
                  role="group"
                  cursor="pointer"
                  onClick={handleProfileClick}
                  borderRadius="sm"
                  border="1px solid"
                  borderColor="transparent"
                  transition="border-color 0.15s, box-shadow 0.15s, background 0.15s"
                  _hover={{
                    borderColor: "primary",
                    boxShadow: "0 0 6px var(--chakra-colors-primary)",
                    bg: "whiteAlpha.50",
                  }}
                >
                  <Box position="relative" flexShrink={0}>
                    <Box
                      position="absolute"
                      inset="-3px"
                      borderRadius="md"
                      border="2px solid"
                      borderColor="primary"
                      boxShadow="0 0 8px var(--chakra-colors-primary)"
                      pointerEvents="none"
                    />
                    <Image
                      src={avatarUrl}
                      boxSize={14}
                      borderRadius="sm"
                      alt=""
                    />
                  </Box>
                  <VStack align="start" spacing={0} flex={1}>
                    <Text fontFamily="mono" fontSize="md" fontWeight="bold" color="primary">
                      {displayName}
                    </Text>
                    <Text fontFamily="mono" fontSize="xs" color="gray.500">
                      {user ? "hive" : "email"} session active
                    </Text>
                  </VStack>
                  <Text
                    fontFamily="mono"
                    fontSize="xs"
                    color="gray.600"
                    transition="color 0.15s"
                    _groupHover={{ color: "primary" }}
                  >
                    PROFILE →
                  </Text>
                </HStack>

                {/* Linking prompt - show when there are unlinked opportunities */}
                {hasUnlinkedOpportunities && !isLoading && (
                  <HStack
                    py={2}
                    px={3}
                    bg="whiteAlpha.50"
                    borderRadius="sm"
                    border="1px solid"
                    borderColor="primary"
                    cursor="pointer"
                    onClick={() => setIsLinkingModalOpen(true)}
                    _hover={{ bg: "whiteAlpha.100" }}
                  >
                    <Icon as={FaLink} boxSize={3} color="primary" />
                    <Text fontFamily="mono" fontSize="xs" color="text" flex={1}>
                      link detected accounts
                    </Text>
                    <Badge
                      bg="primary"
                      color="background"
                      fontFamily="mono"
                      fontSize="2xs"
                      borderRadius="sm"
                    >
                      {opportunities.filter((o) => !o.alreadyLinked).length}
                    </Badge>
                    <Text fontFamily="mono" fontSize="xs" color="primary">
                      →
                    </Text>
                  </HStack>
                )}

                {/* Connections - explicit states */}
                <Box pt={1}>
                  <HStack spacing={2} mb={2} align="center">
                    <Box flex={1} h="1px" bg="whiteAlpha.100" />
                    <Text
                      fontFamily="mono"
                      fontSize="2xs"
                      color="gray.600"
                      textTransform="lowercase"
                      flexShrink={0}
                    >
                      available connections
                    </Text>
                    <Box flex={1} h="1px" bg="whiteAlpha.100" />
                  </HStack>
                  <VStack spacing={0} align="stretch">
                    {/* Hive Connection */}
                    <ConnectionStatus
                      name="hive"
                      icon={FaHive}
                      color="red.400"
                      state={hiveState}
                      subState={
                        hiveState === "active"
                          ? "posting enabled"
                          : hiveLabel
                            ? `linked: ${hiveLabel}`
                            : undefined
                      }
                      onClick={() =>
                        hiveState === "active"
                          ? handleHiveLogout()
                          : onHiveLogin()
                      }
                    />

                    {/* Ethereum Connection */}
                    <ConnectButton.Custom>
                      {({
                        account,
                        chain,
                        openAccountModal,
                        openConnectModal,
                        mounted,
                      }) => {
                        const connected = mounted && account && chain;
                        return (
                          <ConnectionStatus
                            name="eth"
                            icon={FaEthereum}
                            color="blue.300"
                            state={connected ? "active" : evmState}
                            subState={
                              connected
                                ? undefined
                                : evmLabel
                                  ? `linked: ${evmLabel}`
                                  : undefined
                            }
                            onClick={() => {
                              onClose();
                              connected
                                ? openAccountModal()
                                : openConnectModal();
                            }}
                          />
                        );
                      }}
                    </ConnectButton.Custom>

                    {/* Farcaster Connection */}
                    <ConnectionStatus
                      name="farcaster"
                      icon={SiFarcaster}
                      color="purple.400"
                      state={farcasterState}
                      subState={
                        farcasterState === "active"
                          ? undefined
                          : farcasterLabel
                            ? `linked: ${farcasterLabel}`
                            : undefined
                      }
                      onClick={() =>
                        finalFarcasterConnection
                          ? handleFarcasterDisconnect()
                          : onFarcasterConnect()
                      }
                    />
                  </VStack>
                </Box>

                {/* Sign Out */}
                <Box pt={2} borderTop="1px solid" borderColor="whiteAlpha.100">
                  <Button
                    variant="ghost"
                    size="xs"
                    fontFamily="mono"
                    color="red.700"
                    w="full"
                    leftIcon={<Icon as={FiLogOut} boxSize={3} />}
                    border="1px solid"
                    borderColor="red.900"
                    onClick={() => {
                      if (userbaseUser) signOutUserbase();
                      if (user) handleHiveLogout();
                      if (isFarcasterConnected) handleFarcasterDisconnect();
                      if (isEthereumConnected) disconnectEth();
                      onClose();
                    }}
                    _hover={{ color: "red.400", borderColor: "red.500", bg: "whiteAlpha.50" }}
                  >
                    END SESSION
                  </Button>
                </Box>
              </>
            ) : (
              <>
                {/* === NOT LOGGED IN STATE === */}

                {/* Welcome - tighter */}
                <VStack spacing={0} pb={2}>
                  <Text
                    fontFamily="mono"
                    fontSize="lg"
                    color="primary"
                    letterSpacing="tight"
                  >
                    skatehive
                  </Text>
                  <Text fontFamily="mono" fontSize="xs" color="gray.400">
                    join the community
                  </Text>
                </VStack>

                {/* Email Login - Primary Action - EMPHASIZED */}
                <Box>
                  <UserbaseEmailLoginForm variant="compact" />
                  <Text
                    fontFamily="mono"
                    fontSize="2xs"
                    color="gray.500"
                    mt={1.5}
                    textAlign="center"
                  >
                    no wallet required · best for new skaters
                  </Text>
                </Box>

                {/* Divider - cleaner separation */}
                <Box position="relative" py={3}>
                  <Box
                    position="absolute"
                    left={0}
                    right={0}
                    top="50%"
                    h="1px"
                    bg="whiteAlpha.100"
                  />
                  <Text
                    fontFamily="mono"
                    fontSize="2xs"
                    color="gray.500"
                    bg="background"
                    px={3}
                    position="relative"
                    w="fit-content"
                    mx="auto"
                    textTransform="uppercase"
                    letterSpacing="wider"
                  >
                    or link existing
                  </Text>
                </Box>

                {/* Connection options - reordered: Farcaster, Hive, Ethereum */}
                <VStack spacing={1.5} align="stretch">
                  <Text
                    fontFamily="mono"
                    fontSize="xs"
                    color="gray.500"
                    mb={1}
                    textTransform="lowercase"
                  >
                    available connections
                  </Text>
                  <VStack spacing={0} align="stretch">
                    {/* Farcaster */}
                    <ConnectionStatus
                      name="farcaster"
                      icon={SiFarcaster}
                      color="purple.400"
                      state="not-linked"
                      onClick={onFarcasterConnect}
                    />

                    {/* Hive */}
                    <ConnectionStatus
                      name="hive"
                      icon={FaHive}
                      color="red.400"
                      state="not-linked"
                      onClick={onHiveLogin}
                    />

                    {/* Ethereum */}
                    <ConnectButton.Custom>
                      {({ openConnectModal }) => (
                        <ConnectionStatus
                          name="eth"
                          icon={FaEthereum}
                          color="blue.300"
                          state="not-linked"
                          onClick={() => {
                            onClose();
                            openConnectModal();
                          }}
                        />
                      )}
                    </ConnectButton.Custom>
                  </VStack>
                  <Text
                    fontFamily="mono"
                    fontSize="2xs"
                    color="gray.500"
                    textAlign="center"
                    mt={2}
                  >
                    already part of the ecosystem
                  </Text>
                </VStack>

                {/* Help - terminal style with emphasis */}
                <Box pt={3} borderTop="1px solid" borderColor="whiteAlpha.100">
                  <Button
                    variant="ghost"
                    size="xs"
                    fontFamily="mono"
                    color="gray.500"
                    onClick={() =>
                      window.open(
                        "https://docs.skatehive.app/docs/create-account",
                        "_blank",
                      )
                    }
                    _hover={{ color: "primary", bg: "whiteAlpha.50" }}
                    w="full"
                    justifyContent="center"
                  >
                    <Text
                      as="span"
                      color="primary"
                      animation={`${blink} 1.2s step-end infinite`}
                      mr={1.5}
                    >
                      ?
                    </Text>
                    <Text
                      as="span"
                      textTransform="uppercase"
                      fontSize="2xs"
                      letterSpacing="wider"
                    >
                      type help
                    </Text>
                  </Button>
                </Box>
              </>
            )}
          </VStack>
        </Fade>
        <Fade in={showInfo} unmountOnExit>
          <InfoContent onBack={() => setShowInfo(false)} />
        </Fade>

        {/* Info Icon - bottom right */}
        <Box position="absolute" bottom={3} right={3} zIndex={10}>
          <Tooltip label="How sign up & identity linking works" placement="top">
            <IconButton
              aria-label="Info"
              icon={<InfoOutlineIcon />}
              size="sm"
              variant="ghost"
              colorScheme="primary"
              onClick={() => setShowInfo(true)}
              bg="background"
              _hover={{ bg: "muted" }}
            />
          </Tooltip>
        </Box>
      </Box>
      {/* Account Linking Modal */}
      <AccountLinkingModal
        isOpen={isLinkingModalOpen}
        onClose={() => setIsLinkingModalOpen(false)}
        opportunities={opportunities}
        isLoading={isLoading}
        onRefresh={refresh}
      />
    </SkateModal>
  );
}
