/**
 * Tiny localStorage cache with TTL.
 * Stale-while-revalidate: callers always get the cached value immediately,
 * then re-fetch in the background and call set() to update.
 */

const PREFIX = "skh_cache_";

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function isAvailable(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function localCacheGet<T>(key: string, maxAgeMs?: number): T | null {
  if (!isAvailable()) return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (maxAgeMs && Date.now() - entry.ts > maxAgeMs) return null;
    return entry.data;
  } catch {
    return null;
  }
}

export function localCacheSet<T>(key: string, data: T): void {
  if (!isAvailable()) return;
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {
    // Ignore quota errors — cache is best-effort
  }
}

export function localCacheDelete(key: string): void {
  if (!isAvailable()) return;
  try { localStorage.removeItem(PREFIX + key); } catch {}
}
