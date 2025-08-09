"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  Button,
  Box,
  HStack,
  Text,
  useColorMode,
  Icon,
  useToast,
  Avatar as ChakraAvatar,
  Badge,
} from "@chakra-ui/react";
import { AiohaModal, useAioha } from "@aioha/react-ui";
import { useAccount } from "wagmi";
import { KeyTypes } from "@aioha/aioha";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import { SignInButton } from "@farcaster/auth-kit";
import "@aioha/react-ui/dist/build.css";
import { FaEthereum, FaHive } from "react-icons/fa";
import { SiFarcaster } from "react-icons/si";
import { Name, Avatar } from "@coinbase/onchainkit/identity";
import ConnectionModal from "./ConnectionModal";
import useHiveAccount from "@/hooks/useHiveAccount";
import { migrateLegacyMetadata } from "@/lib/utils/metadataMigration";
import MergeAccountModal, { MergeType } from "../profile/MergeAccountModal";
import { mergeAccounts, generateMergePreview } from "@/lib/services/mergeAccounts";
import { ProfileDiff } from "@/lib/utils/profileDiff";

interface ConnectionStatus {
  name: string;
  connected: boolean;
  icon: any;
  color: string;
  priority: number;
}

export default function AuthButton() {
  const { user, aioha } = useAioha();
  const { colorMode } = useColorMode();
  const [modalDisplayed, setModalDisplayed] = useState(false);
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);
  const toast = useToast();

  // Ensure client-side only rendering to prevent hydration mismatch
  React.useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // Get connection states
  const { isConnected: isEthereumConnected, address: ethereumAddress } =
    useAccount();
  const { isAuthenticated: isFarcasterConnected, profile: farcasterProfile } =
    useFarcasterSession();
  const { hiveAccount } = useHiveAccount(user || "");
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeType, setMergeType] = useState<MergeType>("ethereum");
  const [profileDiff, setProfileDiff] = useState<ProfileDiff | undefined>();
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const prevEthRef = useRef(isEthereumConnected);
  const prevFcRef = useRef(isFarcasterConnected);

  const generatePreview = useCallback(async () => {
    if (!user) return;

    setIsGeneratingPreview(true);
    try {
      const options: any = {
        username: user,
      };

      if (isEthereumConnected && ethereumAddress) {
        options.ethereumAddress = ethereumAddress;
      }

      if (isFarcasterConnected && farcasterProfile) {
        options.farcasterProfile = {
          fid: farcasterProfile.fid,
          username: farcasterProfile.username,
          custody: farcasterProfile.custody,
          verifications: farcasterProfile.verifications,
        };
      }

      const diff = await generateMergePreview(options);
      setProfileDiff(diff);
    } catch (err: any) {
      console.error("Failed to generate merge preview", err);
      toast({
        title: "Preview Failed",
        description: err?.message || "Unable to generate preview",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [user, isEthereumConnected, ethereumAddress, isFarcasterConnected, farcasterProfile, toast]);

  const handleMergeAccounts = useCallback(async () => {
    if (!user) {
      setShowMergeModal(false);
      return;
    }

    setIsMerging(true);
    try {
      const options: any = {
        username: user,
      };

      if (isEthereumConnected && ethereumAddress) {
        options.ethereumAddress = ethereumAddress;
      }

      if (isFarcasterConnected && farcasterProfile) {
        options.farcasterProfile = {
          fid: farcasterProfile.fid,
          username: farcasterProfile.username,
          custody: farcasterProfile.custody,
          verifications: farcasterProfile.verifications,
        };
      }

      const result = await mergeAccounts(options);

      toast({
        title: "Profile Updated",
        status: "success",
        duration: 3000,
      });
    } catch (err: any) {
      console.error("Failed to merge accounts", err);
      toast({
        title: "Merge Failed",
        description: err?.message || "Unable to update account",
        status: "error",
        duration: 3000,
      });
    } finally {
      setIsMerging(false);
      setShowMergeModal(false);
      setProfileDiff(undefined);
    }
  }, [user, isEthereumConnected, ethereumAddress, isFarcasterConnected, farcasterProfile, toast]);

  // Hidden Farcaster sign-in state
  const hiddenSignInRef = React.useRef<HTMLDivElement>(null);
  const [isFarcasterAuthInProgress, setIsFarcasterAuthInProgress] =
    useState(false);

  // Connection status data with priority (Hive > Ethereum > Farcaster) - Memoized
  const connections: ConnectionStatus[] = useMemo(() => [
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
      color: "blue",
      priority: 2,
    },
    {
      name: "Farcaster",
      connected: isFarcasterConnected,
      icon: SiFarcaster,
      color: "purple",
      priority: 3,
    },
  ], [user, isEthereumConnected, isFarcasterConnected]);

  // Memoize metadata parsing to avoid JSON.parse on every render
  const parsedMetadata = useMemo(() => {
    if (!hiveAccount?.json_metadata) return null;
    try {
      const raw = JSON.parse(hiveAccount.json_metadata);
      return migrateLegacyMetadata(raw);
    } catch (err) {
      return null;
    }
  }, [hiveAccount?.json_metadata]);

  useEffect(() => {
    if (!user || !hiveAccount || !parsedMetadata) {
      prevEthRef.current = isEthereumConnected;
      prevFcRef.current = isFarcasterConnected;
      return;
    }

    const hasWallet = !!parsedMetadata.extensions?.wallets?.primary_wallet;
    const hasFarcaster = !!parsedMetadata.extensions?.farcaster?.username;

    if (isEthereumConnected && !prevEthRef.current && !hasWallet) {
      setMergeType("ethereum");
      setShowMergeModal(true);
      generatePreview();
    }

    if (isFarcasterConnected && !prevFcRef.current && !hasFarcaster) {
      setMergeType("farcaster");
      setShowMergeModal(true);
      generatePreview();
    }

    prevEthRef.current = isEthereumConnected;
    prevFcRef.current = isFarcasterConnected;
  }, [isEthereumConnected, isFarcasterConnected, parsedMetadata, user, hiveAccount, generatePreview]);

  // Get primary connection (highest priority connected) - Memoized
  const primaryConnection = useMemo(() => 
    connections
      .filter((conn) => conn.connected)
      .sort((a, b) => a.priority - b.priority)[0],
    [connections]
  );

  // Get user display info for primary connection - Memoized
  const primaryUserInfo = useMemo(() => {
    if (!primaryConnection) return null;

    switch (primaryConnection.name) {
      case "Hive":
        if (user) {
          return {
            displayName: user,
            avatar: `https://images.hive.blog/u/${user}/avatar`,
          };
        }
        break;
      case "Ethereum":
        if (ethereumAddress) {
          return {
            displayName: ethereumAddress,
            avatar: ethereumAddress,
          };
        }
        break;
      case "Farcaster":
        if (farcasterProfile) {
          return {
            displayName:
              farcasterProfile.displayName ||
              farcasterProfile.username ||
              `fid:${farcasterProfile.fid}`,
            avatar:
              farcasterProfile.pfpUrl ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=fid${farcasterProfile.fid}`,
          };
        }
        break;
    }
    return null;
  }, [primaryConnection, user, ethereumAddress, farcasterProfile]);

  // Connection handlers - Memoized with useCallback
  const handleHiveLogin = useCallback(async () => {
    setIsConnectionModalOpen(false);
    await aioha.logout();
    setModalDisplayed(true);
  }, [aioha]);

  const handleFarcasterConnect = useCallback(() => {
    if (isFarcasterAuthInProgress || isFarcasterConnected) {
      return;
    }

    setIsFarcasterAuthInProgress(true);
    const hiddenButton = hiddenSignInRef.current?.querySelector("button");
    if (hiddenButton) {
      hiddenButton.click();
    }
  }, [isFarcasterAuthInProgress, isFarcasterConnected]);

  // Memoize modal close handler
  const handleCloseConnectionModal = useCallback(() => {
    setIsConnectionModalOpen(false);
  }, []);

  // Memoize button click handler
  const handleOpenConnectionModal = useCallback(() => {
    setIsConnectionModalOpen(true);
  }, []);

  if (!isClientMounted) {
    return null;
  }

  return (
    <>
      {/* Main Login/Profile Button */}
      <Button
        onClick={handleOpenConnectionModal}
        color="text"
        bg="background"
        border="1px solid"
        borderColor="border"
        w="full"
        mt="auto"
        mb={8}
        size="md"
        leftIcon={
          primaryConnection && primaryUserInfo ? (
            <Box position="relative">
              {primaryConnection.name === "Ethereum" ? (
                <Box
                  width="24px"
                  height="24px"
                  borderRadius="50%"
                  overflow="hidden"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <Avatar
                    address={ethereumAddress as `0x${string}`}
                    className={"rounded-full"}
                  />
                </Box>
              ) : (
                <ChakraAvatar
                  size="sm"
                  src={primaryUserInfo.avatar}
                  name={primaryUserInfo.displayName}
                />
              )}
            </Box>
          ) : undefined
        }
        rightIcon={
          primaryConnection ? (
            <HStack spacing={1}>
              {connections
                .filter((conn) => conn.connected)
                .map((conn) => (
                  <Badge
                    key={conn.name}
                    size="sm"
                    colorScheme={conn.color}
                    borderRadius="full"
                  >
                    <Icon as={conn.icon} boxSize={2} />
                  </Badge>
                ))}
            </HStack>
          ) : undefined
        }
        _hover={{
          borderColor: "primary",
        }}
      >
        {primaryConnection && primaryUserInfo ? (
          primaryConnection.name === "Ethereum" ? (
            <Name
              address={ethereumAddress as `0x${string}`}
              className="text-sm text-white"
            />
          ) : (
            <Text fontSize="sm" noOfLines={1}>
              {primaryUserInfo.displayName}
            </Text>
          )
        ) : (
          "Login"
        )}
      </Button>

      {/* Connection Modal */}
      <ConnectionModal
        isOpen={isConnectionModalOpen}
        onClose={handleCloseConnectionModal}
        onHiveLogin={handleHiveLogin}
        onFarcasterConnect={handleFarcasterConnect}
        isFarcasterAuthInProgress={isFarcasterAuthInProgress}
        primaryConnection={primaryConnection}
      />

      {/* Hive Login Modal */}
      <div className={colorMode}>
        <AiohaModal
          displayed={modalDisplayed}
          loginOptions={{
            msg: "Login",
            keyType: KeyTypes.Posting,
            loginTitle: "Login",
          }}
          onLogin={() => {}}
          onClose={() => setModalDisplayed(false)}
        />
      </div>

      {/* Hidden Farcaster SignInButton */}
      <Box
        ref={hiddenSignInRef}
        position="absolute"
        top="-9999px"
        left="-9999px"
        pointerEvents="none"
        opacity={0}
      >
        <SignInButton
          onSuccess={({ fid, username }) => {
            setIsFarcasterAuthInProgress(false);
            setIsConnectionModalOpen(false);
            toast({
              status: "success",
              title: "Connected to Farcaster!",
              description: `Welcome, @${username}!`,
              duration: 3000,
            });
          }}
          onError={(error) => {
            console.error("❌ Farcaster Sign In Error:", error);
            setIsFarcasterAuthInProgress(false);
            toast({
              status: "error",
              title: "Authentication failed",
              description:
                error?.message || "Failed to authenticate with Farcaster",
              duration: 5000,
            });
          }}
        />
      </Box>
      <MergeAccountModal
        isOpen={showMergeModal}
        onClose={() => {
          setShowMergeModal(false);
          setProfileDiff(undefined);
        }}
        onMerge={handleMergeAccounts}
        mergeType={mergeType}
        profileDiff={profileDiff}
        isLoading={isGeneratingPreview || isMerging}
      />
    </>
  );
}
