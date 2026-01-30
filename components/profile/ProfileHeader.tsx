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
import { useLinkedIdentities } from "@/contexts/LinkedIdentityContext";



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
  onContentViewChange?: (view: "grid" | "list" | "magazine" | "videoparts" | "snaps" | "tokens") => void;
  debugPayload?: Record<string, any> | null;
  hasHiveProfile?: boolean;
  hasUserbaseProfile?: boolean;
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
  onContentViewChange,
  debugPayload,
  hasHiveProfile = true,
  hasUserbaseProfile = false,
  farcasterProfile = null,
}: ProfileHeaderProps) {
  const { connections } = useLinkedIdentities();
  const hiveConnection = connections.hive;
  const evmConnection = connections.evm;
  const farcasterConnection = connections.farcaster;
  const hiveHeaderData = hiveProfileData || profileData;
  const skateHeaderData = skateProfileData || profileData;

  // Determine available views and default view
  const hasZora = !!profileData.ethereum_address;
  const hasHive = hasHiveProfile;
  const hasSkate = hasUserbaseProfile;
  const hasFarcaster = !!farcasterProfile?.fid;

  // Calculate linked identities
  const hasHiveLinked = hiveConnection.linked;


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
    console.log("[ProfileHeader] setView called:", { view, currentActiveView: activeView });
    manualViewRef.current = true;
    setActiveView(view);
  }, [activeView]);

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

  // Disabled: This effect was causing views to reset when manually selected
  // useEffect(() => {
  //   if (manualViewRef.current) return;
  //   if (activeView !== defaultView) {
  //     setActiveView(defaultView);
  //   }
  // }, [defaultView, activeView]);

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


  // Network toggle buttons (to be passed as integrations prop)
  const networkButtons = (
    <HStack spacing={2}>
      {/* Skatehive Profile Folder */}
      {hasSkate && (
        <Tooltip label="Skatehive Account" placement="top">
          <Box
            cursor="pointer"
            onClick={() => {
              setView("skate");
              onContentViewChange?.("grid");
            }}
            transition="all 0.2s"
            _hover={{ transform: "scale(1.1)" }}
            position="relative"
            w="32px"
            h="32px"
          >
            {activeView === "skate" ? (
              <Box
                as="img"
                src="/folder-icons/skatehive-open-folder.png?v=2"
                alt="Skatehive Profile"
                boxSize="32px"
                position="absolute"
                top={0}
                left={0}
              />
            ) : (
              <Box
                as="img"
                src="/folder-icons/skatehive-closed-folder.png?v=2"
                alt="Skatehive Profile"
                boxSize="32px"
                position="absolute"
                top={0}
                left={0}
              />
            )}
          </Box>
        </Tooltip>
      )}

      {/* Hive Profile Folder */}
      {hasHive && (
        <Tooltip label="Hive Profile" placement="top">
          <Box
            cursor="pointer"
            onClick={() => {
              setView("hive");
              onContentViewChange?.("snaps");
            }}
            transition="all 0.2s"
            _hover={{ transform: "scale(1.1)" }}
            position="relative"
            w="32px"
            h="32px"
          >
            {activeView === "hive" ? (
              <Box
                as="img"
                src="/folder-icons/hive-open-folder.png?v=2"
                alt="Hive Profile"
                boxSize="32px"
                position="absolute"
                top={0}
                left={0}
              />
            ) : (
              <Box
                as="img"
                src="/folder-icons/hive-closed-folder.png?v=2"
                alt="Hive Profile"
                boxSize="32px"
                position="absolute"
                top={0}
                left={0}
              />
            )}
          </Box>
        </Tooltip>
      )}

      {/* Zora Profile Folder */}
      {hasZora && (
        <Tooltip label="Zora Profile" placement="top">
          <Box
            cursor="pointer"
            onClick={() => {
              setView("zora");
              onContentViewChange?.("tokens");
            }}
            transition="all 0.2s"
            _hover={{ transform: "scale(1.1)" }}
            position="relative"
            w="32px"
            h="32px"
          >
            {activeView === "zora" ? (
              <Box
                as="img"
                src="/folder-icons/zora-open-folder.png?v=2"
                alt="Zora Profile"
                boxSize="32px"
                position="absolute"
                top={0}
                left={0}
              />
            ) : (
              <Box
                as="img"
                src="/folder-icons/zora-closed-folder.png?v=2"
                alt="Zora Profile"
                boxSize="32px"
                position="absolute"
                top={0}
                left={0}
              />
            )}
          </Box>
        </Tooltip>
      )}

      {/* Farcaster Profile Folder */}
      {hasFarcaster && (
        <Tooltip label="Farcaster Profile" placement="top">
          <Box
            cursor="pointer"
            onClick={() => {
              setView("farcaster");
              onContentViewChange?.("casts");
            }}
            transition="all 0.2s"
            _hover={{ transform: "scale(1.1)" }}
            position="relative"
            w="32px"
            h="32px"
          >
            {activeView === "farcaster" ? (
              <Box
                as="img"
                src="/folder-icons/farcaster-open-folder.png?v=2"
                alt="Farcaster Profile"
                boxSize="32px"
                position="absolute"
                top={0}
                left={0}
              />
            ) : (
              <Box
                as="img"
                src="/folder-icons/farcaster-closed-folder.png?v=2"
                alt="Farcaster Profile"
                boxSize="32px"
                position="absolute"
                top={0}
                left={0}
              />
            )}
          </Box>
        </Tooltip>
      )}

      {debugPayload && (
        <ProfileDebugControl payload={debugPayload} />
      )}
    </HStack>
  );

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
                integrations={networkButtons}
              />
            </Box>
          )}

          {/* Zora Profile Layout */}
          {hasZora && (
            <Box display={activeView === "zora" ? "block" : "none"} w="100%">
              <ZoraProfileHeader
                profileData={profileData}
                username={username}
                integrations={networkButtons}
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
                integrations={networkButtons}
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
                integrations={networkButtons}
              />
            </Box>
          )}
      
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
    prevProps.farcasterProfile?.fid === nextProps.farcasterProfile?.fid &&
    prevProps.farcasterProfile?.displayName === nextProps.farcasterProfile?.displayName &&
    prevProps.farcasterProfile?.pfpUrl === nextProps.farcasterProfile?.pfpUrl &&
    prevProps.farcasterProfile?.bio === nextProps.farcasterProfile?.bio &&
    prevProps.farcasterProfile?.username === nextProps.farcasterProfile?.username &&
    prevProps.farcasterProfile?.custody === nextProps.farcasterProfile?.custody &&
    prevProps.farcasterProfile?.verifications === nextProps.farcasterProfile?.verifications
  );
});
