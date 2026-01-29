"use client";
import React, { memo, useState, useEffect } from "react";
import {
  Box,
  Text,
  Flex,
  Avatar,
  IconButton,
  VStack,
  HStack,
  Tooltip,
} from "@chakra-ui/react";
import { FaEdit } from "react-icons/fa";
import FollowButton from "./FollowButton";
import PowerBars from "./PowerBars";
import { ProfileData } from "./ProfilePage";

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
      img.onerror = () => setAvatarLoaded(true); // Still set to true to prevent infinite loading
      img.src = profileData.profileImage;
    }
  }, [profileData.profileImage, avatarLoaded]);
  return (
    <Flex
      direction="row"
      align="center"
      justify="space-between"
      w="100%"
      gap={6}
      minH="100px"
    >
      {/* Left Section: Avatar + Basic Info */}
      <Flex
        direction="row"
        align="flex-start"
        gap={4}
        flexBasis="60%"
        maxW="60%"
      >
        <Avatar
          src={profileData.profileImage}
          name={username}
          borderRadius="lg"
          boxSize="100px"
          border="2px solid"
          borderColor="primary"
        />

        <VStack align="flex-start" spacing={0} flex="1">
          <HStack>
            <Text
              fontSize="sm"
              color="gray.400"
              fontWeight="medium"
              isTruncated
              w="100%"
            >
              {profileData.about ? (
                <Tooltip
                  label={profileData.about}
                  placement="top"
                  bg="gray.800"
                  color="white"
                  fontSize="sm"
                  borderRadius="none"
                  px={3}
                  py={2}
                  maxW="300px"
                  textAlign="center"
                >
                  <Text as="span" cursor="help" _hover={{ color: "primary" }}>
                    @{username}
                  </Text>
                </Tooltip>
              ) : (
                <>@{username}</>
              )}
            </Text>
            {(canEdit ?? isOwner) && (
              <IconButton
                aria-label="Edit Profile"
                icon={<FaEdit />}
                size="md"
                variant="ghost"
                colorScheme="primary"
                onClick={onEditModalOpen}
              />
            )}
          </HStack>

          {/* Compact Stats */}
          <HStack spacing={3} fontSize="sm">
            <Text color="text" whiteSpace="nowrap">
              <Text as="span" fontWeight="bold" color="primary">
                {profileData.following}
              </Text>{" "}
              Following
            </Text>
            <Text color="text" whiteSpace="nowrap">
              <Text as="span" fontWeight="bold" color="primary">
                {profileData.followers}
              </Text>{" "}
              Followers
            </Text>
          </HStack>

          {/* Vote Power Bar - Left Aligned */}
          {profileData.vp_percent && profileData.rc_percent && (
            <Box w="100%" mt={2}>
              <PowerBars
                vpPercent={profileData.vp_percent}
                rcPercent={profileData.rc_percent}
                username={username}
                height={250}
                width={18}
              />
            </Box>
          )}
        </VStack>
      </Flex>

      {/* Right Section: Actions + Market Cap */}
      <VStack align="flex-end" spacing={3} flexBasis="40%" maxW="40%">
        {/* Action Buttons */}
        <HStack spacing={2}>
          {!isOwner && user && (
            <FollowButton
              user={user}
              username={username}
              isFollowing={isFollowing}
              isFollowLoading={isFollowLoading}
              onFollowingChange={onFollowingChange}
              onLoadingChange={onLoadingChange}
            />
          )}
        </HStack>
      </VStack>
    </Flex>
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
