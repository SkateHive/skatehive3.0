"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  useBreakpointValue,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  IconButton,
  HStack,
  useDisclosure,
} from "@chakra-ui/react";
import { MdAdd, MdRemove, MdFullscreen, MdOpenInNew } from "react-icons/md";
import { useTranslations } from "@/contexts/LocaleContext";
import SpotSnapComposer from "@/components/spotmap/SpotSnapComposer";
import SpotList from "@/components/spotmap/SpotList";
import { useSkatespots } from "@/hooks/useSkatespots";
import { Discussion } from "@hiveio/dhive";
import useEffectiveHiveUser from "@/hooks/useEffectiveHiveUser";

const DEFAULT_MAP_SRC =
  "https://www.google.com/maps/d/u/1/embed?mid=1iiXzotKL-uJ3l7USddpTDvadGII&hl=en&ll=29.208380630280647%2C-100.5437214508988&z=4";

function buildMapSrc(lat?: number, lng?: number, zoom?: number): string {
  const base =
    "https://www.google.com/maps/d/u/1/embed?mid=1iiXzotKL-uJ3l7USddpTDvadGII&hl=en";
  const ll =
    lat != null && lng != null
      ? `&ll=${lat}%2C${lng}`
      : "&ll=29.208380630280647%2C-100.5437214508988";
  const z = `&z=${zoom ?? 4}`;
  return `${base}${ll}${z}`;
}

