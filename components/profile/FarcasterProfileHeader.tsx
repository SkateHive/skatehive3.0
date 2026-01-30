"use client";
import React, { memo } from "react";
import { HStack, Text } from "@chakra-ui/react";
import { ProfileData } from "./ProfilePage";
import ProfileHeaderWrapper from "./ProfileHeaderWrapper";
import IdentityBlock from "./IdentityBlock";

interface FarcasterProfileData {
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  custody?: string;
  verifications?: string[];
  followerCount?: number;
  followingCount?: number;
}

interface FarcasterProfileHeaderProps {
  profileData: ProfileData;
  username: string;
  farcasterProfile?: FarcasterProfileData | null;
  integrations?: React.ReactNode;
}

const FarcasterProfileHeader = function FarcasterProfileHeader({
  profileData,
  username,
  farcasterProfile,
  integrations,
}: FarcasterProfileHeaderProps) {
  // Smart fallback: prefer Farcaster data, fallback to profileData
  const displayName = farcasterProfile?.displayName || farcasterProfile?.username || profileData.name || username;
  const avatarUrl = farcasterProfile?.pfpUrl || profileData.profileImage;
  const bio = farcasterProfile?.bio || profileData.about;
  const farcasterUsername = farcasterProfile?.username;
  const fid = farcasterProfile?.fid;
  const followerCount = farcasterProfile?.followerCount;
  const followingCount = farcasterProfile?.followingCount;

  // Terminal-style stats row for Farcaster
  const statsRow = (followerCount !== undefined || followingCount !== undefined) && (
    <HStack spacing={6} fontSize="xs" fontFamily="mono">
      {followingCount !== undefined && (
        <Text color="text" whiteSpace="nowrap" textTransform="uppercase">
          <Text as="span" fontWeight="bold" color="primary">
            {followingCount}
          </Text>{" "}
          Following
        </Text>
      )}
      {followerCount !== undefined && (
        <Text color="text" whiteSpace="nowrap" textTransform="uppercase">
          <Text as="span" fontWeight="bold" color="primary">
            {followerCount}
          </Text>{" "}
          Followers
        </Text>
      )}
    </HStack>
  );

  return (
    <ProfileHeaderWrapper
      coverImage={profileData.coverImage}
      username={username}
      identity={
        <IdentityBlock
          avatar={avatarUrl}
          displayName={displayName}
          handle={farcasterUsername ? `@${farcasterUsername}` : `@${username}`}
          bio={bio}
          badges={
            fid
              ? [
                  {
                    label: "FID",
                    value: fid,
                    colorScheme: "purple",
                  },
                ]
              : undefined
          }
          externalLink={
            farcasterUsername
              ? {
                  url: `https://warpcast.com/${farcasterUsername}`,
                  label: `View ${farcasterUsername} on Warpcast`,
                }
              : undefined
          }
          statsRow={statsRow}
          integrations={integrations}
        />
      }
    />
  );
};

export default memo(FarcasterProfileHeader);
