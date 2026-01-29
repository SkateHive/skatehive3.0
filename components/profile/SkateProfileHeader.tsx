"use client";
import React, { memo } from "react";
import { IconButton, Box, Text, HStack } from "@chakra-ui/react";
import { FaEdit, FaMapMarkerAlt } from "react-icons/fa";
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
  // Stats row styled like Hive/Zora for consistency
  const statsRow = profileData.location && (
    <Box>
      <HStack spacing={2} fontSize="sm">
        <FaMapMarkerAlt color="var(--chakra-colors-primary-400)" />
        <Text
          color="white"
          whiteSpace="nowrap"
          textShadow="0 2px 4px rgba(0,0,0,0.9)"
          fontWeight="medium"
        >
          {profileData.location}
        </Text>
      </HStack>
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
