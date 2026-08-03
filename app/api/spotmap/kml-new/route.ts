import { NextResponse } from "next/server";
import { getSpotmapSupabase, type SpotmapRow } from "@/lib/spotmap/supabase";

// Escape user-supplied strings for safe interpolation into KML/XML text
// nodes and CDATA sections.
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// KML descriptions live in CDATA, so we only need to close/reopen the
// section if the payload itself contains "]]>".
function cdataSafe(s: string): string {
  return s.replace(/]]>/g, "]]]]><![CDATA[>");
}

function rowToPlacemark(row: SpotmapRow): string {
  const parts: string[] = [];
  if (row.address) parts.push(row.address);
  if (row.hive_author && row.hive_permlink) {
    parts.push(
      `https://skatehive.app/spot/${row.hive_author}/${row.hive_permlink}`
    );
  }
  if (row.description) parts.push(row.description);
  const descBody = parts.join("\n\n").trim();

  return [
    "    <Placemark>",
    `      <name>${xmlEscape(row.name || "Skate spot")}</name>`,
    descBody
      ? `      <description><![CDATA[${cdataSafe(descBody)}]]></description>`
      : "",
    "      <Point>",
    `        <coordinates>${row.lng},${row.lat},0</coordinates>`,
    "      </Point>",
    "    </Placemark>",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * GET /api/spotmap/kml-new
 *
 * Emits a KML file containing every Hive-sourced skatespot in Supabase.
 * Used by admins to bulk-import new Hive spots into the Google My Maps
 * (which has no write API — see the upstream discussion in the /map
 * admin thread). Read-only, no writes, but restricted to a small
 * allowlist to keep from turning the whole catalog into a scrape target.
 */
const KML_DOWNLOAD_ALLOWLIST = new Set(["web-gnar", "xvlad"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requester = (url.searchParams.get("as") ?? "").trim().toLowerCase();
  if (!KML_DOWNLOAD_ALLOWLIST.has(requester)) {
    return NextResponse.json(
      { success: false, error: "not allowed" },
      { status: 403 }
    );
  }

  const supabase = getSpotmapSupabase();
  if (!supabase) {
    return NextResponse.json(
      { success: false, error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const { data, error } = await supabase
    .from("spotmap_spots")
    .select(
      "id, source, source_id, name, description, lat, lng, address, thumbnail, images, hive_author, hive_permlink, hive_created, hive_last_update, kml_feature_id, kml_description, created_at, updated_at, synced_at"
    )
    .eq("source", "hive")
    .order("hive_created", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as SpotmapRow[];
  const placemarks = rows.map(rowToPlacemark).join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Skatehive Hive spots — ${stamp}</name>
    <description>Hive-sourced skatespots from spotmap_spots (${rows.length} pins).</description>
${placemarks}
  </Document>
</kml>
`;

  return new NextResponse(kml, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.google-earth.kml+xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="skatehive-hive-spots-${stamp}.kml"`,
      "Cache-Control": "private, no-store",
    },
  });
}
