"use client";

import { useEffect, useMemo, useState } from "react";
import { Discussion } from "@hiveio/dhive";
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

// The map and globe views want every spot at once — not the SpotList's
// 10-per-page pagination. We fetch a single large batch directly. 500 is
// the same ceiling SpotNearYou already uses against the same endpoint.
const FETCH_LIMIT = 500;

/**
 * Fetches the full skatespot feed and yields only those with parseable
 * lat/lng (via parseSpotBody, which also handles Google Maps URLs).
 */
export function useGeoSpots() {
  const [spots, setSpots] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/skatespots?page=1&limit=${FETCH_LIMIT}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.success && Array.isArray(data.data)) {
          setSpots(data.data as Discussion[]);
        } else {
          throw new Error(data?.error || "Failed to load spots");
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load spots");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
    geoSpots,
    isLoading,
    error,
  };
}
