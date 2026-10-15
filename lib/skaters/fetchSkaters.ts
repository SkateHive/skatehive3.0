import "server-only";
import { unstable_cache } from "next/cache";
import { APP_CONFIG } from "@/config/app.config";
import { resolveLocation } from "./geo";
import { getSpotCountsByAuthor } from "./spots";
import type { DirectoryData, Skater } from "./types";

const LEADERBOARD_ENDPOINT = `${APP_CONFIG.API_BASE_URL}/api/v2/leaderboard`;
const HIVE_RPC = "https://api.hive.blog";

/** get_accounts happily takes 200 names per call; 17 calls covers the whole community. */
const ACCOUNT_BATCH_SIZE = 200;
/** How many batches are in flight at once. */
const BATCH_CONCURRENCY = 4;
/** Long blurbs are cut here — the card only has room for a line or two. */
const ABOUT_MAX_LENGTH = 120;

interface LeaderboardRow {
  hive_author?: string;
  points?: number;
  post_count?: number;
  snaps_count?: number;
  posts_score?: number;
  hp_balance?: number;
  eth_address?: string;
  gnars_balance?: number;
  skatehive_nft_balance?: number;
  has_voted_in_witness?: boolean;
  last_post?: string;
}

interface HiveAccount {
  name: string;
  posting_json_metadata?: string;
  json_metadata?: string;
}

/**
 * The leaderboard feed carries synthetic "donator_*" rows for Giveth donors who
 * have no Hive account. They are not skaters and cannot be looked up on-chain.
 */
function isRealHiveAuthor(author: string | undefined): author is string {
  return Boolean(author) && !/^donator_/i.test(author as string);
}

/**
 * The API sends 2000-01-01 when it has never seen a post from an account.
 * Treat that as "no post", not as a 26-year-old one.
 *
 * Returns epoch SECONDS: every consumer immediately turned the ISO string into
 * a number, and the strings were 34KB of the page's payload.
 */
function normalizeLastPost(value: string | undefined): number | undefined {
  if (!value || value.startsWith("2000-01-01")) return undefined;
  // The feed returns naive timestamps; Hive serves UTC.
  const parsed = Date.parse(value.endsWith("Z") ? value : `${value}Z`);
  return Number.isNaN(parsed) ? undefined : Math.floor(parsed / 1000);
}

function parseHiveProfile(account: HiveAccount): Record<string, string> {
  const read = (raw: string | undefined): Record<string, string> => {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed.profile === "object" ? parsed.profile : {};
    } catch {
      return {};
    }
  };
  // posting_json_metadata is the modern home for the profile; json_metadata is
  // the legacy one, and plenty of older accounts only ever filled that in.
  return { ...read(account.json_metadata), ...read(account.posting_json_metadata) };
}

