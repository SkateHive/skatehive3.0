"use client";

import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import {
  Box,
  Button,
  Flex,
  HStack,
  Spinner,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import type { DivIcon, LatLngBounds, Map as LeafletMap } from "leaflet";
import { useGeoSpots, type GeoSpot } from "@/hooks/useGeoSpots";
import MapSpotCard from "../MapSpotCard";
import MobileMapSheet from "../MobileMapSheet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./LeafletWorldMap.css";

// react-leaflet pieces are loaded on the client only.
const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-markercluster").then((m) => m.default),
  { ssr: false }
) as unknown as React.ComponentType<
  Record<string, unknown> & { children?: React.ReactNode }
>;
// useMap is a hook and lives at the value side, so it must be required at runtime
// from a child component rather than dynamic-imported.
const MapBoundsTracker = dynamic(() => import("./MapBoundsTracker"), { ssr: false });

const DEFAULT_CENTER: [number, number] = [20, -30];
const DEFAULT_ZOOM = 2;

interface SpotMarkerProps {
  spot: GeoSpot;
  icon: DivIcon;
  highlightedIcon: DivIcon;
  highlighted: boolean;
  onHover: (id: string | null) => void;
}

const SpotMarker = memo(function SpotMarker({
  spot,
  icon,
  highlightedIcon,
  highlighted,
  onHover,
}: SpotMarkerProps) {
  const isHive = spot.source === "hive" && spot.hiveAuthor && spot.hivePermlink;
  const ctaHref = isHive
    ? `/spot/${spot.hiveAuthor}/${spot.hivePermlink}`
    : `https://www.google.com/maps?q=${spot.lat},${spot.lng}`;
  const ctaLabel = isHive ? "View spot →" : "Open in Google Maps →";
  const ctaTarget = isHive ? undefined : "_blank";
  const ctaRel = ctaTarget ? "noopener noreferrer" : undefined;

  return (
    <Marker
      // @ts-ignore — react-leaflet types resolve only after dynamic import
      position={[spot.lat, spot.lng]}
      icon={highlighted ? highlightedIcon : icon}
      eventHandlers={{
        mouseover: () => onHover(spot.id),
        mouseout: () => onHover(null),
      }}
      zIndexOffset={highlighted ? 1000 : 0}
    >
      <Popup
        // @ts-ignore
        autoPan
        maxWidth={260}
      >
        <div>
          {spot.thumbnail && !spot.thumbnail.includes("googleusercontent.com") && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="spot-popup-image"
              src={spot.thumbnail}
              alt={spot.name}
              loading="lazy"
              onError={(e) =>
                (e.currentTarget as HTMLImageElement).classList.add("spot-popup-image-hidden")
              }
            />
          )}
          <div className="spot-popup-body">
            <div className="spot-popup-title">{spot.name}</div>
            <div className="spot-popup-meta">
              {isHive ? <>by @{spot.hiveAuthor}</> : <>Google My Maps</>}
            </div>
            <a href={ctaHref} target={ctaTarget} rel={ctaRel} className="spot-popup-cta">
              {ctaLabel}
            </a>
          </div>
        </div>
      </Popup>
    </Marker>
  );
});

interface MapWithCardsProps {
  /** Optionally start centered on the user's geolocation. */
  useGeolocation?: boolean;
}

