"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Button, Center, HStack, Text } from "@chakra-ui/react";
import type { DivIcon, Map as LeafletMap } from "leaflet";
import { avatarUrl, groupByPlace } from "@/lib/skaters/directory";
import type { LatLng } from "@/lib/skaters/geo";
import type { Skater } from "@/lib/skaters/types";
import type { TranslationFunction } from "@/contexts/LocaleContext";
import useSpotmapPins from "@/hooks/useSpotmapPins";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "../spotmap/views/LeafletWorldMap.css";
import "./SkatersMap.css";

// react-leaflet touches `window` at import time, so it is client-only.
const MapContainer = dynamic(() => import("react-leaflet").then((m) => m.MapContainer), {
  ssr: false,
});
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import("react-leaflet").then((m) => m.Marker), { ssr: false });
const Popup = dynamic(() => import("react-leaflet").then((m) => m.Popup), { ssr: false });
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-markercluster").then((m) => m.default),
  { ssr: false }
) as unknown as React.ComponentType<Record<string, unknown> & { children?: React.ReactNode }>;

const DEFAULT_CENTER: [number, number] = [15, -20];
const DEFAULT_ZOOM = 2;
/** Popups list this many people before falling back to a "+N more" line. */
const POPUP_LIST_LIMIT = 8;
/** Zoom the map flies to when the viewer shares their position. */
const NEAR_ME_ZOOM = 9;

/** Pin grows with headcount so Brazil reads differently from a lone rider. */
function pinSize(count: number): number {
  if (count >= 50) return 46;
  if (count >= 20) return 40;
  if (count >= 8) return 34;
  if (count >= 3) return 29;
  return 25;
}

export interface SkatersMapProps {
  skaters: Skater[];
  t: TranslationFunction;
  /** Clicking a pin's heading filters the directory to that country. */
  onSelectCountry: (country: string) => void;
  /** The viewer's position, once they have shared it. */
  origin?: LatLng | null;
}

