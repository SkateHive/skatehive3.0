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
  useDisclosure,
} from "@chakra-ui/react";
// Global removed — no longer needed
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
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [newSpot, setNewSpot] = useState<Discussion | null>(null);
  const [composerKey, setComposerKey] = useState<number>(0);
  // sidebarRef removed — composer is now in a modal
  const { canUseAppFeatures } = useEffectiveHiveUser();
  const { isOpen, onOpen, onClose: onModalClose } = useDisclosure();

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
    onModalClose(); // close the dialog
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
            <Flex justify="center" gap={3} align="center">
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
                onClick={onOpen}
              >
                + {t('addASpot')}
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
        <Modal isOpen={isOpen} onClose={onModalClose} size="lg" isCentered>
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
