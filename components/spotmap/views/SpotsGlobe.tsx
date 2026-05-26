"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Box, Text, Flex, Spinner } from "@chakra-ui/react";
import { useGeoSpots, type GeoSpot } from "@/hooks/useGeoSpots";

const Globe = dynamic(
  () => import("react-globe.gl").then((m) => m.default),
  { ssr: false }
);

interface GlobePoint {
  lat: number;
  lng: number;
  spot: GeoSpot;
}

export default function SpotsGlobe() {
  const { geoSpots, isLoading } = useGeoSpots();
  // react-globe.gl exposes an imperative API; refs are the supported pattern.
  const globeRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const points: GlobePoint[] = useMemo(
    () =>
      geoSpots.map((s) => ({
        lat: s.lat,
        lng: s.lng,
        spot: s,
      })),
    [geoSpots]
  );

  // Build an HTML marker per point. Click navigates to the spot page.
  const htmlElementFn = useCallback((d: object) => {
    const p = d as GlobePoint;
    const el = document.createElement("a");
    el.href = `/spot/${p.spot.author}/${p.spot.permlink}`;
    el.title = p.spot.name;
    el.style.cssText =
      "display:inline-block;cursor:pointer;pointer-events:auto;width:22px;height:22px;";
    el.innerHTML = `<div style="
      width: 22px; height: 22px;
      background: #a7ff00;
      border: 2px solid #0a0a0a;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 0 8px rgba(167,255,0,0.6);
    "></div>`;
    return el;
  }, []);

  // Track container dimensions for the Globe — it doesn't auto-size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Set initial point of view + gentle auto-rotate
  useEffect(() => {
    if (!globeRef.current || size.width === 0) return;
    globeRef.current.pointOfView({ altitude: 1.8 }, 0);
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;
    controls.enableZoom = true;
    controls.minDistance = 200;
    controls.maxDistance = 600;
  }, [size.width]);

  return (
    <Box>
      <Box
        ref={containerRef}
        position="relative"
        w="100%"
        h={{ base: "65vh", md: "75vh" }}
        borderRadius="lg"
        overflow="hidden"
        border="2px solid"
        borderColor="primary"
        boxShadow="0 0 20px rgba(167, 255, 0, 0.15)"
        bg="#000"
      >
        {size.width > 0 && (
          <Globe
            // @ts-ignore — types resolve only after dynamic import
            ref={globeRef}
            width={size.width}
            height={size.height}
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundColor="rgba(0,0,0,0)"
            atmosphereColor="#a7ff00"
            atmosphereAltitude={0.18}
            htmlElementsData={points}
            htmlLat="lat"
            htmlLng="lng"
            htmlAltitude={0.01}
            htmlElement={htmlElementFn}
          />
        )}

        {isLoading && (
          <Flex
            position="absolute"
            top={3}
            left={3}
            zIndex={5}
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
        {points.length} spots plotted. Drag to rotate · scroll to zoom · click a marker to open
      </Text>
    </Box>
  );
}
