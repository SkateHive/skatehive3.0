"use client";
import React, { memo, useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Box, HStack, Image, Tooltip } from "@chakra-ui/react";
import MobileProfileHeader from "./MobileProfileHeader";
import HiveProfileHeader from "./HiveProfileHeader";
import ZoraProfileHeader from "./ZoraProfileHeader";
import SkateProfileHeader from "./SkateProfileHeader";
import FarcasterProfileHeader from "./FarcasterProfileHeader";
import { ProfileData } from "./ProfilePage";
import ProfileDebugControl from "./ProfileDebugControl";

interface UserbaseIdentity {
  id: string;
  type: string;
  handle: string | null;
  address: string | null;
  external_id: string | null;
  is_primary: boolean;
  verified_at: string | null;
}

interface FarcasterProfileData {
  fid?: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  bio?: string;
  custody?: string;
  verifications?: string[];
}

type ProfileView = "hive" | "zora" | "skate" | "farcaster";

interface ProfileHeaderProps {
  profileData: ProfileData;
  hiveProfileData?: ProfileData;
  skateProfileData?: ProfileData;
  username: string;
  isOwner: boolean;
  isUserbaseOwner?: boolean;
  user: string | null;
  isFollowing: boolean | null;
  isFollowLoading: boolean;
  onFollowingChange: (following: boolean | null) => void;
  onLoadingChange: (loading: boolean) => void;
  onEditModalOpen: () => void;
  onUserbaseEditModalOpen?: () => void;
  onActiveViewChange?: (view: ProfileView) => void;
  debugPayload?: Record<string, any> | null;
  // New props for identity awareness
  hasHiveProfile?: boolean;
  hasUserbaseProfile?: boolean;
  userbaseIdentities?: UserbaseIdentity[];
  farcasterProfile?: FarcasterProfileData | null;
}

