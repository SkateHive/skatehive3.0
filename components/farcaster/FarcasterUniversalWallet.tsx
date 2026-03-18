"use client";
import React from "react";
import { Box, Text, VStack, Spinner, useToast } from "@chakra-ui/react";
import { useFarcasterSession } from "@/hooks/useFarcasterSession";
import dynamic from "next/dynamic";

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
  const { profile: farcasterProfile } = useFarcasterSession();
  const toast = useToast();

  if (farcasterProfile) {
    return (
      <Box p={4} bg="background" borderRadius="lg" border="1px solid" borderColor="muted">
        <VStack spacing={3} align="start">
          <Text fontSize="sm" fontWeight="medium" color="text">
            Connected as @{farcasterProfile.username}
          </Text>
          <Text fontSize="xs" color="muted">
            FID: {farcasterProfile.fid}
          </Text>
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
        </VStack>
      </Box>
    );
  }

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
          toast({
            status: "error",
            title: "Authentication failed",
            description: error?.message || "Failed to authenticate with Farcaster",
            duration: 5000,
          });
        }}
      />
    </Box>
  );
}
