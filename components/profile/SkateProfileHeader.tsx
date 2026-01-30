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

  // Primary actions: Terminal-style Edit button
  const primaryActions = isOwner && (
    <IconButton
      aria-label="Edit Profile"
      icon={<FaEdit />}
      size="sm"
      variant="solid"
      colorScheme="primary"
      onClick={onEditModalOpen}
      borderRadius="none"
      fontFamily="mono"
      boxShadow="0 0 5px rgba(168, 255, 96, 0.3)"
      _hover={{
        boxShadow: "0 0 10px rgba(168, 255, 96, 0.5)",
      }}
    />
  );

  return (
    <Box position="relative" pb={12}>
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
          />
        }
      />

      {/* Edit Button - Bottom-left outside terminal box */}
      {primaryActions && (
        <Box
          position="absolute"
          bottom={0}
          left={0}
        >
          {primaryActions}
        </Box>
      )}
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
