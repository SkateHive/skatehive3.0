import "server-only";
import { getSpotmapSupabase } from "./supabase";

export interface FeaturedSpot {
  id: string;
  source: "hive" | "google_my_maps";
  name: string;
  lat: number;
  lng: number;
  thumbnail: string | null;
  hive_author: string | null;
  hive_permlink: string | null;
  hive_created: string | null;
  distance_km?: number;
}

const SELECT_COLS =
  "id, source, name, lat, lng, thumbnail, hive_author, hive_permlink, hive_created";

/**
 * Returns a spot to render on the homepage SSR before the client widget
 * mounts and starts its geo-aware fetch. Doesn't try to be smart — picks
 * randomly out of the 30 newest spots with a thumbnail. The client will
 * upgrade the selection (with geolocation + seen-id exclusion) as soon
 * as it has the user's coords, so this only needs to look reasonable
 * for the first paint.
 *
 * Returns null if Supabase isn't configured locally — the widget
 * gracefully falls back to its skeleton in that case.
 */
export async function getInitialFeaturedSpot(): Promise<FeaturedSpot | null> {
  const supabase = getSpotmapSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("spotmap_spots")
    .select(SELECT_COLS)
    .not("thumbnail", "is", null)
    .order("hive_created", { ascending: false, nullsFirst: false })
    .limit(30);

  if (error || !data || data.length === 0) return null;
  return data[Math.floor(Math.random() * data.length)] as FeaturedSpot;
}
