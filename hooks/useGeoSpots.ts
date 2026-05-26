"use client";

import { useEffect, useMemo, useState } from "react";

export type GeoSpotSource = "hive" | "google_my_maps";

export interface GeoSpot {
  id: string;
  source: GeoSpotSource;
  source_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  thumbnail: string | null;
  // Hive-only — used by the map popup to link to /spot/[author]/[permlink]
  hiveAuthor: string | null;
  hivePermlink: string | null;
  // Google-only — raw HTML description from the KML feature
  kmlDescription: string | null;
}

interface SpotmapRowFromApi {
  id: string;
  source: GeoSpotSource;
  source_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  thumbnail: string | null;
  hive_author: string | null;
  hive_permlink: string | null;
  hive_created: string | null;
  kml_description: string | null;
}

interface SpotmapResponse {
  success: boolean;
  count: number;
  spots: SpotmapRowFromApi[];
  error?: string;
}

/**
 * Reads the unified spot map from /api/spotmap (backed by spotmap_spots
 * in Supabase). Single query, no pagination — Hive and Google My Maps
 * spots come back in one batch ready for the map and globe views.
 */
export function useGeoSpots() {
  const [rows, setRows] = useState<SpotmapRowFromApi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch("/api/spotmap")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<SpotmapResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setRows(data.spots);
        } else {
          throw new Error(data.error ?? "Failed to load spots");
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
    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      source_id: r.source_id,
      name: r.name || "Skate spot",
      lat: r.lat,
      lng: r.lng,
      address: r.address,
      thumbnail: r.thumbnail,
      hiveAuthor: r.hive_author,
      hivePermlink: r.hive_permlink,
      kmlDescription: r.kml_description,
    }));
  }, [rows]);

  return { geoSpots, isLoading, error };
}
