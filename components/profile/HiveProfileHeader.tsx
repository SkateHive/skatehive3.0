"use client";
import React, { memo, useState, useEffect } from "react";
import { IconButton, HStack, Text, Box } from "@chakra-ui/react";
import { FaEdit } from "react-icons/fa";
import FollowButton from "./FollowButton";
import PowerBars from "./PowerBars";
import { ProfileData } from "./ProfilePage";
import ProfileHeaderWrapper from "./ProfileHeaderWrapper";
import IdentityBlock from "./IdentityBlock";
import ActionsCluster from "./ActionsCluster";

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
}: HiveProfileHeaderProps) {
  const [avatarLoaded, setAvatarLoaded] = useState(false);

  // Preload avatar image to prevent flickering
  useEffect(() => {
    if (profileData.profileImage && !avatarLoaded) {
      const img = new Image();
      img.onload = () => setAvatarLoaded(true);
      img.onerror = () => setAvatarLoaded(true);
      img.src = profileData.profileImage;
    }
  }, [profileData.profileImage, avatarLoaded]);

  // Stats row for follower counts and power bars
  const statsRow = (
    <Box>
      <HStack spacing={6} fontSize="sm" mb={3}>
        <Text color="white" whiteSpace="nowrap" textShadow="0 2px 4px rgba(0,0,0,0.9)">
          <Text as="span" fontWeight="bold" color="primary" fontSize="lg">
            {profileData.following}
          </Text>{" "}
          Following
        </Text>
        <Text color="white" whiteSpace="nowrap" textShadow="0 2px 4px rgba(0,0,0,0.9)">
          <Text as="span" fontWeight="bold" color="primary" fontSize="lg">
            {profileData.followers}
          </Text>{" "}
          Followers
        </Text>
      </HStack>

      {profileData.vp_percent && profileData.rc_percent && (
        <PowerBars
          vpPercent={profileData.vp_percent}
          rcPercent={profileData.rc_percent}
          username={username}
          height={200}
          width={12}
        />
      )}
    </Box>
  );

  return (
    <ProfileHeaderWrapper
      coverImage={profileData.coverImage}
      username={username}
      identity={
        <IdentityBlock
          avatar={profileData.profileImage}
          displayName={profileData.name || username}
          handle={`@${username}`}
          bio={profileData.about}
        />
      }
      actions={
        <ActionsCluster
          primaryActions={[
            (canEdit ?? isOwner) && (
              <IconButton
                key="edit"
                aria-label="Edit Profile"
                icon={<FaEdit />}
                size="md"
                variant="solid"
                colorScheme="primary"
                onClick={onEditModalOpen}
                boxShadow="0 2px 8px rgba(0,0,0,0.3)"
              />
            ),
            !isOwner && user && (
              <FollowButton
                key="follow"
                user={user}
                username={username}
                isFollowing={isFollowing}
                isFollowLoading={isFollowLoading}
                onFollowingChange={onFollowingChange}
                onLoadingChange={onLoadingChange}
              />
            ),
          ].filter(Boolean)}
        />
      }
      stats={statsRow}
    />
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