export default function SkatersMap({ skaters, t, onSelectCountry, origin = null }: SkatersMapProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  // Readiness has to be state, not just the ref: MapContainer arrives through a
  // dynamic import, so on the first pass the ref is still null.
  const [mapReady, setMapReady] = useState(false);
  const [iconFactory, setIconFactory] = useState<((count: number) => DivIcon) | null>(null);
  const [spotIcon, setSpotIcon] = useState<DivIcon | null>(null);
  const [originIcon, setOriginIcon] = useState<DivIcon | null>(null);
  const [showSkaters, setShowSkaters] = useState(true);
  const [showSpots, setShowSpots] = useState(false);

  // Only pulled once the spots layer is switched on — the rows are a few
  // thousand and most visitors never ask for them.
  const { spots, failed: spotsFailed } = useSpotmapPins(showSpots);

  const places = useMemo(() => groupByPlace(skaters), [skaters]);

  // Recentre when the viewer shares their position, so "near me" moves the map
  // and not just the list order. Depends on `mapReady` as well as `origin`:
  // press "Near me" in list view and then switch to Map, and `origin` never
  // changes again — without it the map would sit at the world view.
  useEffect(() => {
    if (!origin || !mapReady || !mapRef.current) return;
    mapRef.current.flyTo([origin[0], origin[1]], NEAR_ME_ZOOM, { duration: 1.2 });
  }, [origin, mapReady]);

  // Leaflet itself can only be imported on the client, so the icons are built
  // after mount rather than at module scope.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled) return;
      const make = (count: number) => {
        const size = pinSize(count);
        return L.divIcon({
          className: "skatehive-skater-marker",
          html: `<div style="
            width:${size}px;height:${size}px;
            background:#a7ff00;color:#0a0a0a;
            border:2px solid #0a0a0a;border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-family:ui-monospace,monospace;font-weight:800;
            font-size:${Math.max(10, Math.floor(size * 0.38))}px;
            box-shadow:0 0 12px rgba(167,255,0,0.45);
          ">${count}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2],
        });
      };
      // Wrapped in a thunk: setState would otherwise call the factory itself.
      setIconFactory(() => make);

      // Spots read as a different kind of thing from people: a warm triangle
      // against the lime circles, so the two layers never blur together.
      setSpotIcon(
        L.divIcon({
          className: "skatehive-spot-marker",
          html: `<div style="
            width:0;height:0;
            border-left:8px solid transparent;
            border-right:8px solid transparent;
            border-bottom:14px solid #ff8a3d;
            filter:drop-shadow(0 0 4px rgba(255,138,61,0.7));
          "></div>`,
          iconSize: [16, 14],
          iconAnchor: [8, 14],
          popupAnchor: [0, -14],
        })
      );

      // Leaflet's default marker needs image assets that do not survive the
      // bundler, so the viewer's own position gets a divIcon like the others.
      setOriginIcon(
        L.divIcon({
          className: "skatehive-origin-marker",
          html: `<div style="
            width:16px;height:16px;
            background:#4da3ff;border:3px solid #ffffff;border-radius:50%;
            box-shadow:0 0 0 4px rgba(77,163,255,0.35);
          "></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
          popupAnchor: [0, -8],
        })
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (places.length === 0) {
    return (
      <Center py={16} border="1px solid" borderColor="border" borderRadius="lg" bg="panel">
        <Text color="dim" fontSize="sm">
          {t("skaters.mapEmpty")}
        </Text>
      </Center>
    );
  }

  return (
    <Box>
      {/* Layer toggles. Spots start off: this is the skaters map, and the
          overlay costs a network round trip nobody asked for by default. */}
      <HStack spacing={2} mb={2} flexWrap="wrap">
        <Button
          size="xs"
          variant={showSkaters ? "solid" : "outline"}
          colorScheme="green"
          aria-pressed={showSkaters}
          onClick={() => setShowSkaters((value) => !value)}
        >
          ◉ {t("skaters.layerSkaters")} ({places.length})
        </Button>
        <Button
          size="xs"
          variant={showSpots ? "solid" : "outline"}
          colorScheme="orange"
          aria-pressed={showSpots}
          onClick={() => setShowSpots((value) => !value)}
        >
          ▲ {t("skaters.layerSpots")}
          {spots ? ` (${spots.length})` : ""}
        </Button>
        {showSpots && !spots && !spotsFailed && (
          <Text fontSize="xs" color="dim">
            {t("skaters.layerSpotsLoading")}
          </Text>
        )}
        {spotsFailed && (
          <Text fontSize="xs" color="dim">
            {t("skaters.layerSpotsFailed")}
          </Text>
        )}
      </HStack>

      <Box
        className="skatehive-leaflet"
        h={{ base: "420px", md: "560px" }}
        borderRadius="lg"
        overflow="hidden"
        border="1px solid"
        borderColor="border"
        position="relative"
      >
        <MapContainer
          // @ts-ignore — react-leaflet types only resolve after the dynamic import
          center={DEFAULT_CENTER}
          zoom={DEFAULT_ZOOM}
          minZoom={2}
          maxBounds={[
            [-85, -180],
            [85, 180],
          ]}
          maxBoundsViscosity={1}
          style={{ width: "100%", height: "100%", background: "#0a0a0a" }}
          worldCopyJump
          attributionControl={false}
          scrollWheelZoom={false}
          ref={(m: LeafletMap | null) => {
            mapRef.current = m;
            setMapReady(Boolean(m));
          }}
        >
          <TileLayer
            // @ts-ignore
            attribution="&copy; Esri, HERE, Garmin, OpenStreetMap contributors"
            url="https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
            noWrap
          />
          <TileLayer
            // @ts-ignore
            url="https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
            noWrap
          />
          {showSkaters && iconFactory && (
            <MarkerClusterGroup
              // @ts-ignore — runtime props of react-leaflet-markercluster
              chunkedLoading
              showCoverageOnHover={false}
              maxClusterRadius={40}
              spiderfyOnMaxZoom
            >
              {places.map((place) => (
                <Marker
                  key={place.id}
                  // @ts-ignore
                  position={place.coords}
                  icon={iconFactory(place.skaters.length)}
                >
                  <Popup>
                    <button
                      type="button"
                      className="skater-popup-title"
                      style={{ background: "none", border: 0, cursor: "pointer", textAlign: "left", width: "100%" }}
                      onClick={() => onSelectCountry(place.country)}
                    >
                      {place.label}
                    </button>
                    <div className="skater-popup-count">
                      {place.skaters.length} {t("skaters.skatersHere")}
                    </div>
                    <ul className="skater-popup-list">
                      {place.skaters.slice(0, POPUP_LIST_LIMIT).map((skater) => (
                        <li key={skater.username}>
                          <a className="skater-popup-row" href={`/user/${skater.username}`}>
                            {/* Fixed-size CDN thumbnail inside a Leaflet popup:
                                next/image buys nothing here and the popup is
                                created outside the normal layout flow. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={avatarUrl(skater.username)}
                              alt=""
                              loading="lazy"
                              width={26}
                              height={26}
                            />
                            <span className="skater-popup-name">
                              {skater.displayName || skater.username}
                            </span>
                            <span className="skater-popup-handle">@{skater.username}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                    {place.skaters.length > POPUP_LIST_LIMIT && (
                      <div className="skater-popup-more">
                        +{place.skaters.length - POPUP_LIST_LIMIT}
                      </div>
                    )}
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}

          {showSpots && spotIcon && spots && (
            <MarkerClusterGroup
              // @ts-ignore — runtime props of react-leaflet-markercluster
              chunkedLoading
              showCoverageOnHover={false}
              maxClusterRadius={50}
              spiderfyOnMaxZoom
            >
              {spots.map((spot) => (
                <Marker
                  key={spot.id}
                  // @ts-ignore
                  position={[spot.lat, spot.lng]}
                  icon={spotIcon}
                >
                  <Popup>
                    <div className="skater-popup-title">{spot.name}</div>
                    {spot.address && <div className="skater-popup-count">{spot.address}</div>}
                    {spot.hiveAuthor && spot.hivePermlink ? (
                      <a className="skater-popup-more" href={`/spot/${spot.hiveAuthor}/${spot.hivePermlink}`}>
                        {t("skaters.viewSpot")} →
                      </a>
                    ) : (
                      <a className="skater-popup-more" href="/map">
                        {t("skaters.viewSpot")} →
                      </a>
                    )}
                  </Popup>
                </Marker>
              ))}
            </MarkerClusterGroup>
          )}

          {/* Where the viewer said they are — no cluster, it is a single point. */}
          {origin && originIcon && (
            <Marker
              // @ts-ignore
              position={[origin[0], origin[1]]}
              icon={originIcon}
            >
              <Popup>
                <div className="skater-popup-title">{t("skaters.youAreHere")}</div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </Box>
      <Text fontSize="xs" color="dim" mt={2}>
        {t("skaters.mapHint")}
      </Text>
    </Box>
  );
}
