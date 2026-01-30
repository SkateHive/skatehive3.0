"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Heading,
  HStack,
  Text,
  VStack,
  Badge,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useToast,
  Code,
} from "@chakra-ui/react";
import { FaDownload, FaGift, FaKey, FaCheckCircle } from "react-icons/fa";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

interface HiveKeyInfo {
  has_key: boolean;
  hive_username?: string;
  created_at?: string;
  last_used_at?: string;
  source?: "sponsored" | "manual";
}

interface SponsorshipInfo {
  sponsored: boolean;
  sponsor_username?: string;
  sponsored_at?: string;
  hive_username?: string;
}

export default function HiveSponsorshipInfo() {
  const toast = useToast();
  const { user } = useUserbaseAuth();

  const [keyInfo, setKeyInfo] = useState<HiveKeyInfo | null>(null);
  const [sponsorshipInfo, setSponsorshipInfo] = useState<SponsorshipInfo | null>(null);
  const [isResendingBackup, setIsResendingBackup] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Fetch key info
      const keyResponse = await fetch("/api/userbase/keys/hive-info", {
        cache: "no-store",
      });
      if (keyResponse.ok) {
        const keyData = await keyResponse.json();
        setKeyInfo(keyData);
      }

      // Fetch sponsorship info
      const sponsorResponse = await fetch("/api/userbase/sponsorships/my-info", {
        cache: "no-store",
      });
      if (sponsorResponse.ok) {
        const sponsorData = await sponsorResponse.json();
        setSponsorshipInfo(sponsorData);
      }
    } catch (error) {
      console.error("Failed to fetch Hive account info:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const handleResendBackup = async () => {
    setIsResendingBackup(true);
    try {
      const response = await fetch("/api/userbase/keys/resend-backup", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to resend backup");
      }

      toast({
        title: "Key Backup Sent!",
        description: "Check your email for your Hive account keys.",
        status: "success",
        duration: 5000,
        isClosable: true,
      });
    } catch (error: any) {
      toast({
        title: "Failed to Send Backup",
        description: error.message,
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsResendingBackup(false);
    }
  };

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <Box>
        <Heading size="sm" color="primary" mb={2}>
          Hive Account Status
        </Heading>
        <Text color="primary" fontSize="sm">
          Loading...
        </Text>
      </Box>
    );
  }

  // Not sponsored and no key stored
  if (!sponsorshipInfo?.sponsored && !keyInfo?.has_key) {
    return (
      <Box>
        <Heading size="sm" color="primary" mb={2}>
          Hive Account Status
        </Heading>
        <Alert status="info" borderRadius="md">
          <AlertIcon />
          <Box>
            <AlertTitle fontSize="sm">Lite Account</AlertTitle>
            <AlertDescription fontSize="sm">
              You're currently using a lite account. Ask a community member with a Hive account to sponsor you, or link an existing Hive account.
            </AlertDescription>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Heading size="sm" color="primary" mb={4}>
        Hive Account Status
      </Heading>

      <VStack spacing={4} align="stretch">
        {/* Sponsored Account Info */}
        {sponsorshipInfo?.sponsored && (
          <Alert
            status="success"
            borderRadius="md"
            variant="subtle"
          >
            <AlertIcon as={FaGift} />
            <Box flex="1">
              <AlertTitle fontSize="sm" display="flex" alignItems="center" gap={2}>
                Sponsored Account
                <Badge colorScheme="green" fontSize="xs" display="flex" alignItems="center" gap={1}>
                  <FaCheckCircle size={12} />
                  Active
                </Badge>
              </AlertTitle>
              <AlertDescription fontSize="sm" mt={1}>
                <VStack align="start" spacing={1}>
                  <Text>
                    Your Hive account <Code fontSize="sm">@{sponsorshipInfo.hive_username}</Code> was sponsored by{" "}
                    <Code fontSize="sm">@{sponsorshipInfo.sponsor_username || "anonymous"}</Code>
                  </Text>
                  {sponsorshipInfo.sponsored_at && (
                    <Text fontSize="xs" color="gray.600">
                      Sponsored on {new Date(sponsorshipInfo.sponsored_at).toLocaleDateString()}
                    </Text>
                  )}
                </VStack>
              </AlertDescription>
            </Box>
          </Alert>
        )}

        {/* Key Info */}
        {keyInfo?.has_key && (
          <Box
            borderWidth={1}
            borderColor="green.500"
            borderRadius="md"
            p={4}
            bg="green.50"
            _dark={{ bg: "green.900", borderColor: "green.600" }}
          >
            <HStack spacing={2} mb={3}>
              <FaKey size={16} />
              <Text fontWeight="semibold" fontSize="sm">
                Posting Key Stored
              </Text>
              {keyInfo.source && (
                <Badge colorScheme="green" fontSize="xs">
                  {keyInfo.source === "sponsored" ? "From Sponsorship" : "Manually Added"}
                </Badge>
              )}
            </HStack>

            <VStack align="start" spacing={1} fontSize="sm" color="gray.600" _dark={{ color: "gray.400" }}>
              {keyInfo.hive_username && (
                <Text>
                  Account: <Code fontSize="sm">@{keyInfo.hive_username}</Code>
                </Text>
              )}
              {keyInfo.created_at && (
                <Text fontSize="xs">
                  Stored on {new Date(keyInfo.created_at).toLocaleDateString()}
                </Text>
              )}
              {keyInfo.last_used_at && (
                <Text fontSize="xs">
                  Last used {new Date(keyInfo.last_used_at).toLocaleDateString()}
                </Text>
              )}
            </VStack>
          </Box>
        )}

        {/* Actions */}
        {keyInfo?.has_key && (
          <Box>
            <Text fontSize="sm" color="gray.600" _dark={{ color: "gray.400" }} mb={3}>
              Need a backup of your keys? We can resend them to your email.
            </Text>

            <HStack spacing={3}>
              <Button
                leftIcon={<FaDownload size={16} />}
                onClick={handleResendBackup}
                isLoading={isResendingBackup}
                size="sm"
                colorScheme="green"
                variant="outline"
              >
                Resend Key Backup
              </Button>
            </HStack>

            <Alert status="warning" borderRadius="md" mt={4} fontSize="sm">
              <AlertIcon />
              <Box>
                <AlertTitle fontSize="xs">Keep Your Keys Safe!</AlertTitle>
                <AlertDescription fontSize="xs">
                  Your Hive keys control your account and earnings. Store them securely and never share them with anyone.
                </AlertDescription>
              </Box>
            </Alert>
          </Box>
        )}
      </VStack>
    </Box>
  );
}
