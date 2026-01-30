"use client";

import { useState } from "react";
import {
  Button,
  VStack,
  HStack,
  Text,
  Box,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Progress,
  Code,
  useToast,
  useTheme,
} from "@chakra-ui/react";
import SkateModal from "@/components/shared/SkateModal";
import { generateHiveKeys } from "@/lib/hive/keyGeneration";
import { buildAccountCreateOperation } from "@/lib/hive/accountCreation";
import { SPONSORSHIP_CONFIG } from "@/config/app.config";

interface SponsorshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  liteUserId: string;
  liteUserHandle: string;
  liteUserDisplayName: string;
  sponsorHiveUsername: string;
}

type SponsorshipStatus =
  | "idle"
  | "generating_keys"
  | "awaiting_signature"
  | "verifying"
  | "processing"
  | "success"
  | "error";

declare global {
  interface Window {
    hive_keychain?: any;
  }
}

/**
 * Sponsorship Modal Component
 * Handles the complete sponsorship workflow:
 * 1. Generate Hive keys
 * 2. Build account_create operation
 * 3. Request Keychain signature
 * 4. Process sponsorship (verify, encrypt, email)
 */
export default function SponsorshipModal({
  isOpen,
  onClose,
  liteUserId,
  liteUserHandle,
  liteUserDisplayName,
  sponsorHiveUsername,
}: SponsorshipModalProps) {
  const [status, setStatus] = useState<SponsorshipStatus>("idle");
  const [error, setError] = useState<string>("");
  const [sponsorshipId, setSponsorshipId] = useState<string | null>(null);
  const toast = useToast();
  const theme = useTheme();

  const handleSponsor = async () => {
    try {
      // Step 1: Generate keys
      setStatus("generating_keys");
      const keys = generateHiveKeys(liteUserHandle);

      // Step 2: Create sponsorship record
      const createResponse = await fetch("/api/userbase/sponsorships/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lite_user_id: liteUserId,
          hive_username: liteUserHandle,
          cost_type: "hive_transfer",
          cost_amount: SPONSORSHIP_CONFIG.COST_HIVE,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Failed to create sponsorship");
      }

      const createData = await createResponse.json();
      setSponsorshipId(createData.sponsorship_id);

      // Step 3: Build account_create operation
      const operation = buildAccountCreateOperation(
        sponsorHiveUsername,
        liteUserHandle,
        keys,
        `${SPONSORSHIP_CONFIG.COST_HIVE.toFixed(3)} HIVE`
      );

      // Step 4: Request Keychain signature
      setStatus("awaiting_signature");

      if (!window.hive_keychain) {
        throw new Error(
          "Hive Keychain not found. Please install the Hive Keychain browser extension."
        );
      }

      window.hive_keychain.requestBroadcast(
        sponsorHiveUsername,
        [operation],
        "active",
        async (response: any) => {
          if (response.success) {
            setStatus("verifying");

            try {
              // Step 5: Process sponsorship
              setStatus("processing");

              const processResponse = await fetch(
                "/api/userbase/sponsorships/process",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    sponsorship_id: createData.sponsorship_id,
                    transaction_id: response.result.id,
                    keys,
                  }),
                }
              );

              if (!processResponse.ok) {
                const errorData = await processResponse.json();
                throw new Error(errorData.error || "Failed to process sponsorship");
              }

              const processData = await processResponse.json();

              setStatus("success");

              toast({
                title: "Sponsorship Successful! 🎉",
                description: `@${liteUserHandle} now has a Hive account and will receive their keys via email.`,
                status: "success",
                duration: 8000,
                isClosable: true,
              });

              // Close modal after success
              setTimeout(() => {
                onClose();
              }, 2000);
            } catch (error: any) {
              setStatus("error");
              setError(error.message || "Failed to process sponsorship");

              toast({
                title: "Processing Failed",
                description: error.message,
                status: "error",
                duration: 8000,
                isClosable: true,
              });
            }
          } else {
            setStatus("error");
            setError(response.message || "Keychain signature failed");

            toast({
              title: "Signature Failed",
              description: response.message || "Failed to sign transaction",
              status: "error",
              duration: 8000,
              isClosable: true,
            });
          }
        }
      );
    } catch (error: any) {
      console.error("Sponsorship error:", error);
      setStatus("error");
      setError(error.message || "Unknown error occurred");

      toast({
        title: "Sponsorship Failed",
        description: error.message,
        status: "error",
        duration: 8000,
        isClosable: true,
      });
    }
  };

  const handleClose = () => {
    if (status !== "awaiting_signature" && status !== "processing") {
      setStatus("idle");
      setError("");
      setSponsorshipId(null);
      onClose();
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "generating_keys":
        return "Generating Hive keys...";
      case "awaiting_signature":
        return "Waiting for Keychain signature...";
      case "verifying":
        return "Verifying transaction on blockchain...";
      case "processing":
        return "Processing sponsorship (encrypting keys, sending email)...";
      case "success":
        return "Sponsorship completed successfully!";
      case "error":
        return "Sponsorship failed";
      default:
        return "";
    }
  };

  const isProcessing =
    status === "generating_keys" ||
    status === "awaiting_signature" ||
    status === "verifying" ||
    status === "processing";

  // Footer buttons
  const footer = (
    <HStack spacing={3} width="100%" justify="flex-end">
      <Button
        variant="ghost"
        onClick={handleClose}
        isDisabled={isProcessing}
        size="sm"
      >
        {status === "success" ? "Close" : "Cancel"}
      </Button>
      {status === "idle" && (
        <Button colorScheme="green" onClick={handleSponsor} size="sm">
          Sponsor for {SPONSORSHIP_CONFIG.COST_HIVE} HIVE
        </Button>
      )}
      {status === "error" && (
        <Button colorScheme="green" onClick={handleSponsor} size="sm">
          Try Again
        </Button>
      )}
    </HStack>
  );

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`SPONSOR: @${liteUserHandle}`}
      closeOnOverlayClick={!isProcessing}
      size="lg"
      footer={footer}
    >
      <Box p={6} bg="background">
        <VStack spacing={4} align="stretch">
          {/* User info */}
          <Box
            p={4}
            borderRadius="base"
            borderWidth={1}
            borderColor="primary"
            bg="panel"
          >
            <Text fontWeight="bold" fontSize="lg" mb={2} color="primary">
              {liteUserDisplayName}
            </Text>
            <Text fontSize="sm" color="dim">
              Will become: <Code bg="background" color="primary">@{liteUserHandle}</Code>
            </Text>
          </Box>

          {/* Cost info */}
          <Box>
            <HStack justify="space-between" mb={2}>
              <Text fontWeight="semibold" color="primary">Sponsorship Cost:</Text>
              <Text fontWeight="bold" color="green.500">
                {SPONSORSHIP_CONFIG.COST_HIVE} HIVE
              </Text>
            </HStack>
            <Text fontSize="sm" color="dim">
              This will create a new Hive account and email the keys to the user.
            </Text>
          </Box>

          {/* Status */}
          {isProcessing && (
            <Box>
              <Text fontSize="sm" fontWeight="semibold" mb={2} color="primary">
                {getStatusText()}
              </Text>
              <Progress
                size="sm"
                isIndeterminate
                colorScheme="green"
                borderRadius="base"
              />
            </Box>
          )}

          {/* Success message */}
          {status === "success" && (
            <Alert status="success" borderRadius="base">
              <AlertIcon />
              <Box>
                <AlertTitle>Sponsorship Successful! 🎉</AlertTitle>
                <AlertDescription fontSize="sm">
                  @{liteUserHandle} now has a Hive account! They'll receive an email
                  with their keys and can start earning rewards.
                </AlertDescription>
              </Box>
            </Alert>
          )}

          {/* Error message */}
          {status === "error" && error && (
            <Alert status="error" borderRadius="base">
              <AlertIcon />
              <Box>
                <AlertTitle>Sponsorship Failed</AlertTitle>
                <AlertDescription fontSize="sm">{error}</AlertDescription>
              </Box>
            </Alert>
          )}

          {/* What happens next */}
          {status === "idle" && (
            <Box
              p={3}
              borderRadius="base"
              bg="panel"
              borderWidth={1}
              borderColor="border"
            >
              <Text fontWeight="semibold" fontSize="sm" mb={2} color="primary">
                What happens next:
              </Text>
              <VStack align="start" spacing={1} fontSize="sm" color="dim">
                <Text>✅ Hive account created on blockchain</Text>
                <Text>✅ Posting key encrypted and stored securely</Text>
                <Text>✅ All keys emailed to user</Text>
                <Text>✅ User can post and earn rewards immediately</Text>
              </VStack>
            </Box>
          )}
        </VStack>
      </Box>
    </SkateModal>
  );
}
