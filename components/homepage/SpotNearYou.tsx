"use client";

import { Badge, Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "@/contexts/LocaleContext";
import type { FeaturedSpot } from "@/lib/spotmap/featured";

// Rolling "already seen" buffer kept in localStorage so the rotation feels
// fresh across page navigations and refreshes. We cap it small — once the
// user has cycled through 10 spots we let the oldest one drop out.
const SEEN_STORAGE_KEY = "spotmap_seen_ids";
const SEEN_BUFFER_SIZE = 10;

interface FeaturedResponse {
  success: boolean;
  spot?: FeaturedSpot;
  isNearby?: boolean;
  pool_size?: number;
  error?: string;
}

interface SpotNearYouProps {
  /**
   * Spot rendered immediately on first paint (from SSR). The client
   * still upgrades the selection with geolocation as soon as it mounts;
   * this just removes the skeleton flash for cold visits.
   */
  initialSpot?: FeaturedSpot | null;
  /**
   * Stretch to fill the parent's height (the image grows to consume extra
   * space). Used on /home so the widget matches the adjacent bounties card
   * height. Off by default (RightSidebar keeps its natural size).
   */
  fill?: boolean;
}

function readSeen(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(-SEEN_BUFFER_SIZE) : [];
  } catch {
    return [];
  }
}

function writeSeen(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SEEN_STORAGE_KEY,
      JSON.stringify(ids.slice(-SEEN_BUFFER_SIZE))
    );
  } catch {
    // localStorage might be disabled (private browsing); silently ignore.
  }
}

