import { APP_CONFIG, HIVE_CONFIG } from "@/config/app.config";
import { parseSpotBody } from "@/lib/utils/parseSpotBody";
import { getSpotmapSupabase, type SpotmapUpsertInput } from "./supabase";
import { pickSpotThumbnail } from "./getThumbnail";
import HiveClient from "@/lib/hive/hiveclient";

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
  stoppedReason:
    | "caught_up"
    | "no_more_pages"
    | "page_limit"
    | "error";
  /**
   * source_id count in spotmap_spots for source="hive" before and after
   * the sync ran. Handy for the admin panel to show "N new" without a
   * second query.
   */
  hiveCountBefore: number;
  hiveCountAfter: number;
}

// Consecutive fully-known pages before we call the catalog caught up. One
// isn't enough — a single boundary page whose records all landed pre-sync
// would falsely halt us before we reach late-indexed older posts.
const CATCH_UP_STREAK = 2;

/**
 * Pulls skatespots from the external Hive API page-by-page, newest first,
 * and upserts every unseen record. Stops when it has seen `CATCH_UP_STREAK`
 * consecutive pages containing zero new source_ids, or when the pagination
 * runs out, or at MAX_PAGES_PER_RUN.
 *
 * Why not a `hive_created` cursor: the upstream indexer at
 * api.skatehive.app is not real-time — Snap comments in particular can be
 * indexed hours or days after they're published. A created-date cursor
 * short-circuits the sync as soon as it sees a record OLDER than the
 * highest stored `hive_created`, which means late-arriving posts (very
 * common for the mobile app, which publishes as Snaps) never enter the
 * sync flow. Tracking source_ids instead is idempotent and survives that
 * indexing lag.
 */
export async function syncHiveSpots(): Promise<HiveSyncResult> {
  const supabase = getSpotmapSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  // Load every existing hive source_id into a Set. The table is small
  // (~hundreds of rows) and this single query lets each page decide
  // "all known?" locally without any extra round-trips.
  const known = new Set<string>();
  {
    const pageSize = 1000;
    let from = 0;
    for (;;) {
      const { data, error } = await supabase
        .from("spotmap_spots")
        .select("source_id")
        .eq("source", "hive")
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) known.add(row.source_id as string);
      if (data.length < pageSize) break;
      from += pageSize;
    }
  }

  const result: HiveSyncResult = {
    pagesFetched: 0,
    recordsSeen: 0,
    spotsConsidered: 0,
    upserted: 0,
    skippedNoCoords: 0,
    stoppedReason: "no_more_pages",
    hiveCountBefore: known.size,
    hiveCountAfter: known.size,
  };

  let page = 1;
  let stop = false;
  let consecutiveKnownPages = 0;

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
    let pageHadNew = false;

    for (const record of payload.data) {
      // Tag filter (the external endpoint already returns skatespots, but
      // belt-and-braces in case the upstream filter loosens).
      if (!hasSkatespotTag(record)) continue;

      const source_id = `${record.author}/${record.permlink}`;
      if (known.has(source_id)) continue;
      pageHadNew = true;

      const createdIso = hiveTimeToIso(record.created);
      if (!createdIso) continue;

      result.spotsConsidered += 1;

      const parsed = parseSpotBody(record.body);
      if (parsed.lat == null || parsed.lng == null) {
        result.skippedNoCoords += 1;
        // Still mark as known — retrying next run won't help without a
        // body edit, and it would keep the "caught up" streak from ever
        // firing on catalogs where several rows are unparseable.
        known.add(source_id);
        continue;
      }

      toUpsert.push({
        source: "hive",
        source_id,
        name: parsed.name || record.title || "Skate spot",
        description: parsed.description || null,
        lat: parsed.lat,
        lng: parsed.lng,
        address: parsed.address,
        // Falls back to json_metadata.image[0] / .thumbnail[0] / a YouTube
        // hqdefault if the body has no markdown image — keeps the widget
        // and map popups from showing a "no photo" placeholder for spots
        // posted from non-composer clients (3Speak, peakd, etc.).
        thumbnail: pickSpotThumbnail({
          firstMarkdownImage: parsed.images[0]?.url ?? null,
          body: record.body,
          json_metadata: record.post_json_metadata ?? record.json_metadata,
        }),
        images: parsed.images,
        hive_author: record.author,
        hive_permlink: record.permlink,
        hive_created: createdIso,
        hive_last_update: hiveTimeToIso(record.last_update),
      });
      known.add(source_id);
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

    consecutiveKnownPages = pageHadNew ? 0 : consecutiveKnownPages + 1;
    if (consecutiveKnownPages >= CATCH_UP_STREAK) {
      result.stoppedReason = "caught_up";
      stop = true;
      break;
    }

    if (!payload.pagination?.hasNextPage) {
      result.stoppedReason = "no_more_pages";
      break;
    }

    page += 1;
  }

  if (page > MAX_PAGES_PER_RUN && !stop) {
    result.stoppedReason = "page_limit";
  }

  result.hiveCountAfter = known.size;

  return result;
}

