"use client";
import React, {
  useState,
  useMemo,
  useCallback,
  memo,
  useRef,
  useEffect,
} from "react";
import { Box, Alert, AlertIcon, Container, Center } from "@chakra-ui/react";
import useHiveAccount from "@/hooks/useHiveAccount";
import LoadingComponent from "../homepage/loadingComponent";
import PostInfiniteScroll from "../blog/PostInfiniteScroll";
import { useAioha } from "@aioha/react-ui";
import EditProfile from "./EditProfile";
import { VideoPart } from "@/types/VideoPart";
import VideoPartsView from "./VideoPartsView";

// Import modular components
// ProfileCoverImage removed - now integrated into ProfileHeaderWrapper
import ProfileHeader from "./ProfileHeader";
import ViewModeSelector from "./ViewModeSelector";
import MagazineModal from "../shared/MagazineModal";
import SnapsGrid from "./SnapsGrid";
import ZoraTokensView from "./ZoraTokensView";
import SoftSnapsGrid from "./SoftSnapsGrid";
import EditUserbaseProfile from "./EditUserbaseProfile";
import FarcasterCastsView from "./FarcasterCastsView";

// Import custom hooks
import useProfileData from "@/hooks/useProfileData";
import useFollowStatus from "@/hooks/useFollowStatus";
import useProfilePosts from "@/hooks/useProfilePosts";
import useViewMode from "@/hooks/useViewMode";
import useIsMobile from "@/hooks/useIsMobile";
import useUserbaseProfile from "@/hooks/useUserbaseProfile";
import useUserbaseSoftPosts from "@/hooks/useUserbaseSoftPosts";
import { useTranslations } from "@/lib/i18n/hooks";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";
import { Discussion } from "@hiveio/dhive";

// Memoized SnapsGrid to prevent unnecessary re-renders
const MemoizedSnapsGrid = memo(function MemoizedSnapsGrid({
  username,
}: {
  username: string;
}) {
  return <SnapsGrid username={username} />;
});

// Memoized PostInfiniteScroll to prevent re-renders
const MemoizedPostInfiniteScroll = memo(function MemoizedPostInfiniteScroll(
  props: any
) {
  return <PostInfiniteScroll {...props} />;
});

// Optimized content views component with conditional mounting to reduce re-renders
const ContentViews = memo(function ContentViews({
  viewMode,
  postProps,
  videoPartsProps,
  username,
  snapsUsername,
  softSnaps,
  ethereumAddress,
  hasHiveProfile,
  farcasterFid,
  farcasterUsername,
}: {
  viewMode: string;
  postProps: {
    allPosts: any[];
    fetchPosts: () => Promise<void>;
    viewMode: "grid" | "list";
    context: "profile";
    hideAuthorInfo: boolean;
    isLoading: boolean;
    hasMore: boolean;
  };
  videoPartsProps: {
    profileData: ProfileData;
    username: string;
    onProfileUpdate: (data: Partial<ProfileData>) => void;
  };
  username: string;
  snapsUsername?: string | null;
  softSnaps?: Discussion[];
  ethereumAddress?: string;
  hasHiveProfile: boolean;
  farcasterFid?: number | null;
  farcasterUsername?: string | null;
}) {
  // Use conditional rendering with style display to avoid unmounting/remounting
  return (
    <>
      {hasHiveProfile && (
        <>
          <Box display={viewMode === "videoparts" ? "block" : "none"}>
            {viewMode === "videoparts" && <VideoPartsView {...videoPartsProps} />}
          </Box>

          <Box display={viewMode === "snaps" ? "block" : "none"}>
            {viewMode === "snaps" && (
              <>
                {snapsUsername && (
                  <MemoizedSnapsGrid username={snapsUsername} />
                )}
                <SoftSnapsGrid snaps={softSnaps || []} />
              </>
            )}
          </Box>
        </>
      )}

      <Box display={viewMode === "tokens" ? "block" : "none"}>
        {viewMode === "tokens" && (
          <ZoraTokensView ethereumAddress={ethereumAddress} />
        )}
      </Box>

      <Box display={viewMode === "casts" ? "block" : "none"}>
        {viewMode === "casts" && farcasterFid && (
          <FarcasterCastsView
            fid={farcasterFid}
            username={farcasterUsername || undefined}
          />
        )}
      </Box>

      <Box display={["grid", "list"].includes(viewMode) ? "block" : "none"}>
        {["grid", "list"].includes(viewMode) && (
          <MemoizedPostInfiniteScroll
            key={`posts-${viewMode}`}
            {...postProps}
          />
        )}
      </Box>
    </>
  );
});

