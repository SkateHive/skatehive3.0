"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import type { LatLngBounds } from "leaflet";

interface MapBoundsTrackerProps {
  onBoundsChange: (bounds: LatLngBounds) => void;
  /** Debounce window in ms — defaults to 150ms to keep panning smooth. */
  debounceMs?: number;
}

/**
 * Child of <MapContainer> that calls `onBoundsChange` whenever the map
 * stops moving, debounced. Used by the Airbnb-style /map view to filter
 * the left rail to spots inside the current viewport.
 */
export default function MapBoundsTracker({
  onBoundsChange,
  debounceMs = 150,
}: MapBoundsTrackerProps) {
  const map = useMap();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // The pane is sized by flex/viewport CSS that may not be resolved on the
    // first Leaflet layout pass. Without this the tile layer stays 0px and
    // the dark wrapper reads as a blank map.
    const fixSize = () => map.invalidateSize();
    const frame = requestAnimationFrame(fixSize);
    const later = window.setTimeout(fixSize, 200);

    const emit = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onBoundsChange(map.getBounds()), debounceMs);
    };
    // Initial bounds so the filter has a value to work with before any pan.
    onBoundsChange(map.getBounds());
    map.on("moveend", emit);
    map.on("zoomend", emit);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(later);
      map.off("moveend", emit);
      map.off("zoomend", emit);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [map, onBoundsChange, debounceMs]);

  return null;
}
