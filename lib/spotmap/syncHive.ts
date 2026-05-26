import { APP_CONFIG, HIVE_CONFIG } from "@/config/app.config";
import { parseSpotBody } from "@/lib/utils/parseSpotBody";
import { getSpotmapSupabase, type SpotmapUpsertInput } from "./supabase";

interface HiveSpotRecord {
  author: string;
  permlink: string;
  body: string;
  created: string;       // "YYYY-MM-DDTHH:MM:SS" (UTC, no Z)
  last_update?: string;
  title?: string;
  tags?: string[];
  post_json_metadata?: unknown;
  json_metadata?: unknown;
}

interface HiveListResponse {
  success: boolean;
  data: HiveSpotRecord[];
  pagination: {
    total: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

const PAGE_SIZE = 200;          // Tunable. Smaller pages = more requests, less risk of timeout.
const MAX_PAGES_PER_RUN = 50;   // Safety net so a single click can't run forever.

// "YYYY-MM-DDTHH:MM:SS" → ISO with Z. The Hive API returns naive UTC strings.
function hiveTimeToIso(t: string | undefined): string | null {
  if (!t) return null;
  if (/Z|[+-]\d{2}:?\d{2}$/.test(t)) return t;
  return `${t}Z`;
}

function hasSkatespotTag(spot: HiveSpotRecord): boolean {
  // Sometimes tags are on the record directly, sometimes only in post_json_metadata
  if (Array.isArray(spot.tags) && spot.tags.includes("skatespot")) return true;
  for (const meta of [spot.post_json_metadata, spot.json_metadata]) {
    if (!meta) continue;
    try {
      const parsed = typeof meta === "string" ? JSON.parse(meta) : meta;
      const tags = (parsed as { tags?: unknown })?.tags;
      if (Array.isArray(tags) && tags.includes("skatespot")) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export interface HiveSyncResult {
  pagesFetched: number;
  recordsSeen: number;
  spotsConsidered: number;
  upserted: number;
  skippedNoCoords: number;
  stoppedReason: "cursor_reached" | "no_more_pages" | "page_limit" | "error";
  cursorBefore: string | null;
  cursorAfter: string | null;
}

/**
 * Pulls skatespots from the external Hive API page-by-page, newest first,
 * and stops when we encounter a spot whose `created` is <= the highest
 * `hive_created` already in spotmap_spots. The first run has no cursor and
 * walks the entire feed (bounded by MAX_PAGES_PER_RUN).
 */
export async function syncHiveSpots(): Promise<HiveSyncResult> {
  const supabase = getSpotmapSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  // Find the cursor — highest hive_created we've already stored.
  const { data: cursorRow } = await supabase
    .from("spotmap_spots")
    .select("hive_created")
    .eq("source", "hive")
    .order("hive_created", { ascending: false })
    .limit(1);

  const cursor = cursorRow?.[0]?.hive_created
    ? new Date(cursorRow[0].hive_created as string)
    : null;

  const result: HiveSyncResult = {
    pagesFetched: 0,
    recordsSeen: 0,
    spotsConsidered: 0,
    upserted: 0,
    skippedNoCoords: 0,
    stoppedReason: "no_more_pages",
    cursorBefore: cursor ? cursor.toISOString() : null,
    cursorAfter: null,
  };

  let page = 1;
  let stop = false;

  while (page <= MAX_PAGES_PER_RUN && !stop) {
    const url = `${APP_CONFIG.API_BASE_URL}/api/v2/skatespots?limit=${PAGE_SIZE}&page=${page}`;
    let payload: HiveListResponse;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "Skatehive-Sync/1.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      payload = (await res.json()) as HiveListResponse;
    } catch (err) {
      result.stoppedReason = "error";
      console.error("[spotmap.syncHive] fetch failed", { page, err });
      break;
    }
    result.pagesFetched += 1;
    result.recordsSeen += payload.data.length;

    const toUpsert: SpotmapUpsertInput[] = [];

    for (const record of payload.data) {
      // Tag filter (the external endpoint already returns skatespots, but
      // belt-and-braces in case the upstream filter loosens).
      if (!hasSkatespotTag(record)) continue;

      const createdIso = hiveTimeToIso(record.created);
      if (!createdIso) continue;

      // Cursor check: stop the whole sync as soon as we hit known territory.
      if (cursor && new Date(createdIso) <= cursor) {
        result.stoppedReason = "cursor_reached";
        stop = true;
        break;
      }

      result.spotsConsidered += 1;

      const parsed = parseSpotBody(record.body);
      if (parsed.lat == null || parsed.lng == null) {
        result.skippedNoCoords += 1;
        continue;
      }

      toUpsert.push({
        source: "hive",
        source_id: `${record.author}/${record.permlink}`,
        name: parsed.name || record.title || "Skate spot",
        description: parsed.description || null,
        lat: parsed.lat,
        lng: parsed.lng,
        address: parsed.address,
        thumbnail: parsed.images[0]?.url ?? null,
        images: parsed.images,
        hive_author: record.author,
        hive_permlink: record.permlink,
        hive_created: createdIso,
        hive_last_update: hiveTimeToIso(record.last_update),
      });
    }

    if (toUpsert.length > 0) {
      const { error, count } = await supabase
        .from("spotmap_spots")
        .upsert(toUpsert, { onConflict: "source,source_id", count: "exact" });
      if (error) {
        console.error("[spotmap.syncHive] upsert failed", error);
        result.stoppedReason = "error";
        break;
      }
      result.upserted += count ?? toUpsert.length;
    }

    if (stop) break;

    if (!payload.pagination?.hasNextPage) {
      result.stoppedReason = "no_more_pages";
      break;
    }

    page += 1;
  }

  if (page > MAX_PAGES_PER_RUN && !stop) {
    result.stoppedReason = "page_limit";
  }

  const { data: afterRow } = await supabase
    .from("spotmap_spots")
    .select("hive_created")
    .eq("source", "hive")
    .order("hive_created", { ascending: false })
    .limit(1);
  result.cursorAfter = afterRow?.[0]?.hive_created ?? null;

  return result;
}

export const HIVE_SYNC_PAGE_SIZE = PAGE_SIZE;
export const HIVE_COMMUNITY_TAG = HIVE_CONFIG.COMMUNITY_TAG;
