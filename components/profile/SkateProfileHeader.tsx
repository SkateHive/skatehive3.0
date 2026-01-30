"use client";
import React, { memo } from "react";
import { IconButton, HStack, Text, Box } from "@chakra-ui/react";
import { FaEdit, FaMapMarkerAlt } from "react-icons/fa";
import { ProfileData } from "./ProfilePage";
import ProfileHeaderWrapper from "./ProfileHeaderWrapper";
import IdentityBlock from "./IdentityBlock";

interface SkateProfileHeaderProps {
  profileData: ProfileData;
  username: string;
  isOwner: boolean;
  onEditModalOpen: () => void;
  integrations?: React.ReactNode;
}

const SkateProfileHeader = function SkateProfileHeader({
  profileData,
  username,
  isOwner,
  onEditModalOpen,
  integrations,
}: SkateProfileHeaderProps) {
  // Stats row: Terminal-style location display
  const statsRow = profileData.location && (
    <HStack spacing={2} fontSize="xs" fontFamily="mono">
      <FaMapMarkerAlt color="var(--chakra-colors-primary)" />
      <Text
        color="text"
        whiteSpace="nowrap"
        textTransform="uppercase"
      >
        {profileData.location}
      </Text>
    </HStack>
  );

  // Edit icon button next to username
  const editIcon = isOwner ? (
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

  return (
    <Box position="relative">
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
    </Box>
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
