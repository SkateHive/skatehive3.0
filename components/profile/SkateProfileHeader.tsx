"use client";
import React, { memo, useMemo, useState } from "react";
import { IconButton, HStack, Text, Box } from "@chakra-ui/react";
import { FaEdit, FaMapMarkerAlt } from "react-icons/fa";
import { ProfileData } from "./ProfilePage";
import ProfileHeaderWrapper from "./ProfileHeaderWrapper";
import IdentityBlock from "./IdentityBlock";
import { useSponsorshipStatus } from "@/hooks/useSponsorshipStatus";
import SponsorButton from "@/components/userbase/SponsorButton";
import SponsorshipModal from "@/components/userbase/SponsorshipModal";
import { useUserbaseAuth } from "@/contexts/UserbaseAuthContext";

interface SkateProfileHeaderProps {
  profileData: ProfileData;
  username: string;
  isOwner: boolean;
  onEditModalOpen: () => void;
  integrations?: React.ReactNode;
  userbaseUserId?: string | null;
  sponsorHiveUsername?: string | null;
}

const SkateProfileHeader = function SkateProfileHeader({
  profileData,
  username,
  isOwner,
  onEditModalOpen,
  integrations,
  userbaseUserId,
  sponsorHiveUsername,
}: SkateProfileHeaderProps) {
  const { user: currentUser } = useUserbaseAuth();
  const [isSponsorModalOpen, setIsSponsorModalOpen] = useState(false);

  // Fetch sponsorship status
  const { isSponsored, isLite, sponsorUsername, loading } =
    useSponsorshipStatus(userbaseUserId || null);

  // Build badges based on sponsorship status
  const badges = useMemo(() => {
    if (loading) return undefined;

    const badgeList: Array<{
      label: string;
      value: string;
      colorScheme?: string;
    }> = [];

    if (isSponsored && sponsorUsername) {
      badgeList.push({
        label: "SPONSORED_BY",
        value: `@${sponsorUsername}`,
        colorScheme: "green",
      });
    } else if (isLite) {
      badgeList.push({
        label: "STATUS",
        value: "LITE",
        colorScheme: "orange",
      });
    }

    return badgeList.length > 0 ? badgeList : undefined;
  }, [isSponsored, isLite, sponsorUsername, loading]);

  // Show sponsor button if:
  // 1. User is lite (not sponsored)
  // 2. Viewer is not the owner
  // 3. Viewer has a Hive account (sponsorHiveUsername is provided)
  const canSponsor =
    !loading &&
    isLite &&
    !isOwner &&
    !!sponsorHiveUsername &&
    !!userbaseUserId;

  // Stats row: Terminal-style location display with optional sponsor button
  const statsRow = (
    <HStack spacing={3} fontSize="xs" fontFamily="mono" flexWrap="wrap">
      {profileData.location && (
        <HStack spacing={2}>
          <FaMapMarkerAlt color="var(--chakra-colors-primary)" />
          <Text color="text" whiteSpace="nowrap" textTransform="uppercase">
            {profileData.location}
          </Text>
        </HStack>
      )}
      {canSponsor && userbaseUserId && (
        <SponsorButton
          liteUserId={userbaseUserId}
          displayName={profileData.name || username}
          handle={username}
          onSponsorshipInitiated={() => setIsSponsorModalOpen(true)}
        />
      )}
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
            badges={badges}
            statsRow={statsRow}
            integrations={integrations}
            editButton={editIcon}
          />
        }
      />

      {/* Sponsorship Modal */}
      {canSponsor && userbaseUserId && sponsorHiveUsername && (
        <SponsorshipModal
          isOpen={isSponsorModalOpen}
          onClose={() => setIsSponsorModalOpen(false)}
          liteUserId={userbaseUserId}
          liteUserHandle={username}
          liteUserDisplayName={profileData.name || username}
          sponsorHiveUsername={sponsorHiveUsername}
        />
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
