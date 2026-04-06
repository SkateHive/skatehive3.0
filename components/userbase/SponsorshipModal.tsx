"use client";

import { useState, useEffect } from "react";
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
  Badge,
  Spinner,
  useToast,
} from "@chakra-ui/react";
import SkateModal from "@/components/shared/SkateModal";
import { generateHiveKeys } from "@/lib/hive/keyGeneration";
import {
  buildAccountCreateOperation,
  buildCreateClaimedAccountOperation,
  getSponsorClaimedAccounts,
} from "@/lib/hive/accountCreation";
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

type SponsorMethod = "acc" | "hive";

declare global {
  interface Window {
    hive_keychain?: any;
  }
}

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
  const [method, setMethod] = useState<SponsorMethod>("acc");
  const [claimedAccounts, setClaimedAccounts] = useState<number | null>(null);
  const [loadingAcc, setLoadingAcc] = useState(false);
  const toast = useToast();

  // Check how many ACC tokens the sponsor has when the modal opens
  useEffect(() => {
    if (!isOpen || !sponsorHiveUsername) return;
    setLoadingAcc(true);
    getSponsorClaimedAccounts(sponsorHiveUsername).then((count) => {
      setClaimedAccounts(count);
      // Default to HIVE if they have no ACC tokens
      setMethod(count > 0 ? "acc" : "hive");
      setLoadingAcc(false);
    });
  }, [isOpen, sponsorHiveUsername]);

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
          cost_type: method === "acc" ? "account_token" : "hive_transfer",
          cost_amount: method === "acc" ? 0 : SPONSORSHIP_CONFIG.COST_HIVE,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Failed to create sponsorship");
      }

      const createData = await createResponse.json();
      setSponsorshipId(createData.sponsorship_id);

      // Step 3: Build the operation for the chosen method
      const operation =
        method === "acc"
          ? buildCreateClaimedAccountOperation(sponsorHiveUsername, liteUserHandle, keys)
          : buildAccountCreateOperation(
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

              setStatus("success");

              toast({
                title: "Sponsorship Successful! 🎉",
                description: `@${liteUserHandle} now has a Hive account and will receive all keys via email.`,
                status: "success",
                duration: 8000,
                isClosable: true,
              });

              setTimeout(() => onClose(), 2000);
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
      {(status === "idle" || status === "error") && (
        <Button colorScheme="green" onClick={handleSponsor} size="sm">
          {method === "acc"
            ? "Sponsor for Free (ACC)"
            : `Sponsor for ${SPONSORSHIP_CONFIG.COST_HIVE} HIVE`}
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
              Will become:{" "}
              <Code bg="background" color="primary">
                @{liteUserHandle}
              </Code>
            </Text>
          </Box>

          {/* Method selection */}
          {status === "idle" && (
            <Box>
              <Text fontWeight="semibold" fontSize="sm" mb={2} color="primary">
                Creation Method:
              </Text>
              {loadingAcc ? (
                <HStack spacing={2}>
                  <Spinner size="xs" color="green.400" />
                  <Text fontSize="sm" color="dim">Checking your ACC tokens...</Text>
                </HStack>
              ) : (
                <VStack spacing={2} align="stretch">
                  {/* ACC option */}
                  <Box
                    p={3}
                    borderRadius="base"
                    borderWidth={2}
                    borderColor={method === "acc" ? "green.400" : "border"}
                    bg={method === "acc" ? "panel" : "background"}
                    cursor={claimedAccounts && claimedAccounts > 0 ? "pointer" : "not-allowed"}
                    opacity={claimedAccounts && claimedAccounts > 0 ? 1 : 0.45}
                    onClick={() => {
                      if (claimedAccounts && claimedAccounts > 0) setMethod("acc");
                    }}
                  >
                    <HStack justify="space-between">
                      <VStack align="start" spacing={0}>
                        <HStack spacing={2}>
                          <Text fontWeight="bold" fontSize="sm" color="primary">
                            Use ACC Token
                          </Text>
                          <Badge colorScheme="green" fontSize="xs">FREE</Badge>
                        </HStack>
                        <Text fontSize="xs" color="dim">
                          Spends one of your claimed account tokens
                        </Text>
                      </VStack>
                      <Text
                        fontSize="sm"
                        fontWeight="bold"
                        color={claimedAccounts && claimedAccounts > 0 ? "green.400" : "red.400"}
                      >
                        {claimedAccounts !== null
                          ? `${claimedAccounts} available`
                          : "—"}
                      </Text>
                    </HStack>
                  </Box>

                  {/* HIVE payment option */}
                  <Box
                    p={3}
                    borderRadius="base"
                    borderWidth={2}
                    borderColor={method === "hive" ? "green.400" : "border"}
                    bg={method === "hive" ? "panel" : "background"}
                    cursor="pointer"
                    onClick={() => setMethod("hive")}
                  >
                    <HStack justify="space-between">
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="bold" fontSize="sm" color="primary">
                          Pay with HIVE
                        </Text>
                        <Text fontSize="xs" color="dim">
                          Deducted from your wallet via Keychain
                        </Text>
                      </VStack>
                      <Text fontSize="sm" fontWeight="bold" color="yellow.400">
                        {SPONSORSHIP_CONFIG.COST_HIVE} HIVE
                      </Text>
                    </HStack>
                  </Box>
                </VStack>
              )}
            </Box>
          )}

          {/* Processing indicator */}
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

          {/* Success */}
          {status === "success" && (
            <Alert status="success" borderRadius="base">
              <AlertIcon />
              <Box>
                <AlertTitle>Sponsorship Successful! 🎉</AlertTitle>
                <AlertDescription fontSize="sm">
                  @{liteUserHandle} now has a Hive account! An email with all
                  keys has been sent and they can start earning rewards.
                </AlertDescription>
              </Box>
            </Alert>
          )}

          {/* Error */}
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
