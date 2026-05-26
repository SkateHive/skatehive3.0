import { getSpotmapSupabase, type SpotmapUpsertInput } from "./supabase";

// The Skatehive Google My Maps `mid` — same value used by the
// /map/google iframe in [GoogleMyMapsView.tsx].
const DEFAULT_MID = "1iiXzotKL-uJ3l7USddpTDvadGII";

// Public KML feed endpoint Google My Maps exposes for publicly-shared maps.
// `forcekml=1` asks for raw KML instead of the default KMZ archive.
function kmlUrl(mid: string): string {
  return `https://www.google.com/maps/d/kml?mid=${mid}&forcekml=1`;
}

interface ParsedPlacemark {
  id: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
}

/**
 * Hand-rolled KML extractor. We only care about <Placemark> blocks that
 * contain a <Point><coordinates> tuple — everything else (LineString,
 * Polygon, Folder metadata, styles, etc.) is ignored. Avoids pulling in
 * a full XML parser dependency for what is a flat, predictable feed.
 *
 * Each Placemark looks roughly like:
 *   <Placemark id="abc123">
 *     <name>Spot name</name>
 *     <description><![CDATA[ ...html... ]]></description>
 *     <Point><coordinates>lng,lat,0</coordinates></Point>
 *   </Placemark>
 */
function parseKmlPlacemarks(xml: string): ParsedPlacemark[] {
  const out: ParsedPlacemark[] = [];
  const placemarkRe = /<Placemark\b([^>]*)>([\s\S]*?)<\/Placemark>/g;
  let m: RegExpExecArray | null;
  let positional = 0;

  while ((m = placemarkRe.exec(xml)) !== null) {
    const attrs = m[1];
    const body = m[2];
    positional += 1;

    // Only Placemarks with a <Point><coordinates>
    const coordMatch = body.match(/<Point\b[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/);
    if (!coordMatch) continue;

    const tuple = coordMatch[1].trim();
    // KML coordinates: "lng,lat[,alt]"
    const parts = tuple.split(",").map((s) => s.trim());
    const lng = parseFloat(parts[0]);
    const lat = parseFloat(parts[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;

    const idAttrMatch = attrs.match(/\bid\s*=\s*"([^"]+)"/);
    const id = idAttrMatch?.[1] ?? `placemark-${positional}`;

    const nameMatch = body.match(/<name>([\s\S]*?)<\/name>/);
    const name = decodeXmlText(nameMatch?.[1] ?? "").trim() || `Spot ${positional}`;

    const descMatch = body.match(/<description>([\s\S]*?)<\/description>/);
    const description = descMatch ? decodeXmlText(descMatch[1]).trim() : null;

    out.push({ id, name, description: description || null, lat, lng });
  }

  return out;
}

function decodeXmlText(s: string): string {
  // Strip CDATA, then decode the common entities. Google's KML descriptions
  // contain HTML — we keep it raw and rely on the renderer to sanitize.
  const noCdata = s.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1");
  return noCdata
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// Pull the first image URL out of an HTML description if there is one,
// so the spot card can use it as a thumbnail.
function extractFirstImageUrl(html: string | null): string | null {
  if (!html) return null;
  const m = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

export interface KmlSyncResult {
  fetched: boolean;
  placemarkCount: number;
  upserted: number;
  skipped: number;
  stoppedReason: "ok" | "fetch_failed" | "empty";
  mid: string;
}

export async function syncGoogleKmlSpots(mid: string = DEFAULT_MID): Promise<KmlSyncResult> {
  const supabase = getSpotmapSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  const result: KmlSyncResult = {
    fetched: false,
    placemarkCount: 0,
    upserted: 0,
    skipped: 0,
    stoppedReason: "ok",
    mid,
  };

  let xml: string;
  try {
    const res = await fetch(kmlUrl(mid), {
      headers: { "User-Agent": "Skatehive-Sync/1.0" },
      // The KML endpoint can return a 302 to googleusercontent — let fetch follow it.
      redirect: "follow",
    });
    if (!res.ok) {
      result.stoppedReason = "fetch_failed";
      console.error("[spotmap.syncGoogleKml] HTTP", res.status);
      return result;
    }
    xml = await res.text();
    result.fetched = true;
  } catch (err) {
    result.stoppedReason = "fetch_failed";
    console.error("[spotmap.syncGoogleKml] fetch threw", err);
    return result;
  }

  const placemarks = parseKmlPlacemarks(xml);
  result.placemarkCount = placemarks.length;
  if (placemarks.length === 0) {
    result.stoppedReason = "empty";
    return result;
  }

  const rows: SpotmapUpsertInput[] = placemarks.map((p) => ({
    source: "google_my_maps",
    source_id: p.id,
    name: p.name,
    description: p.description,
    lat: p.lat,
    lng: p.lng,
    address: null,
    thumbnail: extractFirstImageUrl(p.description),
    images: null,
    kml_feature_id: p.id,
    kml_description: p.description,
  }));

  // Upsert in batches of 200 so we don't trip Supabase's row-payload caps.
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { error, count } = await supabase
      .from("spotmap_spots")
      .upsert(chunk, { onConflict: "source,source_id", count: "exact" });
    if (error) {
      console.error("[spotmap.syncGoogleKml] upsert failed", error);
      result.skipped += chunk.length;
      continue;
    }
    result.upserted += count ?? chunk.length;
  }

  return result;
}

export const SPOTMAP_DEFAULT_MID = DEFAULT_MID;
