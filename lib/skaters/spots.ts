import "server-only";
import { unstable_cache } from "next/cache";
import { getSpotmapSupabase } from "@/lib/spotmap/supabase";

/** Matches the read endpoint's ceiling; the table is well under it. */
const MAX_ROWS = 10000;

/**
 * The query itself. Throws on any failure so that `unstable_cache` never
 * stores an empty result: a cached {} would keep every spot badge off the page
 * for the full revalidate window after one bad minute — which is exactly what
 * happened when this first ran against a deployment with no Supabase env.
 */
const fetchSpotCounts = unstable_cache(
  async (): Promise<Record<string, number>> => {
    const supabase = getSpotmapSupabase();
    if (!supabase) throw new Error("Spot map backend not configured");

    const { data, error } = await supabase
      .from("spotmap_spots")
      .select("hive_author")
      .eq("source", "hive")
      .not("hive_author", "is", null)
      .limit(MAX_ROWS);
    if (error) throw error;

    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { hive_author?: string | null }[]) {
      const author = row.hive_author;
      if (author) counts[author] = (counts[author] || 0) + 1;
    }
    return counts;
  },
  ["skaters-spot-counts-v2"],
  { revalidate: 300, tags: ["skaters-directory"] }
);

/**
 * How many spots each skater has put on the map, keyed by Hive handle.
 *
 * Restricted to `source = 'hive'` on purpose: KML rows carry the synthetic
 * "skatehive-map" author, so counting them would credit a real-looking handle
 * with spots nobody added.
 *
 * Returns {} rather than throwing when the spot backend is unreachable — the
 * directory predates spots and must still render without them — but that {} is
 * NOT cached, so the next render tries again.
 */
export async function getSpotCountsByAuthor(): Promise<Record<string, number>> {
  try {
    return await fetchSpotCounts();
  } catch (error) {
    console.error("[skaters] could not load spot counts:", error);
    return {};
  }
}