function buildMapViewerUrl(lat?: number, lng?: number, zoom?: number): string {
  const base =
    "https://www.google.com/maps/d/u/1/viewer?mid=1iiXzotKL-uJ3l7USddpTDvadGII&hl=en";
  const ll =
    lat != null && lng != null
      ? `&ll=${lat}%2C${lng}`
      : "&ll=29.208380630280647%2C-100.5437214508988";
  const z = `&z=${zoom ?? 4}`;
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
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [newSpot, setNewSpot] = useState<Discussion | null>(null);
  const [composerKey, setComposerKey] = useState<number>(0);
  // sidebarRef removed — composer is now in a modal
  const { canUseAppFeatures } = useEffectiveHiveUser();

  // Dynamic map source based on geolocation or initial coords
  const defaultCenter = {
    lat: initialLat ?? 29.208380630280647,
    lng: initialLng ?? -100.5437214508988,
  };
  const defaultZoom = initialZoom ?? 4;

  const [center, setCenter] = useState(defaultCenter);
  const [zoom, setZoom] = useState<number>(defaultZoom);
  const [mapSrc, setMapSrc] = useState(buildMapSrc(center.lat, center.lng, zoom));
  const [locationStatus, setLocationStatus] = useState<string | null>(
    useGeolocation ? "detecting" : null
  );
  const [isNearMe, setIsNearMe] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  // Composer dialog
  const {
    isOpen: isComposerOpen,
    onOpen: onComposerOpen,
    onClose: onComposerClose,
  } = useDisclosure();
  // Map fullscreen dialog (helps mobile + no scroll wheel)
  const {
    isOpen: isMapOpen,
    onOpen: onMapOpen,
    onClose: onMapClose,
  } = useDisclosure();

  // Keep iframe src in sync with our center/zoom state
  useEffect(() => {
    setMapSrc(buildMapSrc(center.lat, center.lng, zoom));
  }, [center.lat, center.lng, zoom]);

  // Auto-detect on /near-me page
  useEffect(() => {
    if (!useGeolocation || typeof window === "undefined") return;
    if (!navigator.geolocation) {
      setLocationStatus(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        setCenter({ lat: latitude, lng: longitude });
        setZoom(11);
        setIsNearMe(true);
        setLocationStatus("found");
        setTimeout(() => setLocationStatus(null), 3000);
      },
      () => {
        setLocationStatus(null);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [useGeolocation]);

  // Toggle Near Me — request geolocation or zoom out
  const handleNearMeToggle = () => {
    if (isNearMe) {
      setCenter(defaultCenter);
      setZoom(defaultZoom);
      setIsNearMe(false);
      return;
    }

    // If we already have coords, just re-center
    if (userCoords) {
      setCenter({ lat: userCoords.lat, lng: userCoords.lng });
      setZoom(11);
      setIsNearMe(true);
      return;
    }

    // Request geolocation
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        setCenter({ lat: latitude, lng: longitude });
        setZoom(11);
        setIsNearMe(true);
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  const zoomIn = () => setZoom((z) => Math.min(18, z + 1));
  const zoomOut = () => setZoom((z) => Math.max(2, z - 1));

  const openInNewTab = () => {
    if (typeof window === "undefined") return;
    const url = buildMapViewerUrl(center.lat, center.lng, zoom);
    window.open(url, "_blank");
  };

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
    onComposerClose(); // close the dialog
  };


  return (
    <>
      <Box height="auto" overflow="visible">
        {/* Header — SEO-friendly with visible text */}
        <Box
          position={{ base: "relative", md: "sticky" }}
          top={{ base: "auto", md: 0 }}
          zIndex={10}
          bg="background"
          backdropFilter={{ base: "none", md: "blur(10px)" }}
          borderBottom="1px solid"
          borderColor="whiteAlpha.100"
        >
          <Box textAlign="center" p={{ base: 3, md: 4 }} pb={1}>
            <Heading
              as="h1"
              className="fretqwik-title"
              fontSize={{ base: "3xl", sm: "4xl", md: "5xl" }}
              fontWeight="extrabold"
              color="primary"
              letterSpacing={{ base: "wide", md: "wider" }}
              mb={1}
            >
              {t('title')}
            </Heading>
            <Text color="gray.400" fontSize={{ base: "xs", md: "sm" }} mb={2}>
              Find skateparks, street spots &amp; DIY spots worldwide — built by skaters, for skaters
            </Text>
            <Flex justify="center" gap={3} align="center" flexWrap="wrap">
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
                onClick={onComposerOpen}
              >
                + {t('addASpot')}
              </Button>
              <Button
                size="sm"
                bg={isNearMe ? "primary" : "transparent"}
                color={isNearMe ? "background" : "primary"}
                border="1px solid"
                borderColor="primary"
                borderRadius="md"
                px={4}
                fontWeight="bold"
                fontSize="sm"
                _hover={{ bg: isNearMe ? "accent" : "primary", color: "background" }}
                onClick={handleNearMeToggle}
                isLoading={geoLoading}
                loadingText="Locating..."
              >
                📍 {isNearMe ? "World View" : "Near Me"}
              </Button>
              {/* Location status indicator */}
              {locationStatus && (
                <Text
                  color="primary"
                  fontSize="xs"
                  fontWeight="bold"
                >
                  {locationStatus === "detecting" ? "📍 Detecting your location..." : "✅ Showing spots near you!"}
                </Text>
              )}
            </Flex>
          </Box>
        </Box>

        {/* Map Section — full width */}
        <Box
          p={{ base: 2, md: 4 }}
          pt={0}
          w="100%"
          mx="auto"
        >
          <Box
            w="100%"
            height={{ base: "65vh", md: fullHeight ? "80vh" : "75vh" }}
            borderRadius="lg"
            overflow="hidden"
            position="relative"
            border="2px solid"
            borderColor="primary"
            boxShadow="0 0 20px rgba(167, 255, 0, 0.15)"
          >
            {/* Map controls (helps mobile + no scroll wheel) */}
            <HStack
              position="absolute"
              top={3}
              right={3}
              zIndex={5}
              spacing={2}
              bg="rgba(0,0,0,0.35)"
              backdropFilter="blur(6px)"
              border="1px solid"
              borderColor="whiteAlpha.200"
              borderRadius="lg"
              p={2}
            >
              <IconButton
                aria-label="Zoom in"
                icon={<MdAdd />}
                size="sm"
                variant="ghost"
                color="primary"
                _hover={{ bg: "whiteAlpha.200" }}
                onClick={zoomIn}
              />
              <IconButton
                aria-label="Zoom out"
                icon={<MdRemove />}
                size="sm"
                variant="ghost"
                color="primary"
                _hover={{ bg: "whiteAlpha.200" }}
                onClick={zoomOut}
              />
              <IconButton
                aria-label="Fullscreen"
                icon={<MdFullscreen />}
                size="sm"
                variant="ghost"
                color="primary"
                _hover={{ bg: "whiteAlpha.200" }}
                onClick={onMapOpen}
              />
              <IconButton
                aria-label="Open in new tab"
                icon={<MdOpenInNew />}
                size="sm"
                variant="ghost"
                color="primary"
                _hover={{ bg: "whiteAlpha.200" }}
                onClick={openInNewTab}
              />
            </HStack>

            {isMobile && (
              <Box
                position="absolute"
                bottom={3}
                left="50%"
                transform="translateX(-50%)"
                zIndex={5}
                px={3}
                py={1}
                bg="rgba(0,0,0,0.35)"
                backdropFilter="blur(6px)"
                borderRadius="full"
                border="1px solid"
                borderColor="whiteAlpha.200"
              >
                <Text fontSize="xs" color="gray.200">
                  Tip: use + / - or fullscreen to zoom
                </Text>
              </Box>
            )}

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
        </Box>

        {/* Add Spot Dialog */}
        <Modal isOpen={isComposerOpen} onClose={onComposerClose} size="lg" isCentered>

          <ModalOverlay bg="rgba(0,0,0,0.7)" backdropFilter="blur(4px)" />
          <ModalContent
            bg="background"
            border="1px solid"
            borderColor="primary"
            borderRadius="xl"
            mx={4}
            maxH="85vh"
            overflowY="auto"
          >
            <ModalHeader
              color="primary"
              fontWeight="bold"
              fontSize="xl"
              pb={0}
            >
              📍 {t('addASpot')}
            </ModalHeader>
            <ModalCloseButton color="gray.400" />
            <ModalBody pb={6}>
              <SpotSnapComposer
                key={composerKey}
                onNewComment={handleNewSpot}
                onClose={handleClose}
              />
            </ModalBody>
          </ModalContent>
        </Modal>

        {/* Map Fullscreen */}
        <Modal isOpen={isMapOpen} onClose={onMapClose} size="full" isCentered motionPreset="none">
          <ModalOverlay bg="rgba(0,0,0,0.8)" backdropFilter="blur(6px)" />
          <ModalContent bg="background" m={0} maxW="100vw" maxH="100vh" h="100vh" w="100vw" overflow="hidden">
            <ModalCloseButton
              size="lg"
              color="white"
              bg="red.600"
              _hover={{ bg: "red.500" }}
              _active={{ bg: "red.700" }}
              borderRadius="lg"
              zIndex={10001}
              top={4}
              right={4}
              position="fixed"
              title="Close"
              boxShadow="xl"
            />
            <ModalBody p={0} h="100vh" w="100vw" position="relative" overflow="hidden">
              <HStack
                position="absolute"
                top={4}
                left={4}
                zIndex={10002}
                spacing={2}
                bg="rgba(0,0,0,0.45)"
                backdropFilter="blur(8px)"
                border="1px solid"
                borderColor="whiteAlpha.200"
                borderRadius="lg"
                p={2}
              >
                <IconButton
                  aria-label="Zoom in"
                  icon={<MdAdd />}
                  size="sm"
                  variant="ghost"
                  color="primary"
                  _hover={{ bg: "whiteAlpha.200" }}
                  onClick={zoomIn}
                />
                <IconButton
                  aria-label="Zoom out"
                  icon={<MdRemove />}
                  size="sm"
                  variant="ghost"
                  color="primary"
                  _hover={{ bg: "whiteAlpha.200" }}
                  onClick={zoomOut}
                />
                <IconButton
                  aria-label="Open in new tab"
                  icon={<MdOpenInNew />}
                  size="sm"
                  variant="ghost"
                  color="primary"
                  _hover={{ bg: "whiteAlpha.200" }}
                  onClick={openInNewTab}
                />
              </HStack>

              <Box
                key={mapSrc}
                as="iframe"
                src={mapSrc}
                w="100%"
                h="100%"
                border="none"
                title="SkateHive Skate Spot Map (Fullscreen)"
                allow="fullscreen"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                sx={{
                  scrollbarWidth: "none",
                  msOverflowStyle: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
              />
            </ModalBody>
          </ModalContent>
        </Modal>

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

          {/* SEO FAQ Section */}
          <Box
            mt={10}
            p={6}
            bg="rgba(20,20,20,0.4)"
            border="1px solid"
            borderColor="whiteAlpha.200"
            borderRadius="lg"
            maxW="4xl"
            mx="auto"
          >
            <Heading as="h2" fontSize="2xl" mb={4} color="primary">
              Skate Map FAQ
            </Heading>
            <Box as="dl" fontSize="sm" color="gray.300">
              <Box mb={4}>
                <Text as="dt" fontWeight="bold" color="white" mb={1}>
                  What is the Skatehive Skate Map?
                </Text>
                <Text as="dd">
                  The Skatehive Skate Map is a community-built interactive map of skateparks, street spots,
                  and DIY spots worldwide. Skaters can add new spots, browse by location, and discover places to skate.
                </Text>
              </Box>
              <Box mb={4}>
                <Text as="dt" fontWeight="bold" color="white" mb={1}>
                  How do I find skate spots near me?
                </Text>
                <Text as="dd">
                  Click the &quot;📍 Near Me&quot; button to use your device&apos;s location and see spots in your area.
                  You can also zoom and pan the map to explore spots in any city worldwide.
                </Text>
              </Box>
              <Box mb={4}>
                <Text as="dt" fontWeight="bold" color="white" mb={1}>
                  Can I add my local skate spot?
                </Text>
                <Text as="dd">
                  Yes! Click &quot;+ Add a Spot&quot; to submit a new skatepark, street spot, or DIY spot.
                  All submissions are stored on the Hive blockchain and shared with the global skate community.
                </Text>
              </Box>
              <Box>
                <Text as="dt" fontWeight="bold" color="white" mb={1}>
                  Is the Skate Map free to use?
                </Text>
                <Text as="dd">
                  Absolutely! The Skatehive Skate Map is free and open to all skaters. It&apos;s built by
                  skaters, for skaters — no ads, no paywalls.
                </Text>
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  );
}
