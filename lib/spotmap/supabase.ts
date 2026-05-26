import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Server-only Supabase client used by the spotmap sync and read routes.
 * Returns null if the deployment is missing env vars (e.g. local dev
 * without Supabase wired up) so callers can short-circuit cleanly.
 */
export function getSpotmapSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type SpotSource = "hive" | "google_my_maps";

export interface SpotmapRow {
  id: string;
  source: SpotSource;
  source_id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  address: string | null;
  thumbnail: string | null;
  images: { url: string; caption: string }[] | null;
  hive_author: string | null;
  hive_permlink: string | null;
  hive_created: string | null;
  hive_last_update: string | null;
  kml_feature_id: string | null;
  kml_description: string | null;
  created_at: string;
  updated_at: string;
  synced_at: string;
}

export interface SpotmapUpsertInput {
  source: SpotSource;
  source_id: string;
  name: string;
  description?: string | null;
  lat: number;
  lng: number;
  address?: string | null;
  thumbnail?: string | null;
  images?: { url: string; caption: string }[] | null;
  hive_author?: string | null;
  hive_permlink?: string | null;
  hive_created?: string | null;
  hive_last_update?: string | null;
  kml_feature_id?: string | null;
  kml_description?: string | null;
}
