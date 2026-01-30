"use client";
import React, { memo, useState, useEffect } from "react";
import { IconButton, HStack, VStack, Text, Box, Flex } from "@chakra-ui/react";
import { FaEdit } from "react-icons/fa";
import FollowButton from "./FollowButton";
import { ProfileData } from "./ProfilePage";
import ProfileHeaderWrapper from "./ProfileHeaderWrapper";
import IdentityBlock from "./IdentityBlock";
import useHivePower from "@/hooks/useHivePower";

interface HiveProfileHeaderProps {
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
  integrations?: React.ReactNode;
}

const HiveProfileHeader = function HiveProfileHeader({
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
  integrations,
}: HiveProfileHeaderProps) {
  // Fetch voting power value in dollars
  const [voteValue, setVoteValue] = useState<number | null>(null);
  const { estimateVoteValue, isLoading: isHivePowerLoading } = useHivePower(username || "");

  useEffect(() => {
    if (username && estimateVoteValue && !isHivePowerLoading) {
      estimateVoteValue(100)
        .then((value) => setVoteValue(value))
        .catch(() => setVoteValue(null));
    }
  }, [username, estimateVoteValue, isHivePowerLoading]);

  // Parse VP percentage safely
  const parsePercentage = (percentStr: string | number | undefined): number => {
    if (typeof percentStr === 'number') return percentStr;
    const cleaned = String(percentStr || "0").replace("%", "");
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.min(100, Math.max(0, parsed));
  };

  const vpValue = parsePercentage(profileData.vp_percent);

  // Stats row: Single horizontal line with followers + voting power bar + dollar value
  const statsRow = (
    <HStack spacing={6} fontSize="xs" fontFamily="mono" flexWrap="wrap" align="center">
      {/* Follower counts */}
      <Text color="text" whiteSpace="nowrap" textTransform="uppercase">
        <Text as="span" fontWeight="bold" color="primary">
          {profileData.following}
        </Text>{" "}
        Following
      </Text>
      <Text color="text" whiteSpace="nowrap" textTransform="uppercase">
        <Text as="span" fontWeight="bold" color="primary">
          {profileData.followers}
        </Text>{" "}
        Followers
      </Text>

      {/* Voting Power bar */}
      {profileData.vp_percent && (
        <>
          <HStack spacing={1} align="center">
            <Text color="dim">[</Text>
            <Text color="success" letterSpacing="tight">
              {'█'.repeat(Math.floor((vpValue / 100) * 20))}
              {'░'.repeat(20 - Math.floor((vpValue / 100) * 20))}
            </Text>
            <Text color="dim">]</Text>
          </HStack>
          {voteValue !== null && (
            <Text color="warning" fontWeight="bold" whiteSpace="nowrap">
              ${voteValue.toFixed(3)}
            </Text>
          )}
        </>
      )}
    </HStack>
  );

  // Edit icon button next to username
  const editIcon = (canEdit ?? isOwner) ? (
    <IconButton
      aria-label="Edit Profile"
      icon={<FaEdit />}
      size="xs"
      variant="ghost"
      color="text"
      onClick={onEditModalOpen}
      borderRadius="none"
      opacity={0.7}
      _hover={{ opacity: 1, color: "primary" }}
      transition="all 0.2s"
    />
  ) : null;

  // Follow button at bottom-left (for non-owners)
  const followAction = !isOwner && user ? (
    <FollowButton
      user={user}
      username={username}
      isFollowing={isFollowing}
      isFollowLoading={isFollowLoading}
      onFollowingChange={onFollowingChange}
      onLoadingChange={onLoadingChange}
    />
  ) : null;

  return (
    <Box position="relative" pb={followAction ? 12 : 0}>
      {/* Profile Header */}
      <ProfileHeaderWrapper
        coverImage={profileData.coverImage}
        username={username}
        identity={
          <IdentityBlock
            avatar={profileData.profileImage}
            displayName={profileData.name || username}
            handle={`@${username}`}
            bio={profileData.about}
            statsRow={statsRow}
            integrations={integrations}
            editButton={editIcon}
          />
        }
      />

      {/* Follow Button - Bottom-left outside terminal box (only for non-owners) */}
      {followAction && (
        <Box
          position="absolute"
          bottom={0}
          left={0}
        >
          {followAction}
        </Box>
      )}
    </Box>
  );
};

export default memo(HiveProfileHeader, (prevProps, nextProps) => {
  return (
    prevProps.username === nextProps.username &&
    prevProps.profileData === nextProps.profileData &&
    prevProps.isOwner === nextProps.isOwner &&
    prevProps.user === nextProps.user &&
    prevProps.isFollowing === nextProps.isFollowing &&
    prevProps.isFollowLoading === nextProps.isFollowLoading
  );
});
