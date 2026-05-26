import { NextRequest, NextResponse } from "next/server";
import { getSpotmapSupabase, type SpotmapRow } from "@/lib/spotmap/supabase";

// Read endpoint for the synced spot map. One query, no pagination —
// the map and globe views want everything at once.
export async function GET(_request: NextRequest) {
  const supabase = getSpotmapSupabase();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Spot map backend not configured" },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("spotmap_spots")
    .select(
      "id, source, source_id, name, lat, lng, address, thumbnail, " +
        "hive_author, hive_permlink, hive_created, kml_description"
    )
    .order("hive_created", { ascending: false, nullsFirst: false })
    .limit(10000);

  if (error) {
    console.error("[GET /api/spotmap] query failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to load spots" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, count: data?.length ?? 0, spots: data ?? [] as Partial<SpotmapRow>[] },
    {
      headers: {
        // Edge-cache — sync is manual so freshness pressure is low.
        // Bumped from 60s to 300s; observed 100% MISS rate previously.
        "Cache-Control": "public, max-age=120, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
