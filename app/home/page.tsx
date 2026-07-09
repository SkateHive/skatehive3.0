import { redirect } from "next/navigation";
import HomeMagazineClient from "./HomeMagazineClient";
import type { HomepageConfigDoc } from "@/types/homepage-config";

// The curated media-magazine homepage. Renders entirely from the portal-managed
// HomepageConfig (draft→preview→publish). SSR-fetches the config for first
// paint: published (revalidated) or, with ?preview=<token>, the draft (no
// store). Nothing published + no preview → fall back to the classic feed.
export const dynamic = "force-dynamic";

const HOMEPAGE_API = process.env.NEXT_PUBLIC_MAGAZINE_API || "https://skatehive.reelflip.com";

async function fetchConfig(previewToken?: string): Promise<HomepageConfigDoc | null> {
  try {
    const url = previewToken
      ? `${HOMEPAGE_API}/api/homepage/draft?token=${encodeURIComponent(previewToken)}`
      : `${HOMEPAGE_API}/api/homepage/current?project=skatehive`;
    const res = await fetch(url, previewToken ? { cache: "no-store" } : { next: { revalidate: 120 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { config?: HomepageConfigDoc | null };
    return data?.config ?? null;
  } catch {
    return null;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const config = await fetchConfig(preview);

  // No published config and not previewing → send public users to the feed.
  if (!config && !preview) redirect("/");

  return <HomeMagazineClient initialConfig={config} previewToken={preview ?? null} />;
}