export type SingleSpotSyncStatus =
  | "upserted"
  | "not_found"
  | "not_a_spot"
  | "no_coords"
  | "error";

export interface SingleSpotSyncResult {
  status: SingleSpotSyncStatus;
  source_id: string;
  spot?: SpotmapUpsertInput;
  error?: string;
}

/**
 * Ingest a single Hive skatespot on demand — used right after a client posts a
 * spot so it appears on the map within seconds instead of waiting for the bulk
 * sync. Fetches the post straight from Hive (so the data is trusted: it comes
 * from the verified on-chain content, not the caller), validates the skatespot
 * tag, parses the body, and upserts one row.
 */
export async function syncSingleHiveSpot(
  author: string,
  permlink: string
): Promise<SingleSpotSyncResult> {
  const source_id = `${author}/${permlink}`;
  const supabase = getSpotmapSupabase();
  if (!supabase) throw new Error("Supabase not configured");

  let content: {
    author?: string;
    permlink?: string;
    body?: string;
    title?: string;
    created?: string;
    last_update?: string;
    json_metadata?: unknown;
  } | null = null;
  try {
    content = await HiveClient.call("condenser_api", "get_content", [author, permlink]);
  } catch (err) {
    return {
      status: "error",
      source_id,
      error: err instanceof Error ? err.message : "Hive fetch failed",
    };
  }

  // get_content returns an empty author when the post doesn't exist.
  if (!content || !content.author || !content.body) {
    return { status: "not_found", source_id };
  }

  const record: HiveSpotRecord = {
    author: content.author,
    permlink: content.permlink ?? permlink,
    body: content.body,
    created: content.created ?? "",
    last_update: content.last_update,
    title: content.title,
    json_metadata: content.json_metadata,
  };

  if (!hasSkatespotTag(record)) {
    return { status: "not_a_spot", source_id };
  }

  const parsed = parseSpotBody(record.body);
  if (parsed.lat == null || parsed.lng == null) {
    return { status: "no_coords", source_id };
  }

  const spot: SpotmapUpsertInput = {
    source: "hive",
    source_id,
    name: parsed.name || record.title || "Skate spot",
    description: parsed.description || null,
    lat: parsed.lat,
    lng: parsed.lng,
    address: parsed.address,
    // Same fallback chain the bulk sync uses (markdown image →
    // json_metadata.image[0] → .thumbnail[0] → YouTube hqdefault) so a
    // spot ingested by sync-one ends up identical to one ingested by
    // the nightly cron.
    thumbnail: pickSpotThumbnail({
      firstMarkdownImage: parsed.images[0]?.url ?? null,
      body: record.body,
      json_metadata: record.json_metadata,
    }),
    images: parsed.images,
    hive_author: record.author,
    hive_permlink: record.permlink,
    hive_created: hiveTimeToIso(record.created),
    hive_last_update: hiveTimeToIso(record.last_update),
  };

  const { error } = await supabase
    .from("spotmap_spots")
    .upsert(spot, { onConflict: "source,source_id" });
  if (error) {
    return { status: "error", source_id, error: error.message };
  }

  return { status: "upserted", source_id, spot };
}

export const HIVE_SYNC_PAGE_SIZE = PAGE_SIZE;
export const HIVE_COMMUNITY_TAG = HIVE_CONFIG.COMMUNITY_TAG;
