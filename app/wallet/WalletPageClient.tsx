"use client";
import MainWallet from "@/components/wallet/MainWallet";
import { useAioha } from "@aioha/react-ui";
import { Box, Text, Center, Spinner } from "@chakra-ui/react";
import { useEffect, useState } from "react";

export default function WalletPageClient() {
  const { user, aioha } = useAioha();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Debug: log user and aioha values
    console.log("[WalletPageClient] aioha:", aioha, "user:", user);
    // Only set loading to false once authentication state is determined
    // Check if aioha has completed initialization
    if (aioha) {
      setIsLoading(false);
    }
  }, [user, aioha]);

  if (isLoading) {
    return (
      <Center height="200px">
        <Spinner size="lg" />
        <Text ml={3}>Loading...</Text>
      </Center>
    );
  }

  // Add validation and logging for user
  if (!user || typeof user !== "string" || user.trim() === "") {
    console.error("[WalletPageClient] Invalid or missing user:", user);
    return (
      <Center height="200px">
        <Box textAlign="center">
          <Text fontSize="lg" mb={4}>
            Please log in to view your wallet
          </Text>
          <Text color="gray.500">
            You need to be authenticated to access this page
          </Text>
        </Box>
      </Center>
    );
  }

  return <MainWallet username={user} />;
}