const ProfileHeader = function ProfileHeader({
  profileData,
  hiveProfileData,
  skateProfileData,
  username,
  isOwner,
  isUserbaseOwner,
  user,
  isFollowing,
  isFollowLoading,
  onFollowingChange,
  onLoadingChange,
  onEditModalOpen,
  onUserbaseEditModalOpen,
  onActiveViewChange,
  debugPayload,
  hasHiveProfile = true,
  hasUserbaseProfile = false,
  userbaseIdentities = [],
  farcasterProfile = null,
}: ProfileHeaderProps) {
  const hiveHeaderData = hiveProfileData || profileData;
  const skateHeaderData = skateProfileData || profileData;

  // Determine available views and default view
  const hasZora = !!profileData.ethereum_address;
  const hasHive = hasHiveProfile;
  const hasSkate = hasUserbaseProfile;
  const hasFarcaster = !!farcasterProfile?.fid;

  // Calculate linked identities
  const hasHiveLinked = userbaseIdentities.some((i) => i.type === "hive");
  const hasEvmLinked = userbaseIdentities.some((i) => i.type === "evm");
  const hasFarcasterLinked = userbaseIdentities.some((i) => i.type === "farcaster");

  // Determine default view:
  // - If user has Hive profile (native or linked), prefer Hive
  // - If only Skate (userbase) profile, show Skate
  // - If only Zora/ETH, show Zora
  // - If only Farcaster, show Farcaster
  const defaultView = useMemo<ProfileView>(() => {
    if (hasHive) return "hive";
    if (hasSkate) return "skate";
    if (hasFarcaster) return "farcaster";
    if (hasZora) return "zora";
    return "hive"; // fallback
  }, [hasHive, hasSkate, hasFarcaster, hasZora]);

  const [activeView, setActiveView] = useState<ProfileView>(defaultView);
  const manualViewRef = useRef(false);
  const defaultViewRef = useRef(defaultView);

  useEffect(() => {
    defaultViewRef.current = defaultView;
  }, [defaultView]);

  const setView = useCallback((view: ProfileView) => {
    manualViewRef.current = true;
    setActiveView(view);
  }, []);

  useEffect(() => {
    manualViewRef.current = false;
    setActiveView(defaultViewRef.current);
  }, [username]);

  useEffect(() => {
    const hasActive =
      (activeView === "hive" && hasHive) ||
      (activeView === "skate" && hasSkate) ||
      (activeView === "zora" && hasZora) ||
      (activeView === "farcaster" && hasFarcaster);
    if (hasActive) {
      return;
    }
    manualViewRef.current = false;
    setActiveView(defaultView);
  }, [activeView, hasHive, hasSkate, hasZora, hasFarcaster, defaultView]);

  useEffect(() => {
    if (manualViewRef.current) return;
    if (activeView !== defaultView) {
      setActiveView(defaultView);
    }
  }, [defaultView, activeView]);

  useEffect(() => {
    onActiveViewChange?.(activeView);
  }, [activeView, onActiveViewChange]);

  const activeHeaderData =
    activeView === "skate"
      ? skateHeaderData
      : activeView === "hive"
      ? hiveHeaderData
      : profileData;

  // Determine which edit handler to use per profile type
  const userbaseEditHandler =
    isUserbaseOwner && onUserbaseEditModalOpen
      ? onUserbaseEditModalOpen
      : onEditModalOpen;
  const hiveEditHandler = onEditModalOpen;
  const canEdit = isOwner || !!isUserbaseOwner;
  const canEditHive = isOwner || (!!isUserbaseOwner && hasHiveLinked);
  const canEditSkate = !!isUserbaseOwner;
  const activeEditHandler =
    activeView === "skate" ? userbaseEditHandler : hiveEditHandler;

  return (
    <Box position="relative" w="100%">
      {/* Mobile Component */}
      <MobileProfileHeader
        profileData={activeHeaderData}
        username={username}
        isOwner={isOwner}
        canEdit={activeView === "skate" ? canEditSkate : canEditHive}
        user={user}
        isFollowing={isFollowing}
        isFollowLoading={isFollowLoading}
        onFollowingChange={onFollowingChange}
        onLoadingChange={onLoadingChange}
        onEditModalOpen={activeEditHandler}
        showZoraProfile={activeView === "zora"}
        onToggleProfile={(show) => setView(show ? "zora" : "hive")}
        cachedZoraData={null}
        zoraLoading={false}
        zoraError={null}
      />

      {/* Desktop Layout */}
      <Box display={{ base: "none", md: "block" }} position="relative">
        <Box w="100%" maxW="container.xl" mx="auto" px={6} py={4}>
          {/* Profile Layouts - visibility controlled by activeView */}

          {/* Skatehive Profile Layout */}
          {hasSkate && (
            <Box display={activeView === "skate" ? "block" : "none"} w="100%">
              <SkateProfileHeader
                profileData={skateHeaderData}
                username={username}
                isOwner={canEditSkate}
                onEditModalOpen={userbaseEditHandler}
              />
            </Box>
          )}

          {/* Zora Profile Layout */}
          {hasZora && (
            <Box display={activeView === "zora" ? "block" : "none"} w="100%">
              <ZoraProfileHeader
                profileData={profileData}
                username={username}
              />
            </Box>
          )}

          {/* Hive Profile Layout */}
          {hasHive && (
            <Box display={activeView === "hive" ? "block" : "none"} w="100%">
              <HiveProfileHeader
                profileData={hiveHeaderData}
                username={username}
                isOwner={isOwner}
                canEdit={canEditHive}
                user={user}
                isFollowing={isFollowing}
                isFollowLoading={isFollowLoading}
                onFollowingChange={onFollowingChange}
                onLoadingChange={onLoadingChange}
                onEditModalOpen={hiveEditHandler}
              />
            </Box>
          )}

          {/* Farcaster Profile Layout */}
          {hasFarcaster && (
            <Box display={activeView === "farcaster" ? "block" : "none"} w="100%">
              <FarcasterProfileHeader
                profileData={profileData}
                username={username}
                farcasterProfile={farcasterProfile}
              />
            </Box>
          )}

          {/* Profile Type Toggle - Bottom Right Corner */}
          <Box position="absolute" bottom={4} right={6} zIndex={10}>
            <HStack spacing={2}>
              {/* Skatehive Profile Logo - Only show if user has app account */}
              {hasSkate && (
                <Tooltip label="Skatehive Account" placement="top">
                  <Box
                    cursor="pointer"
                    onClick={() => setView("skate")}
                    p={1.5}
                    borderRadius="none"
                    bg={activeView === "skate" ? "primary" : "whiteAlpha.200"}
                    border="1px solid"
                    borderColor={activeView === "skate" ? "primary" : "whiteAlpha.300"}
                    transition="all 0.2s"
                    _hover={{
                      borderColor: "primary",
                      bg: activeView === "skate" ? "primary" : "whiteAlpha.300",
                    }}
                    backdropFilter="blur(10px)"
                  >
                    <Image
                      src="/logos/skatehive-logo-rounded.png"
                      alt="Skatehive Profile"
                      boxSize="20px"
                      opacity={activeView === "skate" ? 1 : 0.7}
                      transition="opacity 0.2s"
                    />
                  </Box>
                </Tooltip>
              )}

              {/* Hive Profile Logo - Only show if user has Hive profile */}
              {hasHive && (
                <Tooltip label="Hive Profile" placement="top">
                  <Box
                    cursor="pointer"
                    onClick={() => setView("hive")}
                    p={1.5}
                    borderRadius="none"
                    bg={activeView === "hive" ? "primary" : "whiteAlpha.200"}
                    border="1px solid"
                    borderColor={activeView === "hive" ? "primary" : "whiteAlpha.300"}
                    transition="all 0.2s"
                    _hover={{
                      borderColor: "primary",
                      bg: activeView === "hive" ? "primary" : "whiteAlpha.300",
                    }}
                    backdropFilter="blur(10px)"
                  >
                    <Image
                      src="/logos/hiveLogo.png"
                      alt="Hive Profile"
                      boxSize="20px"
                      opacity={activeView === "hive" ? 1 : 0.7}
                      transition="opacity 0.2s"
                    />
                  </Box>
                </Tooltip>
              )}

              {/* Zora Profile Logo - Only show if user has ETH address */}
              {hasZora && (
                <Tooltip label="Zora Profile" placement="top">
                  <Box
                    cursor="pointer"
                    onClick={() => setView("zora")}
                    p={1.5}
                    borderRadius="none"
                    bg={activeView === "zora" ? "primary" : "whiteAlpha.200"}
                    border="1px solid"
                    borderColor={activeView === "zora" ? "primary" : "whiteAlpha.300"}
                    transition="all 0.2s"
                    _hover={{
                      borderColor: "primary",
                      bg: activeView === "zora" ? "primary" : "whiteAlpha.300",
                    }}
                    backdropFilter="blur(10px)"
                  >
                    <Image
                      src="/logos/Zorb.png"
                      alt="Zora Profile"
                      boxSize="20px"
                      opacity={activeView === "zora" ? 1 : 0.7}
                      transition="opacity 0.2s"
                    />
                  </Box>
                </Tooltip>
              )}

              {/* Farcaster Profile Logo - Only show if user has Farcaster profile */}
              {hasFarcaster && (
                <Tooltip label="Farcaster Profile" placement="top">
                  <Box
                    cursor="pointer"
                    onClick={() => setView("farcaster")}
                    p={1.5}
                    borderRadius="none"
                    bg={activeView === "farcaster" ? "purple.500" : "whiteAlpha.200"}
                    border="1px solid"
                    borderColor={activeView === "farcaster" ? "purple.500" : "whiteAlpha.300"}
                    transition="all 0.2s"
                    _hover={{
                      borderColor: "purple.400",
                      bg: activeView === "farcaster" ? "purple.500" : "whiteAlpha.300",
                    }}
                    backdropFilter="blur(10px)"
                  >
                    <Image
                      src="/logos/farcaster.svg"
                      alt="Farcaster Profile"
                      boxSize="20px"
                      opacity={activeView === "farcaster" ? 1 : 0.7}
                      transition="opacity 0.2s"
                    />
                  </Box>
                </Tooltip>
              )}

              {debugPayload && (
                <ProfileDebugControl payload={debugPayload} />
              )}
            </HStack>
          </Box>
      
        </Box>
      </Box>
    </Box>
  );
};

