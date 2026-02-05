"use client";
import React, { useEffect, useState, useCallback, memo } from "react";
import {
  Box,
  Text,
  Flex,
  Avatar,
  IconButton,
  Link,
  Button,
  VStack,
  Badge,
} from "@chakra-ui/react";
import { FaSignOutAlt, FaCog } from "react-icons/fa";
import { ProfileData } from "./ProfilePage";
import { useRouter } from "next/navigation";
import { useAioha } from "@aioha/react-ui";
import { checkFollow, changeFollow } from "@/lib/hive/client-functions";
import ZoraProfileCoinDisplay from "./ZoraProfileCoinDisplay";
import { ZoraProfileData } from "@/hooks/useZoraProfileCoin";
import { useTranslations } from "@/contexts/LocaleContext";
import HiveUpgradePromptModal from "@/components/shared/HiveUpgradePromptModal";
interface MobileProfileHeaderProps {
  profileData: ProfileData;
  username: string;
  isOwner: boolean;
  canEdit?: boolean;
  user: string | null;
  isFollowing: boolean | null;
  isFollowLoading: boolean;
  onFollowingChange: (following: boolean | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onEditModalOpen: () => void;
  showZoraProfile?: boolean;
  onToggleProfile?: (show: boolean) => void;
  cachedZoraData?: ZoraProfileData | null;
  zoraLoading?: boolean;
  zoraError?: string | null;
  /** If true, the viewer is a lite account without a Hive wallet connected */
  isLiteUser?: boolean;
}

const MobileProfileHeader = memo(function MobileProfileHeader({
  profileData,
  username,
  isOwner,
  canEdit,
  user,
  isFollowing,
  isFollowLoading,
  onFollowingChange,
  onLoadingChange,
  onEditModalOpen,
  showZoraProfile = false,
  onToggleProfile,
  cachedZoraData,
  zoraLoading = false,
  zoraError = null,
  isLiteUser = false,
}: MobileProfileHeaderProps) {
  const router = useRouter();
  const { aioha } = useAioha();
  const [followsBack, setFollowsBack] = useState<boolean>(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const t = useTranslations('profile');
  // Check if the viewed user follows the current user back
  useEffect(() => {
    if (!user || !username || user === username) return;

    const checkMutualFollow = async () => {
      try {
        const doesFollow = await checkFollow(username, user);
        setFollowsBack(doesFollow);
      } catch (error) {
        console.error("Error checking mutual follow:", error);
        setFollowsBack(false);
      }
    };

    checkMutualFollow();
  }, [user, username]);

  // Memoized follow handler
  const handleFollowToggle = useCallback(async () => {
    // If lite user without Hive wallet, show upgrade modal
    if (isLiteUser && !user) {
      setShowUpgradeModal(true);
      return;
    }

    if (!user || !username || user === username || isFollowLoading) return;

    const prev = isFollowing;
    const next = !isFollowing;

    // Optimistic update
    onFollowingChange(next);
    onLoadingChange(true);

    try {
      await changeFollow(user, username);
      // Keep optimistic state
      onLoadingChange(false);
    } catch (error) {
      console.error("Follow action failed:", error);
      // Revert on error
      onFollowingChange(prev);
      onLoadingChange(false);
    }
  }, [
    user,
    username,
    isFollowing,
    isFollowLoading,
    onFollowingChange,
    onLoadingChange,
    isLiteUser,
  ]);

  // Memoized logout handler
  const handleLogout = useCallback(async () => {
    try {
      await aioha.logout();
    } catch (error) {
      console.error("Error during logout:", error);
    }
  }, [aioha]);



  return (
    <Box display={{ base: "block", md: "none" }} position="relative" w="100%">
      {/* Farcaster-style Profile Section - Overlapping the banner */}
      <Box position="relative" p={4} mt={-12}>
        {/* Avatar positioned to overlap banner */}
        <Flex justify="space-between" align="flex-start" mb={3}>
          <Avatar
            src={profileData.profileImage}
            name={username}
            size="xl"
            border="4px solid"
            borderColor="white"
            bg="white"
            shadow="lg"
            loading="lazy"
            cursor={(canEdit ?? isOwner) ? "pointer" : "default"}
            _hover={(canEdit ?? isOwner) ? { opacity: 0.8 } : {}}
            transition="opacity 0.2s"
            onClick={(canEdit ?? isOwner) ? onEditModalOpen : undefined}
          />

          {/* Top-right settings (only for owner) */}
          {(canEdit ?? isOwner) && (
            <IconButton
              aria-label={t('settings')}
              icon={<FaCog />}
              variant="ghost"
              color="white"
              bg="blackAlpha.600"
              _hover={{ bg: "blackAlpha.800" }}
              size="sm"
              borderRadius="full"
              onClick={onEditModalOpen}
            />
          )}
        </Flex>{" "}
        {/* Profile Info Section */}
        <VStack align="flex-start" spacing={2} mb={4}>
          {/* Name and Username with Follow Button */}
          <VStack align="flex-start" spacing={0}>
            <Text fontSize="xl" fontWeight="bold" color="white">
              {profileData.name || username}
            </Text>
            <Flex align="center" gap={2}>
              <Text fontSize="sm" color="whiteAlpha.700">
                @{username}
              </Text>
              {/* Follows you badge */}
              {!isOwner && followsBack && (
                <Badge
                  bg="whiteAlpha.200"
                  color="whiteAlpha.800"
                  fontSize="xs"
                  px={2}
                  py={1}
                  borderRadius="none"
                >
                  Follows you
                </Badge>
              )}
              {/* Follow/Following Button */}
              {!isOwner && (user || isLiteUser) && (
                <Button
                  onClick={handleFollowToggle}
                  size="xs"
                  variant={isFollowing ? "outline" : "solid"}
                  colorScheme={isFollowing ? "whiteAlpha" : "primary"}
                  borderColor={isFollowing ? "whiteAlpha.400" : undefined}
                  bg={isFollowing ? "transparent" : undefined}
                  color={isFollowing ? "white" : undefined}
                  isLoading={isFollowLoading}
                  isDisabled={isFollowLoading}
                  fontWeight="bold"
                  px={3}
                  py={1}
                  borderRadius="none"
                  _hover={{
                    bg: isFollowing ? "whiteAlpha.200" : undefined,
                  }}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
              )}
            </Flex>
          </VStack>

          {/* Bio */}
          {profileData.about && (
            <Text fontSize="sm" color="whiteAlpha.900" lineHeight={1.4}>
              {profileData.about}
            </Text>
          )}

          {/* Location and Website */}
          <Flex
            wrap="wrap"
            gap={3}
            fontSize="xs"
            color="whiteAlpha.700"
            align="center"
          >
            {profileData.location && (
              <Flex align="center" gap={1}>
                <Text>📍</Text>
                <Text>{profileData.location}</Text>
              </Flex>
            )}
            {profileData.website && (
              <Flex align="center" gap={1}>
                <Text>🌐</Text>
                <Link
                  href={
                    profileData.website.startsWith("http")
                      ? profileData.website
                      : `https://${profileData.website}`
                  }
                  isExternal
                  color="primary"
                  _hover={{ textDecoration: "underline" }}
                  fontSize="xs"
                >
                  {profileData.website}
                </Link>
              </Flex>
            )}
          </Flex>

          {/* Stats Row - Farcaster Style with Zora Coin */}
          <Flex gap={4} fontSize="sm" wrap="wrap">
            <Flex align="center" gap={1}>
              <Text fontWeight="bold" color="white">
                {profileData.following}
              </Text>
              <Text color="whiteAlpha.700">Following</Text>
            </Flex>
            <Flex align="center" gap={1}>
              <Text fontWeight="bold" color="white">
                {profileData.followers}
              </Text>
              <Text color="whiteAlpha.700">Followers</Text>
            </Flex>
            {profileData.vp_percent && (
              <Flex align="center" gap={1}>
                <Text fontWeight="bold" color="white">
                  {Math.round(parseFloat(profileData.vp_percent || "0"))}%
                </Text>
                <Text color="whiteAlpha.700">VP</Text>
              </Flex>
            )}
            {/* Zora Profile Coin Display integrated into stats */}
            <Box>
              <ZoraProfileCoinDisplay
                walletAddress={profileData.ethereum_address}
                size="xs"
                cachedProfileData={cachedZoraData}
                cachedLoading={zoraLoading}
                cachedError={zoraError}
              />
            </Box>
          </Flex>
        </VStack>
        {/* Action Buttons - Only for Owners */}
        {isOwner && (
          <Flex gap={2} justify="flex-end">
            <Button
              aria-label="Logout"
              leftIcon={<FaSignOutAlt />}
              size="sm"
              variant="solid"
              colorScheme="red"
              onClick={handleLogout}
            >
              logout
            </Button>
          </Flex>
        )}
      </Box>

      {/* Hive Upgrade Prompt Modal for lite users */}
      <HiveUpgradePromptModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        action="follow"
      />
    </Box>
  );
});

export default MobileProfileHeader;
