"use client";

import React from "react";
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Icon,
  Badge,
} from "@chakra-ui/react";
import { FaHive, FaEthereum, FaArrowRight, FaCheck } from "react-icons/fa";
import { SiFarcaster } from "react-icons/si";
import SkateModal from "@/components/shared/SkateModal";

interface MergePreviewData {
  type: "hive" | "evm" | "farcaster";
  newIdentity: {
    handle?: string;
    address?: string;
    externalId?: string;
  };
  additionalIdentities?: Array<{
    type: string;
    handle?: string;
    address?: string;
    externalId?: string;
  }>;
  isMergeRequired?: boolean;
  existingUserHandle?: string;
}

interface MergePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  data: MergePreviewData | null;
  isLoading?: boolean;
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function MergePreviewModal({
  isOpen,
  onClose,
  onConfirm,
  data,
  isLoading = false,
}: MergePreviewModalProps) {
  if (!data) return null;

  const iconMap = {
    hive: FaHive,
    evm: FaEthereum,
    farcaster: SiFarcaster,
  };

  const colorMap = {
    hive: "red.400",
    evm: "blue.300",
    farcaster: "purple.400",
  };

  const typeLabels = {
    hive: "Hive Account",
    evm: "Ethereum Wallet",
    farcaster: "Farcaster Profile",
  };

  const getIdentityLabel = (identity: MergePreviewData["newIdentity"]) => {
    if (identity.handle) return `@${identity.handle}`;
    if (identity.address) return shortenAddress(identity.address);
    if (identity.externalId) return `FID: ${identity.externalId}`;
    return "Unknown";
  };

  const routeDestination = data.type === "hive"
    ? "Hive Profile"
    : data.type === "evm"
      ? "Zora Profile"
      : "Farcaster Profile";

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title={data.isMergeRequired ? "merge accounts" : "link account"}
      isCentered
    >
      <Box p={4}>
        <VStack spacing={4} align="stretch">
          {/* Warning if merge required */}
          {data.isMergeRequired && (
            <Box
              p={3}
              bg="rgba(113, 63, 18, 0.2)"
              border="1px solid"
              borderColor="yellow.600"
              borderRadius="sm"
            >
              <Text fontFamily="mono" fontSize="xs" color="yellow.300">
                ⚠️ This account is already linked to user &quot;{data.existingUserHandle}&quot;.
                Confirming will merge the accounts together.
              </Text>
            </Box>
          )}

          {/* Main identity being linked */}
          <VStack spacing={2} align="stretch">
            <Text fontFamily="mono" fontSize="xs" color="gray.400" textTransform="uppercase">
              New Identity
            </Text>
            <HStack
              p={3}
              bg="whiteAlpha.100"
              borderRadius="sm"
              border="1px solid"
              borderColor={colorMap[data.type]}
            >
              <Icon as={iconMap[data.type]} boxSize={5} color={colorMap[data.type]} />
              <VStack align="start" spacing={0} flex={1}>
                <Text fontFamily="mono" fontSize="sm" color="text" fontWeight="bold">
                  {getIdentityLabel(data.newIdentity)}
                </Text>
                <Text fontFamily="mono" fontSize="xs" color="gray.500">
                  {typeLabels[data.type]}
                </Text>
              </VStack>
              <Badge bg="primary" color="background" fontFamily="mono" fontSize="2xs">
                primary
              </Badge>
            </HStack>
          </VStack>

          {/* Additional identities that will be linked */}
          {data.additionalIdentities && data.additionalIdentities.length > 0 && (
            <VStack spacing={2} align="stretch">
              <Text fontFamily="mono" fontSize="xs" color="gray.400" textTransform="uppercase">
                Additional Identities ({data.additionalIdentities.length})
              </Text>
              {data.additionalIdentities.map((identity, idx) => {
                const identityType = identity.type as "hive" | "evm" | "farcaster";
                return (
                  <HStack
                    key={idx}
                    p={2}
                    bg="whiteAlpha.50"
                    borderRadius="sm"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                  >
                    <Icon as={iconMap[identityType]} boxSize={4} color={colorMap[identityType]} />
                    <Text fontFamily="mono" fontSize="xs" color="text" flex={1}>
                      {getIdentityLabel(identity)}
                    </Text>
                    <Icon as={FaCheck} boxSize={3} color="green.400" />
                  </HStack>
                );
              })}
            </VStack>
          )}

          {/* Route destination */}
          <Box
            p={3}
            bg="rgba(26, 54, 93, 0.1)"
            border="1px solid"
            borderColor="blue.700"
            borderRadius="sm"
          >
            <HStack spacing={2} justify="center">
              <Text fontFamily="mono" fontSize="xs" color="blue.300">
                After linking, you&apos;ll be taken to your
              </Text>
              <HStack spacing={1}>
                <Icon as={FaArrowRight} boxSize={3} color="blue.400" />
                <Text fontFamily="mono" fontSize="xs" color="blue.400" fontWeight="bold">
                  {routeDestination}
                </Text>
              </HStack>
            </HStack>
          </Box>

          {/* Actions */}
          <HStack spacing={2} pt={2}>
            <Button
              flex={1}
              size="sm"
              variant="ghost"
              fontFamily="mono"
              fontSize="xs"
              color="gray.500"
              onClick={onClose}
              isDisabled={isLoading}
              _hover={{ color: "text" }}
            >
              cancel
            </Button>
            <Button
              flex={1}
              size="sm"
              bg="primary"
              color="background"
              fontFamily="mono"
              fontSize="xs"
              onClick={onConfirm}
              isLoading={isLoading}
              _hover={{ opacity: 0.9 }}
            >
              {data.isMergeRequired ? "merge accounts" : "link account"}
            </Button>
          </HStack>
        </VStack>
      </Box>
    </SkateModal>
  );
}
