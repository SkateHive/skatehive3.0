import { NextRequest, NextResponse } from "next/server";
import { getSpotmapSupabase, type SpotmapRow } from "@/lib/spotmap/supabase";
import { withEffectiveThumbnails } from "@/lib/spotmap/thumbnails";

// Single-spot read, mirroring GET /api/spotmap's thumbnail override/fallback
// rules for callers that only need one row (spot detail views, the admin
// thumbnail editor).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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
      "id, source, source_id, name, description, lat, lng, address, thumbnail, thumbnail_override, thumbnail_small, " +
        "images, hive_author, hive_permlink, hive_created, hive_last_update, kml_feature_id, kml_description"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/spotmap/[id]] query failed", error);
    return NextResponse.json(
      { success: false, error: "Failed to load spot" },
      { status: 500 }
    );
  }

  if (!data) {
    return NextResponse.json({ success: false, error: "Spot not found" }, { status: 404 });
  }

  return NextResponse.json(
    { success: true, spot: withEffectiveThumbnails(data as unknown as Partial<SpotmapRow>) },
    {
      headers: {
        "Cache-Control": "public, max-age=60, s-maxage=120, stale-while-revalidate=300",
      },
    }
  );
}
