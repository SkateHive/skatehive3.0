"use client";

import { useEffect, useState } from "react";

export interface SpotmapPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  source: string;
  address: string | null;
  thumbnail: string | null;
  hiveAuthor: string | null;
  hivePermlink: string | null;
}

interface SpotApiRow {
  id?: string;
  name?: string;
  lat?: number;
  lng?: number;
  source?: string;
  address?: string | null;
  thumbnail?: string | null;
  hive_author?: string | null;
  hive_permlink?: string | null;
}

/**
 * The spot map's rows, fetched only when something actually asks for them.
 *
 * `enabled` is what keeps this honest: the skaters page renders the grid far
 * more often than the map, and the spot table is a few thousand rows, so it is
 * never pulled until the map view is open.
 */
export default function useSpotmapPins(enabled: boolean) {
  const [spots, setSpots] = useState<SpotmapPin[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled || spots || failed) return;
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/spotmap");
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.success || !Array.isArray(data.spots)) {
          throw new Error(data?.error || `Spot map responded ${response.status}`);
        }
        const rows: SpotmapPin[] = (data.spots as SpotApiRow[])
          .filter((row) => typeof row.lat === "number" && typeof row.lng === "number")
          .map((row) => ({
            id: String(row.id),
            name: row.name || "Spot",
            lat: row.lat as number,
            lng: row.lng as number,
            source: row.source || "hive",
            address: row.address ?? null,
            thumbnail: row.thumbnail ?? null,
            hiveAuthor: row.hive_author ?? null,
            hivePermlink: row.hive_permlink ?? null,
          }));
        if (!cancelled) setSpots(rows);
      } catch (error) {
        console.error("[skaters] could not load skate spots:", error);
        // The skaters layer is the point of this map; spots are an overlay, so
        // losing them hides a toggle rather than breaking the view.
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, spots, failed]);

  return { spots, failed };
}
