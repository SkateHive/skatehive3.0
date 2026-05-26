"use client";

import React, { memo, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Spinner, Flex, Button, Text } from "@chakra-ui/react";
import type { DivIcon } from "leaflet";
import { useGeoSpots, type GeoSpot } from "@/hooks/useGeoSpots";
import { getPostDate } from "@/lib/utils/GetPostDate";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./LeafletWorldMap.css";

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
// Dynamic import — types are intentionally `any` because react-leaflet-markercluster's
// default export is dynamically loaded and its prop types don't survive the dynamic() wrapper.
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-markercluster").then((m) => m.default),
  { ssr: false }
) as unknown as React.ComponentType<Record<string, unknown> & { children?: React.ReactNode }>;

const DEFAULT_CENTER: [number, number] = [29.2083, -100.5437];
const DEFAULT_ZOOM = 3;

// Hostnames whose images can't be hot-linked from skatehive.app. We still
// keep the thumbnail URL in the DB (might be useful elsewhere), but the
// popup skips rendering them up-front to avoid the broken-image flash.
const UNLOADABLE_IMAGE_HOSTS = ["googleusercontent.com", "lh3.googleusercontent.com"];

function isLikelyLoadable(url: string | null): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return !UNLOADABLE_IMAGE_HOSTS.some((host) => u.hostname.endsWith(host));
  } catch {
    return false;
  }
}

interface SpotMarkerProps {
  spot: GeoSpot;
  icon: DivIcon;
}

const SpotMarker = memo(function SpotMarker({ spot, icon }: SpotMarkerProps) {
  const isHive = spot.source === "hive" && spot.hiveAuthor && spot.hivePermlink;
  const ctaHref = isHive
    ? `/spot/${spot.hiveAuthor}/${spot.hivePermlink}`
    : `https://www.google.com/maps?q=${spot.lat},${spot.lng}`;
  const ctaLabel = isHive ? "View spot →" : "Open in Google Maps →";
  const ctaTarget = isHive ? undefined : "_blank";
  const ctaRel = ctaTarget ? "noopener noreferrer" : undefined;

  const meta = isHive ? (
    <>
      by{" "}
      <a href={`/user/${spot.hiveAuthor}`}>@{spot.hiveAuthor}</a>
      {spot.created && <> · {getPostDate(spot.created)}</>}
    </>
  ) : (
    <>Google My Maps</>
  );

  return (
    <Marker
      // @ts-ignore — react-leaflet types only resolve after dynamic import
      position={[spot.lat, spot.lng]}
      icon={icon}
    >
      <Popup
        // @ts-ignore
        closeButton
        autoPan
        maxWidth={260}
      >
        <div>
          {isLikelyLoadable(spot.thumbnail) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="spot-popup-image"
              src={spot.thumbnail!}
              alt={spot.name}
              loading="lazy"
              onError={(e) => {
                // Hide silently — broken-image icon is uglier than nothing.
                (e.currentTarget as HTMLImageElement).classList.add("spot-popup-image-hidden");
              }}
            />
          )}
          <div className="spot-popup-body">
            <div className="spot-popup-title">{spot.name}</div>
            <div className="spot-popup-meta">{meta}</div>
            <a href={ctaHref} target={ctaTarget} rel={ctaRel} className="spot-popup-cta">
              {ctaLabel}
            </a>
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

interface LeafletWorldMapProps {
  useGeolocation?: boolean;
}

export default function LeafletWorldMap({ useGeolocation = false }: LeafletWorldMapProps) {
  const { geoSpots, isLoading } = useGeoSpots();
  const [icon, setIcon] = useState<DivIcon | null>(null);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [locating, setLocating] = useState(false);

  // Build the divIcon once on the client. Default Leaflet markers ship with
  // broken icon URLs under bundlers; a custom divIcon sidesteps that and
  // also gives us the green pin matching the rest of the UI.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      setIcon(
        L.divIcon({
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
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Optional geolocation auto-center (used by /map/near-me if/when we route it here)
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

  // Memoise the marker list so cluster recomputation doesn't redo all the
  // popup React work on every state change.
  const markers = useMemo(() => {
    if (!icon) return null;
    return geoSpots.map((spot) => (
      <SpotMarker key={spot.id} spot={spot} icon={icon} />
    ));
  }, [geoSpots, icon]);

  return (
    <Box position="relative">
      <Box
        className="skatehive-leaflet"
        w="100%"
        height={{ base: "60vh", md: "70vh" }}
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
          style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
          worldCopyJump
          attributionControl={false}
          preferCanvas
        >
          <TileLayer
            // @ts-ignore
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            noWrap
          />
          {markers && (
            <MarkerClusterGroup
              // @ts-ignore — types differ slightly across versions
              chunkedLoading
              showCoverageOnHover={false}
              maxClusterRadius={50}
              spiderfyOnMaxZoom
            >
              {markers}
            </MarkerClusterGroup>
          )}
        </MapContainer>

        {/* Locate button */}
        <Button
          position="absolute"
          top={3}
          right={3}
          zIndex={400}
          size="sm"
          bg="rgba(10,10,10,0.85)"
          color="primary"
          border="1px solid"
          borderColor="primary"
          _hover={{ bg: "primary", color: "background" }}
          onClick={requestLocate}
          isLoading={locating}
          loadingText="Locating…"
          boxShadow="0 2px 8px rgba(0,0,0,0.4)"
        >
          📍 Near Me
        </Button>

        {isLoading && (
          <Flex
            position="absolute"
            top={3}
            left={12}
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
        Showing {geoSpots.length} spots with coordinates. Tiles &copy; OpenStreetMap, CARTO.
      </Text>
    </Box>
  );
}
