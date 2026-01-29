"use client";
import React, { memo, useState, useEffect } from "react";
import { IconButton, Box, Text } from "@chakra-ui/react";
import { FaEdit } from "react-icons/fa";
import { ProfileData } from "./ProfilePage";
import ProfileHeaderWrapper from "./ProfileHeaderWrapper";
import IdentityBlock from "./IdentityBlock";
import ActionsCluster from "./ActionsCluster";

interface SkateProfileHeaderProps {
  profileData: ProfileData;
  username: string;
  isOwner: boolean;
  onEditModalOpen: () => void;
}

const SkateProfileHeader = function SkateProfileHeader({
  profileData,
  username,
  isOwner,
  onEditModalOpen,
}: SkateProfileHeaderProps) {
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

  // Stats row for location (positioned like other profile stats)
  const statsRow = profileData.location && (
    <Box>
      <Text
        color="whiteAlpha.900"
        fontSize="sm"
        textShadow="0 2px 4px rgba(0,0,0,0.9)"
        fontWeight="medium"
      >
        📍 {profileData.location}
      </Text>
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
        isOwner ? (
          <ActionsCluster
            primaryActions={[
              <IconButton
                key="edit"
                aria-label="Edit Profile"
                icon={<FaEdit />}
                size="md"
                variant="solid"
                colorScheme="primary"
                onClick={onEditModalOpen}
                boxShadow="0 2px 8px rgba(0,0,0,0.3)"
              />,
            ]}
          />
        ) : undefined
      }
      stats={statsRow}
    />
  );
};

export default memo(SkateProfileHeader, (prevProps, nextProps) => {
  return (
    prevProps.username === nextProps.username &&
    prevProps.profileData === nextProps.profileData &&
    prevProps.isOwner === nextProps.isOwner &&
    prevProps.onEditModalOpen === nextProps.onEditModalOpen
  );
});
