"use client";
import React, { memo } from "react";
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
  const displayName = farcasterProfile?.displayName || farcasterProfile?.username || profileData.name || username;
  const avatarUrl = farcasterProfile?.pfpUrl || profileData.profileImage;
  const bio = farcasterProfile?.bio || profileData.about;
  const farcasterUsername = farcasterProfile?.username;
  const fid = farcasterProfile?.fid;

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
    />
  );
};

export default memo(FarcasterProfileHeader);
