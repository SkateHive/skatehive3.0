import { redirect } from "next/navigation";
import HomeMagazineClient from "./HomeMagazineClient";
import type { HomepageConfigDoc } from "@/types/homepage-config";
import { getInitialFeaturedSpot } from "@/lib/spotmap/featured";

// The curated media-magazine homepage. Renders entirely from the portal-managed
// HomepageConfig (draft→preview→publish). SSR-fetches the config for first
// paint: published or, with ?preview=<token>, the draft. Only when the portal
// CONFIRMS nothing is published (and we're not previewing) do we fall back to
// the classic feed — a transient fetch error renders the client, which retries.
export const dynamic = "force-dynamic";

const HOMEPAGE_API = process.env.NEXT_PUBLIC_MAGAZINE_API || "https://skatehive.reelflip.com";

type FetchResult =
  | { status: "ok"; config: HomepageConfigDoc }
  | { status: "empty" } // portal answered: nothing published
  | { status: "error" }; // couldn't reach / parse the portal

async function fetchConfig(previewToken?: string): Promise<FetchResult> {
  try {
    const url = previewToken
      ? `${HOMEPAGE_API}/api/homepage/draft?token=${encodeURIComponent(previewToken)}`
      : `${HOMEPAGE_API}/api/homepage/current?project=skatehive`;
    // no-store: publishing in the portal must reflect on /home immediately, not
    // after a CDN window (the client hook refetches anyway).
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return { status: "error" };
    const data = (await res.json()) as { config?: HomepageConfigDoc | null };
    return data?.config ? { status: "ok", config: data.config } : { status: "empty" };
  } catch {
    return { status: "error" };
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const result = await fetchConfig(preview);

  // Only bounce to the feed when the portal CONFIRMS nothing is published and
  // we're not previewing. On a fetch error, render the client and let it retry
  // (a portal hiccup shouldn't eject visitors).
  if (result.status === "empty" && !preview) redirect("/");

  const initialConfig = result.status === "ok" ? result.config : null;
  // SSR the location-based featured spot (same as the classic homepage) so the
  // "Discover a Spot" widget paints without a skeleton flash.
  const initialFeaturedSpot = await getInitialFeaturedSpot().catch(() => null);
  return (
    <HomeMagazineClient
      initialConfig={initialConfig}
      previewToken={preview ?? null}
      initialFeaturedSpot={initialFeaturedSpot}
    />
  );
}
