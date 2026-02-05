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
import { useSignIn } from "@farcaster/auth-kit";
import { FaEthereum, FaHive, FaLink } from "react-icons/fa";
import { SiFarcaster } from "react-icons/si";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { useTranslations } from "@/contexts/LocaleContext";
import UserbaseEmailLoginForm from "@/components/userbase/UserbaseEmailLoginForm";
import AccountLinkingModal from "@/components/layout/AccountLinkingModal";
import { useAccountLinkingOpportunities } from "@/hooks/useAccountLinkingOpportunities";
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";

// Blinking cursor animation
const blink = keyframes`
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
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

// Connection status indicator - terminal style with lines + dots
function ConnectionStatus({
  name,
  icon,
  color,
  state,
  onClick,
  isLoading,
  hint,
  subState,
}: {
  name: string;
  icon: any;
  color: string;
  state: "not-linked" | "linked" | "active";
  onClick: () => void;
  isLoading?: boolean;
  hint?: string;
  subState?: string;
}) {
  const stateConfig = {
    "not-linked": {
      lineColor: "whiteAlpha.200",
      dotFill: "transparent",
      dotBorder: "whiteAlpha.300",
      textColor: "gray.500",
      label: "not linked",
      actionLabel: "link →",
    },
    linked: {
      lineColor: "primary",
      dotFill: "transparent",
      dotBorder: "primary",
      textColor: "gray.400",
      label: "linked",
      actionLabel: "connect →",
    },
    active: {
      lineColor: "primary",
      dotFill: "primary",
      dotBorder: "primary",
      textColor: "primary",
      label: "active",
      actionLabel: "disconnect",
    },
  };

  const config = stateConfig[state];

  const rowContent = (
    <HStack
        spacing={2}
        py={1.5}
        cursor="pointer"
        onClick={onClick}
        transition="all 0.2s"
        _hover={{
          bg: "whiteAlpha.50",
          "& .connection-line": {
            opacity: 1,
            bg: state === "not-linked" ? "whiteAlpha.400" : config.lineColor,
          },
          "& .connection-icon": {
            opacity: 1,
            transform: "scale(1.1)",
          },
        }}
        borderRadius="sm"
        px={1}
        mx={-1}
      >
        <Icon
          className="connection-icon"
          as={icon}
          boxSize={3}
          color={color}
          opacity={state === "not-linked" ? 0.4 : 1}
          transition="all 0.2s"
        />
        <Text
          fontSize="xs"
          fontFamily="mono"
          color="gray.400"
          textTransform="lowercase"
          w="70px"
        >
          {name}
        </Text>

        {/* Connection line */}
        <Box
          className="connection-line"
          flex={1}
          h="1px"
          bg={config.lineColor}
          opacity={state === "not-linked" ? 0.3 : 1}
          transition="all 0.2s"
        />

        {/* Status dot */}
        <Circle
          size="8px"
          bg={config.dotFill}
          border="2px solid"
          borderColor={config.dotBorder}
        />

        <Text
          fontSize="2xs"
          fontFamily="mono"
          color={config.textColor}
          w="60px"
          textAlign="right"
        >
          {config.label}
        </Text>
      </HStack>
  );

  return (
    <VStack spacing={0} align="stretch">
      {state === "active" ? (
        <Tooltip label="disconnect" placement="top" hasArrow>
          {rowContent}
        </Tooltip>
      ) : (
        rowContent
      )}

      {/* Sub-state info - no action button needed, clicking row handles it */}
      {subState && (
        <HStack spacing={2} pl="90px" pb={1}>
          <Text fontSize="2xs" fontFamily="mono" color="gray.600">
            {subState}
          </Text>
        </HStack>
      )}
    </VStack>
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
  const { signOut } = useSignIn({});

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
                <HStack spacing={3} py={2}>
                  <Image
                    src={avatarUrl}
                    boxSize={10}
                    borderRadius="sm"
                    alt=""
                  />
                  <VStack align="start" spacing={0} flex={1}>
                    <Text fontFamily="mono" fontSize="sm" color="primary">
                      {displayName}
                    </Text>
                    <Text fontFamily="mono" fontSize="xs" color="gray.500">
                      {user ? "hive" : "email"} session active
                    </Text>
                  </VStack>
                  <Button
                    size="xs"
                    variant="ghost"
                    fontFamily="mono"
                    color="gray.500"
                    onClick={handleProfileClick}
                    _hover={{ color: "primary" }}
                  >
                    profile →
                  </Button>
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
                <Box pt={2}>
                  <Text
                    fontFamily="mono"
                    fontSize="xs"
                    color="gray.500"
                    mb={3}
                    textTransform="lowercase"
                  >
                    available connections
                  </Text>
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
                      isLoading={isFarcasterAuthInProgress}
                    />
                  </VStack>
                </Box>

                {/* Sign Out */}
                <Box pt={3} borderTop="1px solid" borderColor="whiteAlpha.100">
                  <Button
                    variant="ghost"
                    size="xs"
                    fontFamily="mono"
                    color="gray.600"
                    onClick={() => {
                      if (userbaseUser) signOutUserbase();
                      if (user) handleHiveLogout();
                      onClose();
                    }}
                    _hover={{ color: "red.400" }}
                  >
                    end session
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
                      hint="social identity"
                      onClick={onFarcasterConnect}
                      isLoading={isFarcasterAuthInProgress}
                    />

                    {/* Hive */}
                    <ConnectionStatus
                      name="hive"
                      icon={FaHive}
                      color="red.400"
                      state="not-linked"
                      hint="rewards & posting"
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
                          hint="nfts & tokens"
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
