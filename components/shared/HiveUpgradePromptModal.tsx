"use client";
import React from "react";
import {
  VStack,
  Text,
  Button,
  HStack,
  Icon,
  Box,
  List,
  ListItem,
  ListIcon,
} from "@chakra-ui/react";
import { FaHive, FaUserFriends, FaEdit, FaTrash, FaWallet, FaGift } from "react-icons/fa";
import { CheckCircleIcon } from "@chakra-ui/icons";
import SkateModal from "@/components/shared/SkateModal";
import { useRouter } from "next/navigation";

export type UpgradeAction = "follow" | "edit" | "delete" | "wallet" | "general";

interface HiveUpgradePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  action: UpgradeAction;
}

const actionConfig = {
  follow: {
    icon: FaUserFriends,
    title: "Follow Users",
    description: "Following accounts requires a Hive blockchain account.",
  },
  edit: {
    icon: FaEdit,
    title: "Edit Posts",
    description: "Editing posts requires a Hive blockchain account.",
  },
  delete: {
    icon: FaTrash,
    title: "Delete Posts",
    description: "Deleting posts requires a Hive blockchain account.",
  },
  wallet: {
    icon: FaWallet,
    title: "Wallet Features",
    description: "Wallet operations require a Hive blockchain account.",
  },
  general: {
    icon: FaHive,
    title: "Hive Features",
    description: "This feature requires a Hive blockchain account.",
  },
};

export default function HiveUpgradePromptModal({
  isOpen,
  onClose,
  action,
}: HiveUpgradePromptModalProps) {
  const router = useRouter();
  const config = actionConfig[action];

  const handleFindSponsor = () => {
    // Navigate to the community page or Discord to find sponsors
    router.push("/dao");
    onClose();
  };

  const handleLearnMore = () => {
    window.open("https://docs.skatehive.app/docs/create-account", "_blank");
  };

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title="upgrade required"
      isCentered={true}
      size="md"
    >
      <Box p={6}>
        <VStack spacing={5} align="stretch">
          {/* Header with action icon */}
          <HStack spacing={3} justify="center" py={2}>
            <Icon as={config.icon} boxSize={8} color="primary" />
            <Text fontFamily="mono" fontSize="lg" fontWeight="bold" color="text">
              {config.title}
            </Text>
          </HStack>

          {/* Description */}
          <Text fontFamily="mono" fontSize="sm" color="gray.400" textAlign="center">
            {config.description}
          </Text>

          {/* Explanation box */}
          <Box
            bg="whiteAlpha.50"
            border="1px solid"
            borderColor="border"
            borderRadius="sm"
            p={4}
          >
            <VStack spacing={3} align="stretch">
              <Text fontFamily="mono" fontSize="xs" color="primary" fontWeight="bold">
                What is a Hive account?
              </Text>
              <Text fontFamily="mono" fontSize="xs" color="gray.400">
                A Hive account gives you full access to the Skatehive ecosystem with
                blockchain-powered features like earning rewards, managing your wallet,
                and owning your content.
              </Text>
            </VStack>
          </Box>

          {/* Benefits list */}
          <Box>
            <Text fontFamily="mono" fontSize="xs" color="gray.500" mb={2}>
              With a Hive account you can:
            </Text>
            <List spacing={1}>
              <ListItem fontFamily="mono" fontSize="xs" color="gray.400">
                <ListIcon as={CheckCircleIcon} color="primary" boxSize={3} />
                Follow and unfollow other skaters
              </ListItem>
              <ListItem fontFamily="mono" fontSize="xs" color="gray.400">
                <ListIcon as={CheckCircleIcon} color="primary" boxSize={3} />
                Edit and delete your posts
              </ListItem>
              <ListItem fontFamily="mono" fontSize="xs" color="gray.400">
                <ListIcon as={CheckCircleIcon} color="primary" boxSize={3} />
                Send and receive HIVE and HBD
              </ListItem>
              <ListItem fontFamily="mono" fontSize="xs" color="gray.400">
                <ListIcon as={CheckCircleIcon} color="primary" boxSize={3} />
                Earn rewards from your content
              </ListItem>
              <ListItem fontFamily="mono" fontSize="xs" color="gray.400">
                <ListIcon as={CheckCircleIcon} color="primary" boxSize={3} />
                Vote for witnesses and DAO proposals
              </ListItem>
            </List>
          </Box>

          {/* How to upgrade */}
          <Box
            bg="rgba(0, 255, 0, 0.05)"
            border="1px solid"
            borderColor="primary"
            borderRadius="sm"
            p={4}
          >
            <VStack spacing={2} align="stretch">
              <HStack>
                <Icon as={FaGift} boxSize={4} color="primary" />
                <Text fontFamily="mono" fontSize="xs" color="primary" fontWeight="bold">
                  Get sponsored by an OG user
                </Text>
              </HStack>
              <Text fontFamily="mono" fontSize="xs" color="gray.400">
                OG Skatehive members can sponsor your account creation. Visit the DAO
                page or ask in the community chat to find a sponsor.
              </Text>
            </VStack>
          </Box>

          {/* Action buttons */}
          <VStack spacing={2} pt={2}>
            <Button
              onClick={handleFindSponsor}
              colorScheme="green"
              size="sm"
              fontFamily="mono"
              w="full"
              leftIcon={<Icon as={FaGift} />}
            >
              Find a Sponsor
            </Button>
            <Button
              onClick={handleLearnMore}
              variant="ghost"
              size="xs"
              fontFamily="mono"
              color="gray.500"
              _hover={{ color: "primary" }}
            >
              Learn more about Hive accounts
            </Button>
          </VStack>
        </VStack>
      </Box>
    </SkateModal>
  );
}
