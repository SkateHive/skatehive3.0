"use client";

import { useMemo } from "react";
import { Discussion } from "@hiveio/dhive";
import { useSkatespots } from "./useSkatespots";
import { parseSpotBody } from "@/lib/utils/parseSpotBody";

export interface GeoSpot {
  author: string;
  permlink: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  thumbnail: string | null;
  created: string;
  discussion: Discussion;
}

/**
 * Wraps `useSkatespots` and filters down to spots that have parseable
 * decimal coordinates. Used by the interactive Leaflet and Globe views.
 */
export function useGeoSpots() {
  const {
    spots,
    isLoading,
    hasMore,
    error,
    loadNextPage,
    refresh,
    currentPage,
  } = useSkatespots();

  const geoSpots = useMemo<GeoSpot[]>(() => {
    const out: GeoSpot[] = [];
    for (const spot of spots) {
      const parsed = parseSpotBody(spot.body);
      if (parsed.lat == null || parsed.lng == null) continue;
      out.push({
        author: spot.author,
        permlink: spot.permlink,
        name: parsed.name || spot.title || "Skate spot",
        lat: parsed.lat,
        lng: parsed.lng,
        address: parsed.address,
        thumbnail: parsed.images[0]?.url ?? null,
        created: spot.created,
        discussion: spot,
      });
    }
    return out;
  }, [spots]);

  return {
    spots,
    geoSpots,
    isLoading,
    hasMore,
    error,
    loadNextPage,
    refresh,
    currentPage,
  };
}
