#!/usr/bin/env tsx
/**
 * One-shot initial spot-map ingest. Runs both sync paths server-side
 * (bypassing the HTTP admin gate) so the map is populated immediately
 * after deploying the new spotmap_spots table.
 *
 * After this, ongoing syncs should go through the admin UI at /map/admin.
 *
 * Usage:
 *   pnpm tsx scripts/database/spotmap-first-sync.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

// Load .env.local before importing any module that touches the env.
function loadEnvLocal() {
  const envPath = path.resolve(__dirname, "../../.env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnvLocal();

async function main() {
  // Import AFTER env is populated so module-level supabase client reads it.
  const { syncHiveSpots } = await import("../../lib/spotmap/syncHive");
  const { syncGoogleKmlSpots } = await import("../../lib/spotmap/syncGoogleKml");
  const { getSpotmapSupabase } = await import("../../lib/spotmap/supabase");

  console.log("▶ Spotmap first-sync starting");
  console.log("  SUPABASE_URL set:", !!process.env.SUPABASE_URL);
  console.log("  SUPABASE_SERVICE_ROLE_KEY set:", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log("\n--- Hive sync ---");
  const hive = await syncHiveSpots();
  console.log(JSON.stringify(hive, null, 2));

  console.log("\n--- Google My Maps KML sync ---");
  const google = await syncGoogleKmlSpots();
  console.log(JSON.stringify(google, null, 2));

  const supabase = getSpotmapSupabase();
  if (supabase) {
    const [{ count: hiveCount }, { count: googleCount }] = await Promise.all([
      supabase.from("spotmap_spots").select("id", { count: "exact", head: true }).eq("source", "hive"),
      supabase.from("spotmap_spots").select("id", { count: "exact", head: true }).eq("source", "google_my_maps"),
    ]);
    console.log("\n✅ Totals after sync:");
    console.log("  hive          :", hiveCount ?? 0);
    console.log("  google_my_maps:", googleCount ?? 0);
    console.log("  TOTAL         :", (hiveCount ?? 0) + (googleCount ?? 0));
  }
}

main().catch((err) => {
  console.error("❌ First-sync failed:", err);
  process.exit(1);
});
