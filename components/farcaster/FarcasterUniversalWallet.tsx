"use client";
import React, { useMemo } from "react";
import { useFarcasterMiniapp } from "@/hooks/useFarcasterMiniapp";
import FarcasterMiniappWallet from "./FarcasterMiniappWallet";
import { Box, Text, VStack, Spinner, useToast } from "@chakra-ui/react";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import dynamic from "next/dynamic";

// Dynamic import to prevent SSR indexedDB errors
const SignInButton = dynamic(
  () => import("@farcaster/auth-kit").then(mod => mod.SignInButton),
  { ssr: false, loading: () => <Spinner size="sm" /> }
);

interface FarcasterUniversalWalletProps {
  hiveUsername?: string;
}

export default function FarcasterUniversalWallet({
  hiveUsername,
}: FarcasterUniversalWalletProps) {
  const { isInMiniapp, isReady, user } = useFarcasterMiniapp();
  const { profile: farcasterProfile } = useFarcasterSession();
  const toast = useToast();

  // Debug logging - use useMemo to prevent excessive logging
  // const debugInfo = useMemo(
  //   () => ({
  //     isInMiniapp,
  //     user,
  //     farcasterProfile,
  //     hiveUsername,
  //     userAgent: typeof window !== "undefined" ? navigator.userAgent : "SSR",
  //     location: typeof window !== "undefined" ? window.location.href : "SSR",
  //   }),
  //   [isInMiniapp, user, farcasterProfile, hiveUsername]
  // );

  // Show loading state while determining context
  if (!isReady) {
    return (
      <Box
        p={4}
        bg="background"
        borderRadius="lg"
        border="1px solid"
        borderColor="muted"
        textAlign="center"
      >
        <Spinner size="sm" />
        <Text fontSize="sm" color="muted" mt={2}>
          Detecting Farcaster context...
        </Text>
      </Box>
    );
  }

  return (
    <VStack spacing={4} align="stretch">
      {/* Debug Panel - only show in development */}
      {/* {process.env.NODE_ENV === "development" && (
        <Box
          p={3}
          bg="gray.50"
          borderRadius="none"
          border="1px solid"
          borderColor="gray.200"
        >
          <Text fontSize="xs" fontWeight="bold" color="gray.700" mb={2}>
            🐛 Debug Info:
          </Text>
          <VStack spacing={1} align="start">
            <Text fontSize="xs" color="gray.600">
              isInMiniapp: {isInMiniapp ? "✅ YES" : "❌ NO"}
            </Text>
            <Text fontSize="xs" color="gray.600">
              user: {user ? `@${user.username} (FID: ${user.fid})` : "null"}
            </Text>
            <Text fontSize="xs" color="gray.600">
              farcasterProfile:{" "}
              {farcasterProfile ? `@${farcasterProfile.username}` : "null"}
            </Text>
            <Text fontSize="xs" color="gray.600">
              hiveUsername: {hiveUsername || "null"}
            </Text>
          </VStack>
        </Box>
      )} */}

      {/* Main Content */}
      {(() => {
        // If in miniapp, show the native wallet interface
        if (isInMiniapp) {
          return <FarcasterMiniappWallet hiveUsername={hiveUsername} />;
        }

        // If not in miniapp but has Farcaster profile, show wallet info
        if (farcasterProfile) {
          return (
            <Box
              p={4}
              bg="background"
              borderRadius="lg"
              border="1px solid"
              borderColor="muted"
            >
              <VStack spacing={3} align="start">
                <Text fontSize="sm" fontWeight="medium" color="text">
                  Connected as @{farcasterProfile.username}
                </Text>
                <Text fontSize="xs" color="muted">
                  FID: {farcasterProfile.fid}
                </Text>
                {/* Check if profile has custody property (Auth Kit profile) */}
                {"custody" in farcasterProfile && farcasterProfile.custody && (
                  <Text fontSize="xs" color="blue.400">
                    Custody: {farcasterProfile.custody.slice(0, 6)}...
                    {farcasterProfile.custody.slice(-4)}
                  </Text>
                )}
                {hiveUsername && (
                  <Text fontSize="xs" color="green.400">
                    Linked to Hive: @{hiveUsername}
                  </Text>
                )}
                <Box
                  p={3}
                  bg="purple.50"
                  borderRadius="none"
                  border="1px solid"
                  borderColor="purple.200"
                  w="full"
                >
                  <Text fontSize="xs" color="purple.700">
                    💡 <strong>Pro tip:</strong> Open this page in the Farcaster
                    app to access native wallet features and make transactions
                    seamlessly.
                  </Text>
                </Box>
              </VStack>
            </Box>
          );
        }

        // No Farcaster connection - show sign in button for web context
        return (
          <Box p={4} bg="background" textAlign="center">
            <SignInButton
              onSuccess={({ fid, username }) => {
                toast({
                  status: "success",
                  title: "Connected to Farcaster!",
                  description: `Welcome, @${username}!`,
                  duration: 3000,
                });
              }}
              onError={(error) => {
                console.error("❌ Farcaster Sign In Error:", error);
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
        );
      })()}
    </VStack>
  );
}