async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const res = await fetch(LEADERBOARD_ENDPOINT, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Leaderboard API responded ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

async function fetchAccountBatch(names: string[]): Promise<HiveAccount[]> {
  const res = await fetch(HIVE_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "condenser_api.get_accounts",
      params: [names],
      id: 1,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Hive RPC responded ${res.status}`);
  const json = await res.json();
  // A JSON-RPC error body comes back 200 with no `result`. Returning [] here
  // would look identical to "none of these accounts exist".
  if (json?.error) throw new Error(`Hive RPC error: ${JSON.stringify(json.error)}`);
  if (!Array.isArray(json?.result)) throw new Error("Hive RPC returned no result array");
  return json.result;
}

/** One retry before giving up: these batches fail in bursts, not permanently. */
async function fetchAccountBatchWithRetry(names: string[]): Promise<HiveAccount[]> {
  try {
    return await fetchAccountBatch(names);
  } catch {
    return await fetchAccountBatch(names);
  }
}

/** Runs the account batches a few at a time so we neither stall nor flood the node. */
async function fetchAllAccounts(names: string[]): Promise<Map<string, HiveAccount>> {
  const batches: string[][] = [];
  for (let i = 0; i < names.length; i += ACCOUNT_BATCH_SIZE) {
    batches.push(names.slice(i, i + ACCOUNT_BATCH_SIZE));
  }

  const accounts = new Map<string, HiveAccount>();
  for (let i = 0; i < batches.length; i += BATCH_CONCURRENCY) {
    const slice = batches.slice(i, i + BATCH_CONCURRENCY);
    // Promise.all, not allSettled: a batch that never came back is a network
    // failure, and the caller drops accounts it has no record of. Swallowing
    // one rejection quietly deleted up to 200 real skaters from the directory,
    // the country pages and the sitemap. Better to fail and serve the last
    // good snapshot than to publish a truncated one.
    const results = await Promise.all(slice.map(fetchAccountBatchWithRetry));
    for (const batch of results) {
      for (const account of batch) accounts.set(account.name, account);
    }
  }
  return accounts;
}

function truncateAbout(about: string | undefined): string | undefined {
  const text = (about || "").replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  if (text.length <= ABOUT_MAX_LENGTH) return text;
  return `${text.slice(0, ABOUT_MAX_LENGTH - 1).trimEnd()}…`;
}

function buildSkater(
  row: LeaderboardRow,
  account: HiveAccount | undefined,
  spotCount: number
): Skater {
  const username = row.hive_author as string;
  const profile = account ? parseHiveProfile(account) : {};
  const place = resolveLocation(profile.location);

  const skater: Skater = { username };

  const displayName = (profile.name || "").trim();
  if (displayName && displayName !== username) skater.displayName = displayName;

  const about = truncateAbout(profile.about);
  if (about) skater.about = about;

  // Only ship the raw string when it is the only location information we have.
  // Once a country resolved, `country`/`city` cover both display and search, and
  // ~1700 redundant strings is real weight on the page payload.
  if (place.raw && !place.country) skater.rawLocation = place.raw;
  if (place.country) skater.country = place.country;
  if (place.city) skater.city = place.city;
  if (place.coords) skater.coords = place.coords;
  if (place.nowhere) skater.nowhere = true;

  const lastPost = normalizeLastPost(row.last_post);
  if (lastPost) skater.lastPost = lastPost;

  if (row.points) skater.points = row.points;
  if (row.post_count) skater.postCount = row.post_count;
  if (row.snaps_count) skater.snapsCount = row.snaps_count;
  if (row.hp_balance) skater.hp = Math.round(row.hp_balance);
  if (row.gnars_balance) skater.gnars = row.gnars_balance;
  if (row.skatehive_nft_balance) skater.nfts = row.skatehive_nft_balance;
  if (spotCount) skater.spotCount = spotCount;
  // posts_score, eth_address and has_voted_in_witness are deliberately NOT
  // carried: nothing on this page reads them, and `hasEth` alone was true for
  // every one of ~1700 skaters — 25KB of payload for a field never rendered.

  return skater;
}

/**
 * Sorts the directory's default order: people who posted most recently first,
 * then by Hive Power for everyone with no posting history at all.
 *
 * Deliberately NOT sorted by `points` or `post_count`: the upstream feed
 * currently reports 0 for both on almost every account, so using them as the
 * primary key (or worse, as a filter) hides the entire community.
 */
function byRecentActivity(a: Skater, b: Skater): number {
  const aTime = a.lastPost || 0;
  const bTime = b.lastPost || 0;
  if (aTime !== bTime) return bTime - aTime;
  return (b.hp || 0) - (a.hp || 0);
}

async function buildDirectory(): Promise<DirectoryData> {
  const rows = await fetchLeaderboard();
  const realRows = rows.filter((row) => isRealHiveAuthor(row.hive_author));
  // The spot counts come from a different backend entirely, so they run
  // alongside the Hive lookups rather than after them.
  const [accounts, spotCounts] = await Promise.all([
    fetchAllAccounts(realRows.map((row) => row.hive_author as string)),
    getSpotCountsByAuthor(),
  ]);

  const skaters = realRows
    // An account the node does not return no longer exists; drop it rather than
    // linking to a dead profile.
    .filter((row) => accounts.has(row.hive_author as string))
    .map((row) => {
      const author = row.hive_author as string;
      return buildSkater(row, accounts.get(author), spotCounts[author] || 0);
    })
    .sort(byRecentActivity);

  const counts = new Map<string, number>();
  for (const skater of skaters) {
    if (!skater.country) continue;
    counts.set(skater.country, (counts.get(skater.country) || 0) + 1);
  }
  const countries = Array.from(counts.entries())
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country));

  return { skaters, countries, generatedAt: new Date().toISOString() };
}

/**
 * Cached directory snapshot. Shared by /skaters and every /skaters/[country]
 * page, so one refresh covers all of them.
 *
 * The try/catch lives OUTSIDE the cache on purpose. With the fallback inside,
 * one failed leaderboard fetch pinned an empty directory for the full
 * revalidate window: /skaters said "no results", all 66 country pages rendered
 * "0 Skaters" behind a 200 and an indexable canonical, and the sitemap dropped
 * every country entry — for five minutes, from a single blip.
 */
const cachedDirectory = unstable_cache(buildDirectory, ["skaters-directory-v2"], {
  revalidate: 300,
  tags: ["skaters-directory"],
});

export async function getSkaterDirectory(): Promise<DirectoryData> {
  try {
    return await cachedDirectory();
  } catch (error) {
    console.error("[skaters] failed to build directory:", error);
    return { skaters: [], countries: [], generatedAt: new Date().toISOString() };
  }
}