interface ProfilePageProps {
  username: string;
}

export interface ProfileData {
  profileImage: string;
  coverImage: string;
  website: string;
  name: string;
  followers: number;
  following: number;
  location: string;
  about: string;
  ethereum_address?: string;
  video_parts?: VideoPart[];
  vote_weight?: number;
  vp_percent?: string;
  rc_percent?: string;
  zineCover?: string;
  svs_profile?: string;
}

const ProfilePage = memo(function ProfilePage({ username }: ProfilePageProps) {
  const { profile: userbaseProfile, isLoading: userbaseLoading, refresh: refreshUserbaseProfile } =
    useUserbaseProfile(username);
  const { user: currentUserbaseUser } = useUserbaseAuth();
  const userbaseUser = userbaseProfile?.user ?? null;
  const userbaseIdentities = useMemo(
    () => userbaseProfile?.identities ?? [],
    [userbaseProfile?.identities]
  );
  const userbaseMatch = userbaseProfile?.match ?? null;
  const hiveIdentity = userbaseIdentities.find((item) => item.type === "hive");
  const farcasterIdentity = userbaseIdentities.find((item) => item.type === "farcaster");
  const hiveIdentityHandle = hiveIdentity?.handle || null;
  const farcasterIdentityFid = farcasterIdentity?.external_id || null;
  const farcasterIdentityHandle = farcasterIdentity?.handle || null;
  const farcasterCustodyAddress = farcasterIdentity?.address?.toLowerCase() || null;

  // Get all EVM identities and prioritize them
  const allEvmIdentities = userbaseIdentities.filter((item) => item.type === "evm");

  // EVM Address Priority:
  // 1. Hive eth_address (metadata.is_eth_address = true)
  // 2. Hive primary_wallet (metadata.is_primary_wallet = true)
  // 3. Other Hive wallets (source: "hive", not custody)
  // 4. Farcaster verified wallets (verified_via: "farcaster")
  // 5. Custody address (last resort)
  const evmIdentity = useMemo(() => {
    if (allEvmIdentities.length === 0) return null;
    if (allEvmIdentities.length === 1) return allEvmIdentities[0];

    // Sort by priority
    const sorted = [...allEvmIdentities].sort((a, b) => {
      const aPriority = a.metadata?.display_priority || 99;
      const bPriority = b.metadata?.display_priority || 99;

      // If both have display_priority, use it
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // Otherwise, use fallback logic
      const aIsCustody = a.address?.toLowerCase() === farcasterCustodyAddress;
      const bIsCustody = b.address?.toLowerCase() === farcasterCustodyAddress;

      if (aIsCustody && !bIsCustody) return 1; // b wins (custody is last)
      if (!aIsCustody && bIsCustody) return -1; // a wins

      const aIsHive = a.metadata?.source === "hive";
      const bIsHive = b.metadata?.source === "hive";

      if (aIsHive && !bIsHive) return -1; // a wins (hive first)
      if (!aIsHive && bIsHive) return 1; // b wins

      return 0;
    });

    return sorted[0];
  }, [allEvmIdentities, farcasterCustodyAddress]);

  const evmIdentityAddress = evmIdentity?.address || null;
  const isEvmAddress = /^0x[a-fA-F0-9]{40}$/.test(username);
  const hiveLookupHandle = hiveIdentityHandle || (isEvmAddress ? "" : username);
  const { hiveAccount, isLoading, error } = useHiveAccount(hiveLookupHandle);
  const { user } = useAioha();
  const tCommon = useTranslations("common");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isUserbaseEditModalOpen, setIsUserbaseEditModalOpen] = useState(false);
  const [activeProfileView, setActiveProfileView] = useState<
    "hive" | "skate" | "zora" | "farcaster" | null
  >(null);

  // Custom hooks
  const { profileData, updateProfileData } = useProfileData(
    hiveLookupHandle,
    hiveAccount
  );
  const followTarget = hiveAccount ? hiveLookupHandle : "";
  const { isFollowing, isFollowLoading, updateFollowing, updateLoading } =
    useFollowStatus(user, followTarget);
  const hivePostsHandle = hiveIdentityHandle || (hiveAccount ? hiveLookupHandle : "");
  const {
    posts: hivePosts,
    fetchPosts: fetchHivePosts,
    isLoading: postsLoading,
  } = useProfilePosts(hivePostsHandle);
  const { viewMode, handleViewModeChange, closeMagazine } = useViewMode();
  const isMobile = useIsMobile();

  // Debounce timer ref for view mode changes
  const viewModeTimer = useRef<NodeJS.Timeout | null>(null);
  const isTransitioning = useRef(false);

  // Memoize derived values
  const isHiveProfile =
    !!hiveAccount &&
    hiveLookupHandle &&
    hiveLookupHandle.toLowerCase() === username.toLowerCase();
  const canShowHiveViews = isHiveProfile || !!hivePostsHandle;
  const allowSoftPosts =
    userbaseUser &&
    (userbaseMatch === "hive" || (!isHiveProfile && userbaseMatch === "handle"));
  const {
    posts: softPosts,
    isLoading: softPostsLoading,
  } = useUserbaseSoftPosts(allowSoftPosts ? userbaseUser?.id : null);
  const softSnaps = useMemo(
    () => softPosts.filter((post) => (post as any).__softType === "snap"),
    [softPosts]
  );
  const softPages = useMemo(
    () => softPosts.filter((post) => (post as any).__softType !== "snap"),
    [softPosts]
  );
  const hasSoftSnaps = softSnaps.length > 0;
  const isOwner = useMemo(
    () => (isHiveProfile ? user === hiveLookupHandle : false),
    [user, hiveLookupHandle, isHiveProfile]
  );
  const isUserbaseOwner = useMemo(
    () => !!(currentUserbaseUser && userbaseUser && currentUserbaseUser.id === userbaseUser.id),
    [currentUserbaseUser, userbaseUser]
  );

  // EVM Address Priority:
  // 1. Best linked EVM identity (Hive wallets > Farcaster verified > Custody)
  // 2. Direct EVM address lookup (if username is an address)
  // 3. Legacy Hive profile metadata ethereum_address (fallback)
  const resolvedEthereumAddress =
    evmIdentityAddress ||
    (isEvmAddress ? username : "") ||
    profileData.ethereum_address;

  // When user has linked Hive account, use Hive avatar only if app profile doesn't have one
  const hiveAvatarUrl = hiveIdentityHandle
    ? `https://images.hive.blog/u/${hiveIdentityHandle}/avatar`
    : null;

  const liteProfileData = useMemo<ProfileData>(() => {
    if (userbaseUser) {
      return {
        // Prefer app profile assets; fall back to Hive only if app assets are missing
        profileImage: userbaseUser.avatar_url || hiveAvatarUrl || "",
        coverImage: userbaseUser.cover_url || "",
        website: "",
        name:
          userbaseUser.display_name ||
          userbaseUser.handle ||
          hiveIdentityHandle ||
          username ||
          "Skater",
        followers: 0,
        following: 0,
        location: userbaseUser.location || "",
        about: userbaseUser.bio || "",
        ethereum_address: evmIdentityAddress || "",
        video_parts: [],
        vote_weight: 51,
        vp_percent: "",
        rc_percent: "",
        zineCover: "",
        svs_profile: "",
      };
    }
    if (isEvmAddress) {
      return {
        profileImage: "",
        coverImage: "",
        website: "",
        name: username,
        followers: 0,
        following: 0,
        location: "",
        about: "",
        ethereum_address: username,
        video_parts: [],
        vote_weight: 51,
        vp_percent: "",
        rc_percent: "",
        zineCover: "",
        svs_profile: "",
      };
    }
    return {
      profileImage: "",
      coverImage: "",
      website: "",
      name: username,
      followers: 0,
      following: 0,
      location: "",
      about: "",
      ethereum_address: "",
      video_parts: [],
      vote_weight: 51,
      vp_percent: "",
      rc_percent: "",
      zineCover: "",
      svs_profile: "",
    };
  }, [userbaseUser, evmIdentityAddress, username, isEvmAddress, hiveIdentityHandle, hiveAvatarUrl]);

  const activeProfileData = useMemo(() => {
    if (isHiveProfile) {
      return {
        ...profileData,
        ethereum_address: resolvedEthereumAddress,
      };
    }
    return {
      ...liteProfileData,
      ethereum_address: resolvedEthereumAddress,
    };
  }, [isHiveProfile, profileData, liteProfileData, resolvedEthereumAddress]);

  const resolvedCoverImage = useMemo(() => {
    const hiveCover = profileData.coverImage || "";
    const skateCover = liteProfileData.coverImage || "";
    switch (activeProfileView) {
      case "hive":
        return hiveCover || skateCover;
      case "skate":
        return skateCover || hiveCover;
      case "zora":
        return hiveCover || skateCover; // Zora uses Hive cover
      case "farcaster":
        // Farcaster protocol doesn't have cover images, use Hive cover as fallback
        return hiveCover || skateCover;
      default:
        return activeProfileData.coverImage;
    }
  }, [activeProfileView, profileData.coverImage, liteProfileData.coverImage, activeProfileData.coverImage]);

  // Build Farcaster profile data from userbase identity if available
  const farcasterProfileData = useMemo(() => {
    if (!farcasterIdentityFid) return null;

    // Extract metadata from the farcaster identity
    const metadata = farcasterIdentity?.metadata || {};

    return {
      fid: parseInt(farcasterIdentityFid, 10),
      username: farcasterIdentityHandle || undefined,
      pfpUrl: metadata.pfp_url || undefined,
      displayName: metadata.display_name || undefined,
      bio: metadata.bio || undefined,
      custody: farcasterIdentity?.address || undefined,
      verifications: metadata.verifications || [],
    };
  }, [farcasterIdentityFid, farcasterIdentityHandle, farcasterIdentity]);

  // Throttled close handler to prevent rapid clicking
  const throttledCloseMagazine = useCallback(() => {
    closeMagazine();
  }, [closeMagazine]);

  // Modal handlers - Stable references to prevent re-renders
  const handleEditModalOpen = useCallback(() => setIsEditModalOpen(true), []);
  const handleEditModalClose = useCallback(() => setIsEditModalOpen(false), []);
  const handleUserbaseEditModalOpen = useCallback(() => setIsUserbaseEditModalOpen(true), []);
  const handleUserbaseEditModalClose = useCallback(() => setIsUserbaseEditModalOpen(false), []);

  // Optimized view mode change handler with debouncing to prevent rapid switches
  const memoizedViewModeChange = useCallback(
    (
      mode: "grid" | "list" | "magazine" | "videoparts" | "snaps" | "tokens" | "casts"
    ) => {
      // Prevent rapid changes
      if (isTransitioning.current) return;

      // Clear previous timer
      if (viewModeTimer.current) {
        clearTimeout(viewModeTimer.current);
      }

      isTransitioning.current = true;

      // Debounce the view mode change to prevent rapid switching
      viewModeTimer.current = setTimeout(() => {
        // Use requestIdleCallback if available for non-blocking execution
        if (window.requestIdleCallback) {
          window.requestIdleCallback(
            () => {
              handleViewModeChange(mode);
              // Reset transition flag after a brief delay
              setTimeout(() => {
                isTransitioning.current = false;
              }, 100);
            },
            { timeout: 100 }
          );
        } else {
          // Fallback to requestAnimationFrame
          requestAnimationFrame(() => {
            handleViewModeChange(mode);
            setTimeout(() => {
              isTransitioning.current = false;
            }, 100);
          });
        }
      }, 100); // Reduced to 100ms for better responsiveness
    },
    [handleViewModeChange]
  );

  // Memoize follow-related props to prevent ProfileHeader re-renders
  const followProps = useMemo(
    () => ({
      isFollowing,
      isFollowLoading,
      onFollowingChange: updateFollowing,
      onLoadingChange: updateLoading,
    }),
    [isFollowing, isFollowLoading, updateFollowing, updateLoading]
  );

  // Memoize chronologically sorted posts - only when needed for grid/list views
  const combinedPosts = useMemo(() => {
    // Skip expensive sorting if we're in snaps, videoparts or tokens mode
    if (!["grid", "list", "magazine"].includes(viewMode)) {
      return [];
    }
    return [...hivePosts, ...softPages].sort(
      (a, b) => new Date(b.created).getTime() - new Date(a.created).getTime()
    );
  }, [hivePosts, softPages, viewMode]);

  // Memoize post-related props - only when needed for grid/list views
  const postProps = useMemo(() => {
    // Skip creating props if not in grid/list mode
    if (!["grid", "list"].includes(viewMode)) {
      return {
        allPosts: [],
        fetchPosts: () => Promise.resolve(),
        viewMode: "grid" as const,
        context: "profile" as const,
        hideAuthorInfo: true,
        isLoading: false,
        hasMore: false,
      };
    }

    return {
      allPosts: combinedPosts,
      fetchPosts: hivePostsHandle ? fetchHivePosts : () => Promise.resolve(),
      viewMode: viewMode as "grid" | "list",
      context: "profile" as const,
      hideAuthorInfo: true,
      isLoading: postsLoading || softPostsLoading,
      hasMore: Boolean(hivePostsHandle),
    };
  }, [
    combinedPosts,
    fetchHivePosts,
    viewMode,
    postsLoading,
    softPostsLoading,
    hivePostsHandle,
  ]);

  // Memoize video parts props
  const videoPartsProps = useMemo(
    () => ({
      profileData: hiveAccount ? profileData : activeProfileData,
      username: hiveLookupHandle || username,
      onProfileUpdate: updateProfileData,
    }),
    [activeProfileData, hiveAccount, profileData, hiveLookupHandle, username, updateProfileData]
  );

  const debugPayload = useMemo(() => {
    // Debug payload available in all environments for profile debugging
    return {
      username,
      viewMode,
      isHiveProfile,
      isOwner,
      isUserbaseOwner,
      currentUserbaseUserId: currentUserbaseUser?.id || null,
      canShowHiveViews,
      hiveLookupHandle,
      hiveIdentityHandle,
      hivePostsHandle,
      userbaseMatch,
      userbaseUser,
      userbaseIdentities,
      resolvedEthereumAddress,
      hiveAccountName: hiveAccount?.name || null,
      hiveAccountMetadata: hiveAccount?.metadata || null,
      profileData: activeProfileData,
      liteProfileData,
    };
  }, [
    username,
    viewMode,
    isHiveProfile,
    isOwner,
    isUserbaseOwner,
    currentUserbaseUser?.id,
    canShowHiveViews,
    hiveLookupHandle,
    hiveIdentityHandle,
    hivePostsHandle,
    userbaseMatch,
    userbaseUser,
    userbaseIdentities,
    resolvedEthereumAddress,
    hiveAccount,
    activeProfileData,
    liteProfileData,
  ]);

  const headerUsername = useMemo(() => {
    if (isHiveProfile) {
      return hiveLookupHandle || username;
    }
    // Prefer Hive identity handle if available (for app accounts linked to Hive)
    if (hiveIdentityHandle) {
      return hiveIdentityHandle;
    }
    if (userbaseUser?.handle) {
      return userbaseUser.handle;
    }
    return username;
  }, [isHiveProfile, hiveLookupHandle, username, hiveIdentityHandle, userbaseUser?.handle]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (viewModeTimer.current) {
        clearTimeout(viewModeTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    // Redirect from Hive-only views if user doesn't have Hive
    if (canShowHiveViews || hasSoftSnaps) return;
    if (["snaps", "videoparts", "magazine"].includes(viewMode)) {
      // Prefer casts if Farcaster available, tokens if Ethereum available, otherwise grid
      if (farcasterIdentityFid) {
        handleViewModeChange("casts");
      } else if (resolvedEthereumAddress) {
        handleViewModeChange("tokens");
      } else {
        handleViewModeChange("grid");
      }
    }
  }, [
    canShowHiveViews,
    hasSoftSnaps,
    viewMode,
    handleViewModeChange,
    resolvedEthereumAddress,
    farcasterIdentityFid,
  ]);

  const isProfileResolved =
    isHiveProfile || Boolean(userbaseUser) || isEvmAddress;
  
  if (!isProfileResolved && (isLoading || userbaseLoading)) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <LoadingComponent />
      </Box>
    );
  }

  if (!isProfileResolved && !isLoading && !userbaseLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        height="100vh"
      >
        <Alert status="error" borderRadius="md" variant="solid">
          <AlertIcon />
          {error || tCommon("profileNotFound")}
        </Alert>
      </Box>
    );
  }

  return (
    <>
      {/* Magazine Modal - Only render when needed with performance optimization */}
      {viewMode === "magazine" && (
          <MagazineModal
            isOpen={viewMode === "magazine"}
            onClose={throttledCloseMagazine}
            hiveUsername={hiveLookupHandle || username}
            posts={combinedPosts}
            zineCover={activeProfileData.zineCover}
            userProfileImage={activeProfileData.profileImage}
            displayName={activeProfileData.name}
            userLocation={activeProfileData.location}
          />
        )}
      <Center>
        <Container maxW="container.md" p={0} m={0}>
          {/* Main Profile Content */}
          <Box
            id="scrollableDiv"
            color="text"
            maxW="container.lg"
            mx="auto"
            p={0}
            m={0}
            maxH="100vh"
            overflowY="auto"
            sx={{
              "&::-webkit-scrollbar": { display: "none" },
              scrollbarWidth: "none",
            }}
          >
            {/* Cover Image now integrated into individual profile headers via ProfileHeaderWrapper */}

            {/* Profile Header */}
            <ProfileHeader
              profileData={activeProfileData}
              hiveProfileData={profileData}
              skateProfileData={liteProfileData}
              username={headerUsername}
              isOwner={isOwner}
              isUserbaseOwner={isUserbaseOwner}
              user={isHiveProfile ? user : null}
              {...followProps}
              onEditModalOpen={handleEditModalOpen}
              onUserbaseEditModalOpen={handleUserbaseEditModalOpen}
              onActiveViewChange={setActiveProfileView}
              onContentViewChange={memoizedViewModeChange}
              debugPayload={debugPayload}
              hasHiveProfile={isHiveProfile || !!hiveIdentityHandle}
              hasUserbaseProfile={!!userbaseUser}
              farcasterProfile={farcasterProfileData}
            />

            {/* View Mode Selector */}
            <ViewModeSelector
              viewMode={viewMode}
              onViewModeChange={memoizedViewModeChange}
              isMobile={isMobile}
              hasEthereumAddress={!!resolvedEthereumAddress}
              hasHiveProfile={canShowHiveViews || hasSoftSnaps}
              hasFarcasterProfile={!!farcasterIdentityFid}
            />

            {/* Content Views - Optimized conditional rendering */}
            <ContentViews
              viewMode={viewMode}
              postProps={postProps}
              videoPartsProps={videoPartsProps}
              username={username}
              snapsUsername={hivePostsHandle || null}
              softSnaps={softSnaps}
              ethereumAddress={resolvedEthereumAddress}
              hasHiveProfile={canShowHiveViews || hasSoftSnaps}
              farcasterFid={farcasterIdentityFid ? parseInt(farcasterIdentityFid, 10) : null}
              farcasterUsername={farcasterIdentityHandle}
            />
          </Box>
        </Container>
      </Center>

      {/* Edit Profile Modal - Only render when modal is open */}
      {isEditModalOpen && (
        <EditProfile
          isOpen={isEditModalOpen}
          onClose={handleEditModalClose}
          profileData={profileData}
          onProfileUpdate={updateProfileData}
          username={hiveLookupHandle || username}
        />
      )}

      {/* Edit Userbase Profile Modal */}
      {isUserbaseEditModalOpen && userbaseUser && (
        <EditUserbaseProfile
          isOpen={isUserbaseEditModalOpen}
          onClose={handleUserbaseEditModalClose}
          profileData={{
            display_name: userbaseUser.display_name,
            handle: userbaseUser.handle,
            avatar_url: userbaseUser.avatar_url,
            cover_url: userbaseUser.cover_url,
            bio: userbaseUser.bio,
            location: userbaseUser.location,
          }}
          onProfileUpdate={refreshUserbaseProfile}
        />
      )}
    </>
  );
});

export default ProfilePage;
