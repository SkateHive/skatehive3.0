"use client";

import { useEffect, useState } from "react";
import type { HomepageConfigDoc } from "@/types/homepage-config";

// Client hook for the portal-curated homepage config. Serves the SSR `initial`
// doc immediately, then refetches — the current published config, or (when a
// preview token is present) the draft, always no-store so a preview tab shows
// the latest save on reload. Same portal host + env var as the magazine hook.
const HOMEPAGE_API = process.env.NEXT_PUBLIC_MAGAZINE_API || "https://skatehive.reelflip.com";

export function useHomepageConfig(
  previewToken?: string | null,
  initial?: HomepageConfigDoc | null,
): { config: HomepageConfigDoc | null; loaded: boolean; preview: boolean } {
  const [config, setConfig] = useState<HomepageConfigDoc | null>(initial ?? null);
  const [loaded, setLoaded] = useState<boolean>(initial != null);

  useEffect(() => {
    let live = true;
    const url = previewToken
      ? `${HOMEPAGE_API}/api/homepage/draft?token=${encodeURIComponent(previewToken)}`
      : `${HOMEPAGE_API}/api/homepage/current?project=skatehive`;
    fetch(url, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { config?: HomepageConfigDoc | null }) => {
        if (!live) return;
        setConfig(data?.config ?? null);
        setLoaded(true);
      })
      .catch(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [previewToken]);

  return { config, loaded, preview: !!previewToken };
}
