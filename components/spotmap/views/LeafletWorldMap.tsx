"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Spinner, Flex, Button, Text } from "@chakra-ui/react";
import type { DivIcon } from "leaflet";
import { useGeoSpots, type GeoSpot } from "@/hooks/useGeoSpots";
import "leaflet/dist/leaflet.css";

// Dynamically import react-leaflet pieces — Leaflet touches `window` on import
// so it must not run during SSR.
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), {
  ssr: false,
});
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), {
  ssr: false,
});

const DEFAULT_CENTER: [number, number] = [29.2083, -100.5437];
const DEFAULT_ZOOM = 3;

interface LeafletWorldMapProps {
  useGeolocation?: boolean;
}

export default function LeafletWorldMap({ useGeolocation = false }: LeafletWorldMapProps) {
  const { geoSpots, isLoading } = useGeoSpots();
  const [icon, setIcon] = useState<DivIcon | null>(null);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [locating, setLocating] = useState(false);

  // Lazy-load leaflet once on the client to build a custom DivIcon.
  // Default markers ship with broken icon URLs under bundlers; a DivIcon
  // sidesteps that entirely.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      const divIcon = L.divIcon({
        className: "skatehive-spot-marker",
        html: `<div style="
          width: 28px; height: 28px;
          background: #a7ff00;
          border: 2px solid #0a0a0a;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 6px rgba(0,0,0,0.45);
        "><span style="transform: rotate(45deg); font-size: 14px;">🛹</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -26],
      });
      setIcon(divIcon);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Optional geolocation auto-center
  useEffect(() => {
    if (!useGeolocation || typeof window === "undefined") return;
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setZoom(11);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [useGeolocation]);

  const requestLocate = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCenter([pos.coords.latitude, pos.coords.longitude]);
        setZoom(12);
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  // Group spots that share identical coordinates so they don't pile on each
  // other invisibly. Leaflet would happily stack them but only the top is
  // clickable — slight jitter would help, though we keep it simple here.
  const spotsForRender = useMemo<GeoSpot[]>(() => geoSpots, [geoSpots]);

  return (
    <Box position="relative">
      <Box
        w="100%"
        height={{ base: "65vh", md: "75vh" }}
        borderRadius="lg"
        overflow="hidden"
        border="2px solid"
        borderColor="primary"
        boxShadow="0 0 20px rgba(167, 255, 0, 0.15)"
        position="relative"
      >
        <MapContainer
          // @ts-ignore — react-leaflet types resolve only after dynamic import
          center={center}
          zoom={zoom}
          minZoom={2}
          maxBounds={[
            [-85, -180],
            [85, 180],
          ]}
          maxBoundsViscosity={1}
          style={{ width: "100%", height: "100%" }}
          worldCopyJump
          attributionControl={false}
        >
          <TileLayer
            // @ts-ignore
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            noWrap
          />
          {icon != null &&
            spotsForRender.map((spot) => (
              <Marker
                // @ts-ignore — runtime fine; types skipped on dynamic import
                key={`${spot.author}-${spot.permlink}`}
                position={[spot.lat, spot.lng]}
                icon={icon}
              >
                <Popup>
                  <Box minW="200px" maxW="240px" color="#111">
                    {spot.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={spot.thumbnail}
                        alt={spot.name}
                        style={{
                          width: "100%",
                          height: "120px",
                          objectFit: "cover",
                          borderRadius: 4,
                          marginBottom: 8,
                        }}
                      />
                    )}
                    <Text fontWeight="bold" fontSize="sm" mb={1} noOfLines={2}>
                      {spot.name}
                    </Text>
                    <Text fontSize="xs" color="gray.600" mb={2}>
                      @{spot.author}
                    </Text>
                    <a
                      href={`/spot/${spot.author}/${spot.permlink}`}
                      style={{
                        display: "inline-block",
                        background: "#a7ff00",
                        color: "#0a0a0a",
                        padding: "6px 10px",
                        borderRadius: 4,
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      View spot →
                    </a>
                  </Box>
                </Popup>
              </Marker>
            ))}
        </MapContainer>

        {/* Locate button */}
        <Button
          position="absolute"
          top={3}
          right={3}
          zIndex={400}
          size="sm"
          bg="background"
          color="primary"
          border="1px solid"
          borderColor="primary"
          _hover={{ bg: "primary", color: "background" }}
          onClick={requestLocate}
          isLoading={locating}
          loadingText="Locating…"
        >
          📍 Near Me
        </Button>

        {isLoading && (
          <Flex
            position="absolute"
            top={3}
            left={3}
            zIndex={400}
            bg="rgba(0,0,0,0.6)"
            color="primary"
            px={3}
            py={1}
            borderRadius="md"
            align="center"
            gap={2}
          >
            <Spinner size="xs" /> Loading spots…
          </Flex>
        )}
      </Box>

      <Text fontSize="xs" color="gray.500" mt={2} textAlign="center">
        Showing {spotsForRender.length} spots with coordinates. Tiles &copy; OpenStreetMap, CARTO.
      </Text>
    </Box>
  );
}
