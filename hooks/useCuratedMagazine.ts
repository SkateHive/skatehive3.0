"use client";
import { useEffect, useState } from "react";
import { Discussion } from "@hiveio/dhive";

// Fetches the curated magazine issue published by the ops portal and maps it to
// the Discussion shape the flipbook renders. Shared by the /magazine page and
// the blog's MagazineModal so both show the same curated edition (with a
// fallback to the community feed when nothing is published). `enabled` lets the
// profile magazine skip the fetch.
const MAGAZINE_API =
  process.env.NEXT_PUBLIC_MAGAZINE_API || "https://skatehive.reelflip.com";

export function useCuratedMagazine(enabled: boolean = true): { curated: Discussion[] | null; loaded: boolean } {
  const [curated, setCurated] = useState<Discussion[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoaded(true);
      return;
    }
    let live = true;
    fetch(`${MAGAZINE_API}/api/magazine/current?project=skatehive`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!live) return;
        const posts = Array.isArray(data?.posts) ? data.posts : [];
        if (posts.length > 0) {
          setCurated(
            posts.map(
              (p: {
                author: string;
                permlink: string;
                title: string;
                body: string;
                created: string;
                payout?: number;
                thumbnail?: string | null;
              }) =>
                ({
                  author: p.author,
                  permlink: p.permlink,
                  title: p.title,
                  body: p.body,
                  created: p.created,
                  pending_payout_value: `${(p.payout ?? 0).toFixed(3)} HBD`,
                  json_metadata: JSON.stringify({ image: p.thumbnail ? [p.thumbnail] : [] }),
                }) as unknown as Discussion,
            ),
          );
        }
        setLoaded(true);
      })
      .catch(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [enabled]);

  return { curated, loaded };
}