function formatDistance(km: number): string {
  if (!Number.isFinite(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export default function SpotNearYou({ initialSpot = null, fill = false }: SpotNearYouProps = {}) {
  const router = useRouter();
  const t = useTranslations("spotWidget");
  const [spot, setSpot] = useState<FeaturedSpot | null>(initialSpot);
  const [isNearby, setIsNearby] = useState(false);
  // No spinner if we got an SSR'd spot — the user already sees content.
  const [isLoading, setIsLoading] = useState(!initialSpot);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoTried, setGeoTried] = useState(false);
  // Seen buffer lives in a ref because every fetch reads it but we never
  // want to re-trigger effects when it changes; localStorage is the
  // source of truth.
  const seenRef = useRef<string[]>([]);

  useEffect(() => {
    const stored = readSeen();
    // Seed the "seen" list with the SSR'd spot so the very first client
    // fetch excludes it — otherwise the widget would often re-pick the
    // same row and the rotation wouldn't feel like a rotation.
    if (initialSpot && !stored.includes(initialSpot.id)) {
      const next = [...stored, initialSpot.id].slice(-SEEN_BUFFER_SIZE);
      seenRef.current = next;
      writeSeen(next);
    } else {
      seenRef.current = stored;
    }
  }, [initialSpot]);

  // Ask for geolocation up front. Errors are silent — random spot is a
  // fine fallback and the homepage isn't the place to nag for permission.
  // The user can opt in later via the small "use my location" link below
  // the buttons if geo failed or wasn't asked.
  const requestGeo = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGeoTried(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoTried(true);
      },
      () => setGeoTried(true),
      { timeout: 5000, maximumAge: 30 * 60_000 }
    );
  }, []);

  useEffect(() => {
    requestGeo();
  }, [requestGeo]);

  // Show the opt-in link once we've tried (or know we can't) and don't
  // have coords. If the user previously denied at the OS/browser level
  // the click won't re-prompt — but that's fine, the link is subtle.
  const showLocationHint = geoTried && !userCoords;

  const fetchFeatured = useCallback(
    async (opts: { excludeCurrent?: boolean } = {}) => {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (userCoords) {
        params.set("lat", userCoords.lat.toFixed(5));
        params.set("lng", userCoords.lng.toFixed(5));
      }
      const excludes = [...seenRef.current];
      if (opts.excludeCurrent && spot?.id && !excludes.includes(spot.id)) {
        excludes.push(spot.id);
      }
      if (excludes.length) {
        params.set("exclude", excludes.slice(-SEEN_BUFFER_SIZE).join(","));
      }

      try {
        const res = await fetch(`/api/spotmap/featured?${params}`);
        const data = (await res.json()) as FeaturedResponse;
        if (data.success && data.spot) {
          setSpot(data.spot);
          setIsNearby(!!data.isNearby);
          const next = [...seenRef.current, data.spot.id].slice(-SEEN_BUFFER_SIZE);
          seenRef.current = next;
          writeSeen(next);
        }
      } catch {
        // Silent — widget just keeps its previous spot.
      } finally {
        setIsLoading(false);
      }
    },
    [userCoords, spot?.id]
  );

  // First fetch happens once geo has settled (succeeded OR explicitly
  // failed). We wait so the very first request includes coords when
  // available, instead of doing two network round-trips.
  useEffect(() => {
    if (!geoTried) return;
    fetchFeatured();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoTried]);

  const spotHref =
    spot?.hive_author && spot?.hive_permlink
      ? `/spot/${spot.hive_author}/${spot.hive_permlink}`
      : null;
  const showSkeleton = isLoading && !spot;

  return (
    <Box
      mt={fill ? 0 : 3}
      h={fill ? "100%" : undefined}
      display={fill ? "flex" : undefined}
      flexDirection={fill ? "column" : undefined}
      borderWidth="1px"
      borderColor="whiteAlpha.200"
      borderRadius="0"
      p={3}
      bg="rgba(20,20,20,0.45)"
    >
      <Flex align="center" justify="space-between" mb={3}>
        <Text fontSize="sm" fontWeight="500" color="primary">
          {t("title")}
        </Text>
        {spotHref && (
          <Button
            size="xs"
            variant="outline"
            borderRadius="0"
            fontSize="11px"
            onClick={() => router.push(spotHref)}
          >
            {t("viewMore")}
          </Button>
        )}
      </Flex>

      {showSkeleton ? (
        <SpotSkeleton />
      ) : spot && spotHref ? (
        <Box
          as="a"
          href={spotHref}
          display={fill ? "flex" : "block"}
          flexDirection={fill ? "column" : undefined}
          flex={fill ? "1" : undefined}
          minH={0}
          cursor="pointer"
          _hover={{ opacity: 0.92 }}
          transition="opacity 0.15s"
          opacity={isLoading ? 0.6 : 1}
        >
          {spot.thumbnail ? (
            <Box position="relative" width="100%" height={fill ? "auto" : "160px"} flex={fill ? "1" : undefined} minHeight="160px" bg="rgba(255,255,255,0.04)">
              <Image
                src={spot.thumbnail}
                alt={spot.name}
                fill
                style={{ objectFit: "cover" }}
                sizes="(max-width: 768px) 100vw, 300px"
                unoptimized={spot.thumbnail.startsWith("https://ipfs.")}
              />
              {isNearby && Number.isFinite(spot.distance_km) && (
                <Badge
                  position="absolute"
                  top={1.5}
                  left={1.5}
                  bg="rgba(0,0,0,0.72)"
                  color="primary"
                  fontSize="10px"
                  fontWeight="800"
                  fontFamily="ui-monospace, monospace"
                  textTransform="none"
                  px={2}
                  py={0.5}
                  borderRadius="full"
                  border="1px solid"
                  borderColor="rgba(167,255,0,0.4)"
                  backdropFilter="blur(4px)"
                >
                  📍 {formatDistance(spot.distance_km!)} · {t("nearYou")}
                </Badge>
              )}
            </Box>
          ) : (
            <Box
              width="100%"
              height="100px"
              bg="rgba(167,255,0,0.04)"
              border="1px dashed"
              borderColor="whiteAlpha.200"
              display="flex"
              alignItems="center"
              justifyContent="center"
              color="gray.500"
              fontSize="xs"
            >
              📍
            </Box>
          )}
          <Text
            fontSize="sm"
            fontWeight="500"
            color="white"
            mt={2}
            mb={2}
            noOfLines={1}
          >
            {spot.name || t("noName")}
          </Text>
        </Box>
      ) : null}

      <HStack spacing={2} mt={2}>
        <Button
          flex={1}
          size="sm"
          variant="outline"
          borderRadius="0"
          fontSize="13px"
          onClick={() => fetchFeatured({ excludeCurrent: true })}
          isLoading={isLoading && !!spot}
          isDisabled={showSkeleton}
        >
          {t("another")}
        </Button>
        <Button
          flex={1}
          size="sm"
          variant="outline"
          borderRadius="0"
          fontSize="13px"
          onClick={() => router.push("/map")}
        >
          {t("viewAllSpots")}
        </Button>
      </HStack>

      {showLocationHint && (
        <Text
          as="button"
          type="button"
          mt={2}
          fontSize="11px"
          color="gray.500"
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.01em"
          textAlign="center"
          width="100%"
          cursor="pointer"
          bg="transparent"
          _hover={{ color: "primary" }}
          onClick={requestGeo}
        >
          📍 {t("useMyLocation")}
        </Text>
      )}
    </Box>
  );
}

// Skeleton shaped like the populated state — image block + title bar —
// so the layout doesn't jump when the real content lands.
function SpotSkeleton() {
  return (
    <Box>
      <Box
        width="100%"
        height="160px"
        bg="rgba(255,255,255,0.05)"
        sx={{
          animation: "spotShimmer 1.4s linear infinite",
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)",
          backgroundSize: "200% 100%",
          "@keyframes spotShimmer": {
            "0%": { backgroundPosition: "200% 0" },
            "100%": { backgroundPosition: "-200% 0" },
          },
        }}
      />
      <Box height="14px" width="65%" bg="rgba(255,255,255,0.06)" mt={2} mb={2} borderRadius="2px" />
    </Box>
  );
}
