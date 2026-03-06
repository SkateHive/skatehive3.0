"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import { Global } from "@emotion/react";
import { useTranslations } from "@/contexts/LocaleContext";
import SpotSnapComposer from "@/components/spotmap/SpotSnapComposer";
import SpotList from "@/components/spotmap/SpotList";
import { useSkatespots } from "@/hooks/useSkatespots";
import { Discussion } from "@hiveio/dhive";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";

const DEFAULT_MAP_SRC =
  "https://www.google.com/maps/d/u/1/embed?mid=1iiXzotKL-uJ3l7USddpTDvadGII&hl=en&ll=29.208380630280647%2C-100.5437214508988&z=4";

function buildMapSrc(lat?: number, lng?: number, zoom?: number): string {
  const base = "https://www.google.com/maps/d/u/1/embed?mid=1iiXzotKL-uJ3l7USddpTDvadGII&hl=en";
  const ll = lat && lng ? `&ll=${lat}%2C${lng}` : "&ll=29.208380630280647%2C-100.5437214508988";
  const z = `&z=${zoom || 4}`;
  return `${base}${ll}${z}`;
}

interface EmbeddedMapProps {
  initialLat?: number;
  initialLng?: number;
  initialZoom?: number;
  useGeolocation?: boolean;
  fullHeight?: boolean;
}

