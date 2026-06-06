import { NextRequest, NextResponse } from "next/server";
import { requireSpotmapAdmin } from "@/lib/spotmap/auth";
import { syncHiveSpots } from "@/lib/spotmap/syncHive";
import { syncGoogleKmlSpots } from "@/lib/spotmap/syncGoogleKml";
import { logSecurityAttempt } from "@/lib/server/adminUtils";
import { getSpotmapSupabase } from "@/lib/spotmap/supabase";

export const maxDuration = 300; // KML + a deep Hive crawl can take a while on first run.

/**
 * POST /api/admin/spotmap/sync
 *
 * Pulls new Hive skatespots (incremental, by hive_created) and re-pulls
 * the Google My Maps KML feed (full, deduped on KML feature id), upserting
 * everything into spotmap_spots.
 *
 * Body (optional):
 *   { sources?: ("hive" | "google_my_maps")[] }   // default: both
 */
export async function POST(request: NextRequest) {
  const admin = await requireSpotmapAdmin(request);
  if (!admin.ok) {
    logSecurityAttempt(admin.hiveUsername ?? undefined, "spotmap sync", request, false);
    return NextResponse.json(
      { success: false, error: admin.reason ?? "Forbidden" },
      { status: 403 }
    );
  }
  logSecurityAttempt(admin.hiveUsername!, "spotmap sync", request, true);

  let requested: { sources?: string[] } = {};
  try {
    if (request.headers.get("content-type")?.includes("application/json")) {
      requested = (await request.json()) as { sources?: string[] };
    }
  } catch {
    // empty body is fine, fall through to defaults
  }
  const want = new Set<string>(requested.sources ?? ["hive", "google_my_maps"]);

  const startedAt = new Date().toISOString();

  const result: Record<string, unknown> = {
    success: true,
    started_at: startedAt,
    triggered_by: admin.hiveUsername,
  };

  if (want.has("hive")) {
    try {
      result.hive = await syncHiveSpots();
    } catch (err) {
      console.error("[POST /api/admin/spotmap/sync] hive sync threw", err);
      result.hive = { error: err instanceof Error ? err.message : "Unknown error" };
      result.success = false;
    }
  }

  if (want.has("google_my_maps")) {
    try {
      result.google_my_maps = await syncGoogleKmlSpots();
    } catch (err) {
      console.error("[POST /api/admin/spotmap/sync] google sync threw", err);
      result.google_my_maps = { error: err instanceof Error ? err.message : "Unknown error" };
      result.success = false;
    }
  }

  // Totals for the UI
  const supabase = getSpotmapSupabase();
  if (supabase) {
    const [{ count: hiveCount }, { count: googleCount }] = await Promise.all([
      supabase.from("spotmap_spots").select("id", { count: "exact", head: true }).eq("source", "hive"),
      supabase.from("spotmap_spots").select("id", { count: "exact", head: true }).eq("source", "google_my_maps"),
    ]);
    result.totals = {
      hive: hiveCount ?? 0,
      google_my_maps: googleCount ?? 0,
      all: (hiveCount ?? 0) + (googleCount ?? 0),
    };
  }

  result.finished_at = new Date().toISOString();
  return NextResponse.json(result);
}

/**
 * GET /api/admin/spotmap/sync
 *
 * Lightweight status read so the admin page can show "you ARE an admin
 * and here's what's in the table" without triggering a sync.
 */
export async function GET(request: NextRequest) {
  const admin = await requireSpotmapAdmin(request);
  if (!admin.ok) {
    return NextResponse.json(
      { ok: false, error: admin.reason ?? "Forbidden" },
      { status: 403 }
    );
  }

  const supabase = getSpotmapSupabase();
  if (!supabase) {
    return NextResponse.json({ ok: false, error: "Supabase not configured" }, { status: 500 });
  }

  const [{ count: hiveCount }, { count: googleCount }, { data: newest }] = await Promise.all([
    supabase.from("spotmap_spots").select("id", { count: "exact", head: true }).eq("source", "hive"),
    supabase.from("spotmap_spots").select("id", { count: "exact", head: true }).eq("source", "google_my_maps"),
    supabase
      .from("spotmap_spots")
      .select("synced_at, hive_created, source")
      .order("synced_at", { ascending: false })
      .limit(1),
  ]);

  return NextResponse.json({
    ok: true,
    hive_username: admin.hiveUsername,
    totals: {
      hive: hiveCount ?? 0,
      google_my_maps: googleCount ?? 0,
      all: (hiveCount ?? 0) + (googleCount ?? 0),
    },
    last_synced_at: newest?.[0]?.synced_at ?? null,
    newest_hive_created: newest?.[0]?.hive_created ?? null,
  });
}
