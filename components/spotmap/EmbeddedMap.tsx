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
      <Global
        styles={`
          @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(5px); }
            100% { transform: translateY(0); }
          }
          @keyframes glow {
            0% { text-shadow: 0 0 5px var(--chakra-colors-background), 0 0 10px var(--chakra-colors-background), 0 0 15px var(--chakra-colors-background), 0 0 20px var(--chakra-colors-background), 0 0 25px var(--chakra-colors-background); color: var(--chakra-colors-text); }
            50% { text-shadow: 0 0 10px var(--chakra-colors-text), 0 0 20px var(--chakra-colors-text), 0 0 30px var(--chakra-colors-text), 0 0 40px var(--chakra-colors-text), 0 0 50px var(--chakra-colors-text); color: var(--chakra-colors-background); }
            100% { text-shadow: 0 0 5px var(--chakra-colors-background), 0 0 10px var(--chakra-colors-background), 0 0 15px var(--chakra-colors-background), 0 0 20px var(--chakra-colors-background), 0 0 25px var(--chakra-colors-background); color: var(--chakra-colors-text); }
          }
        `}
      />
      <Box height="auto" overflow="visible">
        {/* Header Section */}
        <Box
          position={{ base: "relative", md: "sticky" }}
          top={{ base: "auto", md: 0 }}
          zIndex={10}
          bg="background"
          borderBottom="1px solid"
          borderColor="muted"
          backdropFilter={{ base: "none", md: "blur(10px)" }}
        >
          {/* Header Section */}
          <Box p={{ base: 3, md: 4 }} pt={{ base: 2, md: 0 }} pb={0}>
            <Text
              className="fretqwik-title"
              fontSize={{ base: "4xl", sm: "5xl", md: "7xl" }}
              fontWeight="extrabold"
              color="primary"
              letterSpacing={{ base: "wide", md: "widest" }}
              textAlign="center"
              mt={{ base: 0, md: -4 }}
              style={{
                lineHeight: 1.1,
                maxWidth: "100%",
                wordBreak: "break-word",
                overflowWrap: "break-word",
              }}
            >
              {t('title')}
            </Text>
          </Box>

          {/* Add Spot Button Section */}
          {canUseAppFeatures && (
            <Box
              p={{ base: 3, md: 4 }}
              pt={{ base: 3, md: 6 }}
              pb={{ base: 3, md: 2 }}
              textAlign="center"
            >
              <Button
                bg="background"
                color="primary"
                borderRadius="none"
                px={{ base: 6, md: 4 }}
                py={{ base: 3, md: 2 }}
                fontWeight="bold"
                fontSize={{ base: "lg", md: "md" }}
                boxShadow="md"
                _hover={{ bg: "primary", color: "background" }}
                onClick={() => {
                  const el = document.getElementById("spot-name-field");
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                    el.focus();
                  }
                }}
              >
                {t('addASpot')}
              </Button>
            </Box>
          )}
        </Box>

        {/* Main Content Section */}
        <Flex
          height={{ base: "auto", md: fullHeight ? "700px" : "600px" }}
          flexDirection={{ base: "column", md: "row" }}
          align="flex-start"
          justifyContent="center"
          p={4}
          pt={0}
          w="100%"
          mx="auto"
          gap={0}
        >
          {/* Location status indicator */}
          {locationStatus === "detecting" && (
            <Box
              w="100%"
              textAlign="center"
              py={2}
              color="primary"
              fontSize="sm"
              fontWeight="bold"
            >
              📍 Detecting your location...
            </Box>
          )}
          {locationStatus === "found" && (
            <Box
              w="100%"
              textAlign="center"
              py={2}
              color="primary"
              fontSize="sm"
              fontWeight="bold"
            >
              ✅ Showing spots near you!
            </Box>
          )}

          {/* Map Section */}
          <Box
            flex="2"
            minW={0}
            w={{ base: "100%", md: "65%" }}
            height={{ base: "auto", md: "100%" }}
            aspectRatio={{ base: "1 / 1", md: "auto" }}
            overflow="visible"
            borderRadius="10px"
            width="100%"
            mx="auto"
            mb={{ base: 2, md: 6 }}
            onWheel={isMobile ? undefined : handleMapSideWheel}
          >
            <Box
              p={{ base: 2, md: 4 }}
              pt={0}
              textAlign="center"
              width="100%"
              height="100%"
            >
              <iframe
                src={mapSrc}
                style={{
                  border: "5px solid var(--chakra-colors-primary, black)",
                  width: "100%",
                  height: "100%",
                  padding: 0,
                  margin: "auto",
                  boxShadow:
                    "0px 4px 10px var(--chakra-colors-muted, rgba(0, 0, 0, 0.5))",
                  display: "block",
                }}
                allowFullScreen
              ></iframe>
            </Box>
          </Box>

          {/* Sidebar Section - Only Composer */}
          <Box
            flex="1"
            minW={{ md: "340px" }}
            maxW={{ md: "420px" }}
            w={{ base: "100%", md: "35%" }}
            ml={{ base: 0, md: 8 }}
            mt={{ base: 0, md: 0 }}
            mb={{ base: 0, md: 8 }}
            mx={{ base: "auto", md: 0 }}
            display={{ base: "block", md: "block" }}
            height={{ base: "auto", md: "100%" }}
            overflowY="visible"
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