export default function EmbeddedMap({
  initialLat,
  initialLng,
  initialZoom,
  useGeolocation = false,
  fullHeight = false,
}: EmbeddedMapProps = {}) {
  const t = useTranslations('map');
  const boxWidth = useBreakpointValue({
    base: "90%",
    sm: "80%",
    md: "75%",
    lg: "100%",
  });
  const paddingX = useBreakpointValue({ base: 2, sm: 4, md: 6 });
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [newSpot, setNewSpot] = useState<Discussion | null>(null);
  const [composerKey, setComposerKey] = useState<number>(0);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { canUseAppFeatures } = useEffectiveHiveUser();

  // Dynamic map source based on geolocation or initial coords
  const [mapSrc, setMapSrc] = useState(
    buildMapSrc(initialLat, initialLng, initialZoom)
  );
  const [locationStatus, setLocationStatus] = useState<string | null>(
    useGeolocation ? "detecting" : null
  );

  useEffect(() => {
    if (!useGeolocation || typeof window === "undefined") return;
    if (!navigator.geolocation) {
      setLocationStatus(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapSrc(buildMapSrc(latitude, longitude, 11));
        setLocationStatus("found");
        // Clear status after 3s
        setTimeout(() => setLocationStatus(null), 3000);
      },
      () => {
        // User denied or error — fall back to default
        setLocationStatus(null);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [useGeolocation]);

  const {
    spots: allSpots,
    isLoading,
    hasMore,
    loadNextPage,
    error,
    refresh,
  } = useSkatespots();

  // Debug: Track newSpot changes (client-side only)
  useEffect(() => {
    if (typeof window !== "undefined") {
    }
  }, [newSpot]);

  // Handler to accept Partial<Discussion> and cast to Discussion
  const handleNewSpot = (newComment: Partial<Discussion>) => {
    if (typeof window !== "undefined") {
    }
    setNewSpot(newComment as Discussion); // Optimistic update, safe for UI
    // Clear the newSpot after 5 seconds to prevent conflicts
    setTimeout(() => {
      if (typeof window !== "undefined") {
      }
      setNewSpot(null);
    }, 5000);
  };

  const handleClose = () => {
    setComposerKey((k: number) => k + 1); // force reset by changing key
  };

  // Only redirect scroll on desktop
  const handleMapSideWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      // Only apply on md and up
      if (window.innerWidth < 768) return;
      // If the event is from the iframe, do nothing
      if (
        e.target instanceof HTMLIFrameElement ||
        (e.target as HTMLElement)?.closest("iframe")
      ) {
        return;
      }
      // Prevent default scroll on map side
      e.preventDefault();
      // Scroll the sidebar
      if (sidebarRef.current) {
        sidebarRef.current.scrollTop += e.deltaY;
      }
    },
    []
  );

  return (
    <>
      <Box height="auto" overflow="visible">
        {/* Compact Header */}
        <Box
          position={{ base: "relative", md: "sticky" }}
          top={{ base: "auto", md: 0 }}
          zIndex={10}
          bg="background"
          backdropFilter={{ base: "none", md: "blur(10px)" }}
        >
          <Flex
            p={{ base: 3, md: 4 }}
            pb={{ base: 2, md: 2 }}
            align="center"
            justify="center"
            gap={4}
          >
            <Heading
              as="h1"
              fontSize={{ base: "2xl", sm: "3xl", md: "4xl" }}
              fontWeight="extrabold"
              color="primary"
              letterSpacing="wide"
              textAlign="center"
            >
              🗺️ {t('title')}
            </Heading>

            {canUseAppFeatures && (
              <Button
                size="sm"
                bg="transparent"
                color="primary"
                border="1px solid"
                borderColor="primary"
                borderRadius="md"
                px={4}
                fontWeight="bold"
                fontSize="sm"
                _hover={{ bg: "primary", color: "background" }}
                onClick={() => {
                  const el = document.getElementById("spot-name-field");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                    el.focus();
                  }
                }}
              >
                + {t('addASpot')}
              </Button>
            )}
          </Flex>

          {/* Location status indicator */}
          {locationStatus && (
            <Box
              w="100%"
              textAlign="center"
              pb={2}
              color="primary"
              fontSize="xs"
              fontWeight="bold"
              opacity={0.8}
            >
              {locationStatus === "detecting" ? "📍 Detecting your location..." : "✅ Showing spots near you!"}
            </Box>
          )}
        </Box>

        {/* Main Content Section — Map takes priority */}
        <Flex
          height={{ base: "auto", md: fullHeight ? "75vh" : "70vh" }}
          flexDirection={{ base: "column", md: "row" }}
          align="stretch"
          p={{ base: 2, md: 4 }}
          pt={0}
          w="100%"
          mx="auto"
          gap={{ base: 2, md: 4 }}
        >
          {/* Map Section — dominant */}
          <Box
            flex="3"
            minW={0}
            w={{ base: "100%", md: "70%" }}
            height={{ base: "60vh", md: "100%" }}
            borderRadius="lg"
            overflow="hidden"
            position="relative"
            border="2px solid"
            borderColor="primary"
            boxShadow="0 0 20px rgba(167, 255, 0, 0.15)"
            onWheel={isMobile ? undefined : handleMapSideWheel}
          >
            <iframe
              src={mapSrc}
              style={{
                border: "none",
                width: "100%",
                height: "100%",
                display: "block",
              }}
              allowFullScreen
            ></iframe>
          </Box>

          {/* Sidebar Section — Composer */}
          <Box
            flex="1"
            minW={{ md: "300px" }}
            maxW={{ md: "380px" }}
            w={{ base: "100%", md: "30%" }}
            height={{ base: "auto", md: "100%" }}
            overflowY={{ base: "visible", md: "auto" }}
            bg="rgba(0,0,0,0.2)"
            borderRadius="lg"
            border="1px solid"
            borderColor="whiteAlpha.100"
            sx={{
              "&::-webkit-scrollbar": { width: "4px" },
              "&::-webkit-scrollbar-thumb": { bg: "primary", borderRadius: "2px" },
            }}
          >
            <SpotSnapComposer
              onNewComment={handleNewSpot}
              onClose={handleClose}
            />
          </Box>
        </Flex>

        {/* Spot List Section - 3 Column Grid */}
        <Box p={4} pt={0}>
          {error && (
            <Box
              textAlign="center"
              my={4}
              p={4}
              bg="red.50"
              borderRadius="none"
              border="1px solid"
              borderColor="red.200"
            >
              <Text color="red.600" fontWeight="bold">
                {t('errorLoadingSpots')}
              </Text>
              <Text color="red.500">{error}</Text>
            </Box>
          )}
          <SpotList
            spots={allSpots}
            newSpot={newSpot}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={loadNextPage}
          />
        </Box>
      </Box>
    </>
  );
}
