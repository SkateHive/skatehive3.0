"use client";

import React, { memo, useCallback, useState } from "react";
import {
  Avatar,
  Badge,
  Box,
  Flex,
  HStack,
  Link as ChakraLink,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import NextLink from "next/link";
import dynamic from "next/dynamic";
import { FaMapMarkerAlt } from "react-icons/fa";
import { getCountryFlag } from "@/lib/utils/countryData";
import { activityTier, avatarUrl, daysSince } from "@/lib/skaters/directory";
import type { ActivityTier, Skater } from "@/lib/skaters/types";
import type { TranslationFunction } from "@/contexts/LocaleContext";
// FollowButton reaches KeychainSDK and dhive through the broadcast helpers.
// Loading it eagerly put ~600KB of signing code into this page's first load for
// a control that only signed-in viewers can even press, so it is split out.
const FollowButton = dynamic(() => import("@/components/profile/FollowButton"), {
  ssr: false,
});

/** Ring around the avatar: how recently this person actually posted. */
const TIER_COLOR: Record<ActivityTier, string> = {
  active: "primary",
  recent: "accent",
  quiet: "dim",
  dormant: "border",
};

const TIER_LABEL_KEY: Record<ActivityTier, string> = {
  active: "skaters.tierActive",
  recent: "skaters.tierRecent",
  quiet: "skaters.tierQuiet",
  dormant: "skaters.tierDormant",
};

/**
 * "3d", "4mo", "2y" — the same shorthand the leaderboard uses.
 * Only called with days >= 1; the caller renders a translated "posted today"
 * for anything below that, so there is no English literal to reach here.
 */
function formatAge(days: number): string {
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/** "800 m", "12 km", "1,340 km" — precision that matches a city centroid. */
function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString()} km`;
}

function formatCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return String(Math.round(value));
}

interface StatProps {
  value: number;
  label: string;
}

function Stat({ value, label }: StatProps) {
  return (
    <HStack spacing={1} flexShrink={0}>
      <Text fontSize="xs" fontWeight="bold" color="text">
        {formatCount(value)}
      </Text>
      <Text fontSize="xs" color="dim">
        {label}
      </Text>
    </HStack>
  );
}

export interface SkaterCardProps {
  skater: Skater;
  t: TranslationFunction;
  /** Passed in so every card in a render agrees on what "today" means. */
  now: number;
  /** The Hive account a follow broadcasts as, or null when nobody can follow. */
  viewer?: string | null;
  /** Seeded from the viewer's following set, so no per-card lookup is needed. */
  isFollowing?: boolean;
  isLiteUser?: boolean;
  useStoredPostingKey?: boolean;
  /** Reports a follow/unfollow back up so the shared set stays in step. */
  onFollowChange?: (username: string, following: boolean) => void;
  /** Kilometres from the viewer, once they have shared their position. */
  distanceKm?: number | null;
}

function SkaterCardBase({
  skater,
  t,
  now,
  viewer = null,
  isFollowing = false,
  isLiteUser = false,
  useStoredPostingKey = false,
  onFollowChange,
  distanceKm = null,
}: SkaterCardProps) {
  const tier = activityTier(skater, now);
  const days = daysSince(skater.lastPost, now);
  const ringColor = TIER_COLOR[tier];

  // Only the in-flight state is local; the settled answer lives in the parent's
  // following set so it survives this card unmounting on a filter change.
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  const handleFollowingChange = useCallback(
    (following: boolean | null) => {
      onFollowChange?.(skater.username, Boolean(following));
    },
    [onFollowChange, skater.username]
  );

  const place = skater.city
    ? `${skater.city}, ${skater.country}`
    : skater.country || (skater.nowhere ? skater.rawLocation : "");

  // The card is a plain Box, not a link: a button cannot live inside an anchor.
  // The name below is the real link and its ::after overlays the whole card, so
  // the card still reads and clicks as one target while the follow button —
  // lifted above the overlay on its own stacking context — stays clickable.
  return (
    <Box
      position="relative"
      bg="panel"
      border="1px solid"
      borderColor="border"
      borderRadius="lg"
      p={3}
      h="100%"
      transition="transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease"
      _hover={{
        borderColor: "primary",
        transform: "translateY(-2px)",
        boxShadow: "0 0 16px var(--chakra-colors-subtle)",
      }}
      _focusWithin={{ borderColor: "primary" }}
    >
      <Flex gap={3} align="flex-start">
        <Tooltip label={t(TIER_LABEL_KEY[tier])} openDelay={400}>
          <Avatar
            src={avatarUrl(skater.username)}
            name={skater.displayName || skater.username}
            size="md"
            flexShrink={0}
            border="2px solid"
            borderColor={ringColor}
          />
        </Tooltip>

        <Box minW={0} flex="1">
          <ChakraLink
            as={NextLink}
            href={`/user/${skater.username}`}
            fontWeight="bold"
            color="text"
            fontSize="sm"
            noOfLines={1}
            display="block"
            _hover={{ textDecoration: "none", color: "primary" }}
            _focusVisible={{ outline: "2px solid", outlineColor: "primary", outlineOffset: "2px" }}
            _after={{ content: '""', position: "absolute", inset: 0, borderRadius: "lg" }}
          >
            {skater.displayName || skater.username}
          </ChakraLink>
          <Text fontSize="xs" color="dim" noOfLines={1}>
            @{skater.username}
          </Text>

          {place ? (
            <HStack spacing={1} mt={1} minW={0}>
              <Box as="span" fontSize="xs" flexShrink={0} aria-hidden="true">
                {skater.country ? getCountryFlag(skater.country) : "🛸"}
              </Box>
              <FaMapMarkerAlt size={9} aria-hidden="true" />
              <Text fontSize="xs" color="text" opacity={0.8} noOfLines={1}>
                {place}
              </Text>
              {distanceKm !== null && (
                <Text fontSize="xs" color="primary" fontWeight="bold" flexShrink={0}>
                  {formatDistance(distanceKm)}
                </Text>
              )}
            </HStack>
          ) : (
            <Text fontSize="xs" color="dim" mt={1} noOfLines={1}>
              {t("skaters.locationUnknown")}
            </Text>
          )}

          {skater.about && (
            <Text fontSize="xs" color="text" opacity={0.65} noOfLines={2} mt={1.5}>
              {skater.about}
            </Text>
          )}

          <Flex gap={3} mt={2} flexWrap="wrap" align="center">
            {days !== null ? (
              <HStack spacing={1} flexShrink={0}>
                <Box w="6px" h="6px" borderRadius="full" bg={ringColor} aria-hidden="true" />
                <Text fontSize="xs" color="dim">
                  {days < 1 ? t("skaters.postedToday") : `${t("skaters.lastPost")} ${formatAge(days)}`}
                </Text>
              </HStack>
            ) : (
              <Text fontSize="xs" color="dim">
                {t("skaters.neverPosted")}
              </Text>
            )}

            {!!skater.points && <Stat value={skater.points} label={t("skaters.points")} />}
            {!!skater.postCount && <Stat value={skater.postCount} label={t("skaters.posts")} />}
            {!!skater.snapsCount && <Stat value={skater.snapsCount} label={t("skaters.snaps")} />}
            {!skater.points && !skater.postCount && !skater.snapsCount && !!skater.hp && (
              <Stat value={skater.hp} label={t("skaters.hivePower")} />
            )}

            {!!skater.spotCount && (
              <Tooltip label={t("skaters.spotsAdded")} openDelay={400}>
                <HStack spacing={1} flexShrink={0}>
                  <Text fontSize="xs" color="orange.300" aria-hidden="true">
                    ▲
                  </Text>
                  <Text fontSize="xs" fontWeight="bold" color="orange.300">
                    {skater.spotCount}
                  </Text>
                </HStack>
              </Tooltip>
            )}

            {!!skater.nfts && (
              <Badge colorScheme="purple" fontSize="9px" px={1.5}>
                NFT
              </Badge>
            )}
            {!!skater.gnars && (
              <Badge colorScheme="orange" fontSize="9px" px={1.5}>
                GNARS
              </Badge>
            )}
          </Flex>
        </Box>

        {/* Above the link overlay, so clicking Follow does not navigate. */}
        <Box position="relative" zIndex={1} flexShrink={0}>
          <FollowButton
            user={viewer}
            username={skater.username}
            isFollowing={isFollowing}
            isFollowLoading={isFollowLoading}
            onFollowingChange={handleFollowingChange}
            onLoadingChange={setIsFollowLoading}
            isLiteUser={isLiteUser}
            useStoredPostingKey={useStoredPostingKey}
            followLabel={t("skaters.follow")}
            unfollowLabel={t("skaters.unfollow")}
            size="xs"
          />
        </Box>
      </Flex>
    </Box>
  );
}

/**
 * The list re-renders on every keystroke in the search box, so cards that did
 * not change should not re-render. `now` and the follow props are hoisted to
 * the parent precisely so they stay referentially stable across those renders.
 */
export const SkaterCard = memo(
  SkaterCardBase,
  (prev, next) =>
    prev.skater === next.skater &&
    prev.t === next.t &&
    prev.now === next.now &&
    prev.viewer === next.viewer &&
    prev.isFollowing === next.isFollowing &&
    prev.isLiteUser === next.isLiteUser &&
    prev.useStoredPostingKey === next.useStoredPostingKey &&
    prev.onFollowChange === next.onFollowChange &&
    prev.distanceKm === next.distanceKm
);

export default SkaterCard;