export default memo(ProfileHeader, (prevProps, nextProps) => {
  return (
    prevProps.username === nextProps.username &&
    prevProps.profileData.ethereum_address ===
      nextProps.profileData.ethereum_address &&
    prevProps.isOwner === nextProps.isOwner &&
    prevProps.isUserbaseOwner === nextProps.isUserbaseOwner &&
    prevProps.user === nextProps.user &&
    prevProps.isFollowing === nextProps.isFollowing &&
    prevProps.isFollowLoading === nextProps.isFollowLoading &&
    prevProps.debugPayload === nextProps.debugPayload &&
    prevProps.hasHiveProfile === nextProps.hasHiveProfile &&
    prevProps.hasUserbaseProfile === nextProps.hasUserbaseProfile &&
    prevProps.userbaseIdentities === nextProps.userbaseIdentities &&
    prevProps.farcasterProfile?.fid === nextProps.farcasterProfile?.fid &&
    prevProps.farcasterProfile?.displayName === nextProps.farcasterProfile?.displayName &&
    prevProps.farcasterProfile?.pfpUrl === nextProps.farcasterProfile?.pfpUrl &&
    prevProps.farcasterProfile?.bio === nextProps.farcasterProfile?.bio &&
    prevProps.farcasterProfile?.username === nextProps.farcasterProfile?.username &&
    prevProps.farcasterProfile?.custody === nextProps.farcasterProfile?.custody &&
    prevProps.farcasterProfile?.verifications === nextProps.farcasterProfile?.verifications
  );
});