export default function MapWithCards({ useGeolocation = false }: MapWithCardsProps) {
  const { geoSpots, isLoading, error } = useGeoSpots();
  const isMobile = useBreakpointValue({ base: true, lg: false });
  const [icon, setIcon] = useState<DivIcon | null>(null);
  const [highlightedIcon, setHighlightedIcon] = useState<DivIcon | null>(null);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [zoom, setZoom] = useState<number>(DEFAULT_ZOOM);
  const [bounds, setBounds] = useState<LatLngBounds | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const mapRef = useRef<LeafletMap | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const cardScrollerRef = useRef<HTMLDivElement | null>(null);

  // Build the two divIcon variants once on the client (default + highlighted).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      const make = (size: number, glow: string) =>
        L.divIcon({
          className: "skatehive-spot-marker",
          html: `<div style="
            width: ${size}px; height: ${size}px;
            background: #a7ff00;
            border: 2px solid #0a0a0a;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex; align-items: center; justify-content: center;
            box-shadow: ${glow};
          "><span style="transform: rotate(45deg); font-size: ${Math.floor(
            size * 0.5
          )}px;">🛹</span></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size],
          popupAnchor: [0, -size + 2],
        });
      setIcon(make(28, "0 2px 6px rgba(0,0,0,0.45)"));
      setHighlightedIcon(make(38, "0 0 16px rgba(167,255,0,0.9), 0 4px 12px rgba(0,0,0,0.6)"));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Optional auto-locate
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

  const requestLocate = useCallback(() => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const map = mapRef.current;
        if (map) {
          map.flyTo([pos.coords.latitude, pos.coords.longitude], 12, { duration: 0.8 });
        } else {
          setCenter([pos.coords.latitude, pos.coords.longitude]);
          setZoom(12);
        }
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, []);

  // Filter spots to the current viewport. On the very first render bounds is
  // null and we show everything (otherwise the list would be empty until the
  // map fires its first moveend).
  const visibleSpots = useMemo<GeoSpot[]>(() => {
    if (!bounds) return geoSpots;
    return geoSpots.filter((s) => bounds.contains([s.lat, s.lng]));
  }, [geoSpots, bounds]);

  // When a marker is hovered from the map side, scroll the matching card
  // into view in the left rail. Debounced via the rAF tick so rapid
  // mouseover storms don't fight the scroller.
  useEffect(() => {
    if (!hoveredId) return;
    const el = cardRefs.current.get(hoveredId);
    const scroller = cardScrollerRef.current;
    if (!el || !scroller) return;
    const id = requestAnimationFrame(() => {
      const ert = el.getBoundingClientRect();
      const srt = scroller.getBoundingClientRect();
      if (ert.top < srt.top || ert.bottom > srt.bottom) {
        el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [hoveredId]);

  const handleCardSelect = useCallback((spot: GeoSpot) => {
    const map = mapRef.current;
    if (!map || isMobile) return;
    // Pan the map to the spot when the user clicks a card. We don't zoom
    // in past the current level — they may be browsing at a comfortable
    // zoom and just want to peek the location.
    const targetZoom = Math.max(map.getZoom(), 14);
    map.flyTo([spot.lat, spot.lng], targetZoom, { duration: 0.6 });
  }, [isMobile]);

  // Memoised marker list. Cluster recomputation walks this every move so
  // keeping it stable matters.
  const markers = useMemo(() => {
    if (!icon || !highlightedIcon) return null;
    return geoSpots.map((spot) => (
      <SpotMarker
        key={spot.id}
        spot={spot}
        icon={icon}
        highlightedIcon={highlightedIcon}
        highlighted={hoveredId === spot.id}
        onHover={setHoveredId}
      />
    ));
  }, [geoSpots, icon, highlightedIcon, hoveredId]);

  // -- LAYOUT --------------------------------------------------------------

  const mapPane = (
    <Box
      className="skatehive-leaflet"
      position="relative"
      w="100%"
      h="100%"
      borderLeft={{ base: "none", lg: "1px solid" }}
      borderColor={{ base: "transparent", lg: "whiteAlpha.100" }}
      bg="#0a0a0a"
    >
      <MapContainer
        // @ts-ignore — react-leaflet types only resolve after dynamic import
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
        ref={(m: LeafletMap | null) => {
          mapRef.current = m;
        }}
      >
        <TileLayer
          // @ts-ignore
          attribution='&copy; OpenStreetMap, CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          noWrap
        />
        <MapBoundsTracker onBoundsChange={setBounds} />
        {markers && (
          <MarkerClusterGroup
            // @ts-ignore — react-leaflet-markercluster runtime props
            chunkedLoading
            showCoverageOnHover={false}
            maxClusterRadius={50}
            spiderfyOnMaxZoom
          >
            {markers}
          </MarkerClusterGroup>
        )}
      </MapContainer>

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
    </Box>
  );

  const cardList = (
    <Box
      ref={cardScrollerRef}
      h="100%"
      overflowY={{ base: "visible", lg: "auto" }}
      px={{ base: 3, md: 4 }}
      py={{ base: 3, md: 4 }}
      sx={{
        "::-webkit-scrollbar": { width: "8px" },
        "::-webkit-scrollbar-thumb": {
          background: "rgba(167,255,0,0.18)",
          borderRadius: "4px",
        },
        "::-webkit-scrollbar-thumb:hover": {
          background: "rgba(167,255,0,0.35)",
        },
      }}
    >
      {/* Header row */}
      <Flex align="baseline" justify="space-between" mb={3}>
        <HStack spacing={3} align="baseline">
          <Text
            as="h2"
            fontSize="sm"
            color="primary"
            textTransform="uppercase"
            letterSpacing="wide"
            fontWeight="800"
          >
            {bounds ? "Spots in this view" : "All spots"}
          </Text>
        </HStack>
        <Text
          fontSize="xs"
          color="gray.500"
          fontFamily="ui-monospace, monospace"
        >
          {visibleSpots.length} / {geoSpots.length}
        </Text>
      </Flex>

      {isLoading && geoSpots.length === 0 ? (
        <Flex justify="center" py={10}>
          <Spinner color="primary" />
        </Flex>
      ) : error ? (
        <Box
          p={4}
          bg="rgba(255,80,80,0.08)"
          border="1px solid"
          borderColor="red.400"
          borderRadius="md"
          color="red.300"
          fontSize="sm"
        >
          {error}
        </Box>
      ) : visibleSpots.length === 0 ? (
        <Box
          p={6}
          textAlign="center"
          border="1px dashed"
          borderColor="whiteAlpha.200"
          borderRadius="md"
          color="gray.500"
          fontSize="sm"
        >
          No spots in this map view. Try zooming out or panning.
        </Box>
      ) : (
        <Flex direction="column" gap={3}>
          {visibleSpots.map((spot) => (
            <MapSpotCard
              key={spot.id}
              spot={spot}
              highlighted={hoveredId === spot.id}
              onHover={setHoveredId}
              onSelect={handleCardSelect}
              ref={(el) => {
                if (el) cardRefs.current.set(spot.id, el);
                else cardRefs.current.delete(spot.id);
              }}
            />
          ))}
        </Flex>
      )}
    </Box>
  );

  // Mobile: full-screen map with an Airbnb-style draggable bottom sheet
  // holding the list. The sheet starts at "peek" so the map is dominant;
  // the user drags up to "mid" or "full" to browse cards.
  if (isMobile) {
    return (
      <Box position="relative" h="calc(100vh - 150px)" overflow="hidden">
        <Box position="absolute" inset={0}>
          {mapPane}
        </Box>
        <MobileMapSheet initialDetent="peek">{cardList}</MobileMapSheet>
      </Box>
    );
  }

  // Desktop: side-by-side, map sticky on the right.
  return (
    <Flex
      direction="row"
      h="calc(100vh - 180px)"
      minH="500px"
      borderRadius="lg"
      overflow="hidden"
      border="1px solid"
      borderColor="whiteAlpha.100"
      bg="rgba(10,10,10,0.4)"
    >
      <Box flex="0 0 480px" maxW="42vw" minW="360px" h="100%">
        {cardList}
      </Box>
      <Box flex="1" h="100%" position="relative">
        {mapPane}
      </Box>
    </Flex>
  );
}
