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
    const emit = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => onBoundsChange(map.getBounds()), debounceMs);
    };
    // Initial bounds so the filter has a value to work with before any pan.
    onBoundsChange(map.getBounds());
    map.on("moveend", emit);
    map.on("zoomend", emit);
    return () => {
      map.off("moveend", emit);
      map.off("zoomend", emit);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [map, onBoundsChange, debounceMs]);

  return null;
}
