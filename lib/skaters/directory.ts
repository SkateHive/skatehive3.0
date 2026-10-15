/**
 * Pure filtering, sorting and activity helpers for the skaters directory.
 * No React and no server imports, so the rules are unit-testable on their own.
 */

import { haversineKm } from "./geo";
import type { LatLng } from "./geo";
import type { ActivityTier, Skater } from "./types";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Upper bound in days for each tier. `dormant` is everything beyond. */
export const TIER_MAX_DAYS: Record<Exclude<ActivityTier, "dormant">, number> = {
  active: 7,
  recent: 30,
  quiet: 365,
};

/** Whole days since an epoch-seconds timestamp, or null when there is none. */
export function daysSince(seconds: number | undefined, now: number = Date.now()): number | null {
  if (!seconds) return null;
  return Math.max(0, Math.floor((now - seconds * 1000) / DAY_MS));
}

/**
 * Which activity bucket a skater falls into. Someone who has never posted is
 * `dormant` rather than a separate state — for a directory, "not posting" is
 * the same signal whether it's because they stopped or never started.
 */
export function activityTier(skater: Skater, now: number = Date.now()): ActivityTier {
  const days = daysSince(skater.lastPost, now);
  if (days === null) return "dormant";
  if (days <= TIER_MAX_DAYS.active) return "active";
  if (days <= TIER_MAX_DAYS.recent) return "recent";
  if (days <= TIER_MAX_DAYS.quiet) return "quiet";
  return "dormant";
}

export type SortKey = "active" | "points" | "posts" | "hp" | "alpha" | "near";

/** Only offered once the browser has actually handed us a position. */
export const NEAR_SORT_KEY = "near";

export interface SortOption {
  key: SortKey;
  /** i18n key under the `skaters` namespace. */
  labelKey: string;
  compare: (a: Skater, b: Skater) => number;
}

const byLastPost = (a: Skater, b: Skater) => (b.lastPost || 0) - (a.lastPost || 0);

/** Ties break on username so the order is stable between renders. */
const stable =
  (compare: (a: Skater, b: Skater) => number) =>
  (a: Skater, b: Skater): number =>
    compare(a, b) || byLastPost(a, b) || a.username.localeCompare(b.username);

export const SORT_OPTIONS: SortOption[] = [
  { key: "active", labelKey: "skaters.sortActive", compare: stable(byLastPost) },
  {
    key: "points",
    labelKey: "skaters.sortPoints",
    compare: stable((a, b) => (b.points || 0) - (a.points || 0)),
  },
  {
    key: "posts",
    labelKey: "skaters.sortPosts",
    compare: stable((a, b) => (b.postCount || 0) + (b.snapsCount || 0) - ((a.postCount || 0) + (a.snapsCount || 0))),
  },
  {
    key: "hp",
    labelKey: "skaters.sortHp",
    compare: stable((a, b) => (b.hp || 0) - (a.hp || 0)),
  },
  {
    key: "alpha",
    labelKey: "skaters.sortAlpha",
    compare: (a, b) => a.username.localeCompare(b.username),
  },
];

export function getSortOption(key: string | null | undefined): SortOption {
  return SORT_OPTIONS.find((option) => option.key === key) ?? SORT_OPTIONS[0];
}

/**
 * Kilometres from `origin` to a skater's resolved place, or null when we never
 * resolved one. Distances are to a city centroid, not to a person.
 */
export function distanceFrom(origin: LatLng | null, skater: Skater): number | null {
  if (!origin || !skater.coords) return null;
  return haversineKm(origin, skater.coords);
}

export interface DirectoryFilters {
  query?: string;
  country?: string | null;
  tier?: ActivityTier | null;
}

/** Matches a search box term against everything a person might type. */
export function matchesQuery(skater: Skater, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return (
    skater.username.toLowerCase().includes(term) ||
    (skater.displayName || "").toLowerCase().includes(term) ||
    (skater.rawLocation || "").toLowerCase().includes(term) ||
    (skater.country || "").toLowerCase().includes(term) ||
    (skater.city || "").toLowerCase().includes(term) ||
    (skater.about || "").toLowerCase().includes(term)
  );
}

export function filterSkaters(
  skaters: Skater[],
  { query = "", country = null, tier = null }: DirectoryFilters,
  now: number = Date.now()
): Skater[] {
  return skaters.filter((skater) => {
    if (country && skater.country !== country) return false;
    if (tier && activityTier(skater, now) !== tier) return false;
    return matchesQuery(skater, query);
  });
}

export function sortSkaters(
  skaters: Skater[],
  sortKey: string | null | undefined,
  origin: LatLng | null = null
): Skater[] {
  // "Nearest" cannot be a plain SortOption: its comparator needs the viewer's
  // position, which the static table has no way to carry.
  if (sortKey === NEAR_SORT_KEY && origin) {
    return [...skaters].sort((a, b) => {
      // Everyone with no coordinates sorts last rather than first.
      const aKm = distanceFrom(origin, a) ?? Infinity;
      const bKm = distanceFrom(origin, b) ?? Infinity;
      return aKm - bKm || a.username.localeCompare(b.username);
    });
  }
  return [...skaters].sort(getSortOption(sortKey).compare);
}

/** Avatar served straight off Ecency's CDN — keeps ~1700 long URLs out of the page payload. */
export function avatarUrl(username: string, size: "small" | "medium" = "small"): string {
  return `https://images.ecency.com/webp/u/${username}/avatar/${size}`;
}

export interface PlaceGroup {
  /** Stable id: "city|country" or just "country". */
  id: string;
  label: string;
  country: string;
  city: string | null;
  coords: [number, number];
  skaters: Skater[];
}

/**
 * Groups skaters by the finest place we resolved for them, for map pins.
 * We pin places rather than people: the profile only gives us a text location,
 * so a per-skater pin would be inventing precision we do not have.
 */
export function groupByPlace(skaters: Skater[]): PlaceGroup[] {
  const groups = new Map<string, PlaceGroup>();
  for (const skater of skaters) {
    if (!skater.coords || !skater.country) continue;
    const id = skater.city ? `${skater.city}|${skater.country}` : skater.country;
    const existing = groups.get(id);
    if (existing) {
      existing.skaters.push(skater);
      continue;
    }
    groups.set(id, {
      id,
      label: skater.city ? `${skater.city}, ${skater.country}` : skater.country,
      country: skater.country,
      city: skater.city ?? null,
      coords: [skater.coords[0], skater.coords[1]],
      skaters: [skater],
    });
  }
  return Array.from(groups.values()).sort((a, b) => b.skaters.length - a.skaters.length);
}
