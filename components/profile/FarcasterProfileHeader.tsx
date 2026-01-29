"use client";
import React, { memo } from "react";
import { Box, Text } from "@chakra-ui/react";
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
}

const FarcasterProfileHeader = function FarcasterProfileHeader({
  profileData,
  username,
  farcasterProfile,
}: FarcasterProfileHeaderProps) {
  // Smart fallback: prefer Farcaster data, fallback to profileData
  const displayName = farcasterProfile?.displayName || farcasterProfile?.username || profileData.name || username;
  const avatarUrl = farcasterProfile?.pfpUrl || profileData.profileImage;
  const bio = farcasterProfile?.bio || profileData.about;
  const farcasterUsername = farcasterProfile?.username;
  const fid = farcasterProfile?.fid;

  // Stats row similar to Hive (if Farcaster has follower data in the future)
  const statsRow = fid && (
    <Box>
      <Text
        color="purple.300"
        fontSize="sm"
        textShadow="0 2px 4px rgba(0,0,0,0.9)"
        fontWeight="medium"
      >
        Farcaster ID: <Text as="span" fontWeight="bold" color="purple.400">{fid}</Text>
      </Text>
    </Box>
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
        />
      }
      stats={statsRow}
    />
  );
};

export default memo(FarcasterProfileHeader);
