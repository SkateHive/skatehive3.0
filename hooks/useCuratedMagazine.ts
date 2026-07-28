"use client";
import { useEffect, useState } from "react";
import { Discussion } from "@hiveio/dhive";

// Client hooks for the curated magazine served by the ops portal.
//   useCuratedMagazine() — the current (latest published) edition, mapped to the
//     flipbook's Discussion shape. Used by the blog MagazineModal + as the
//     default preview. Falls back to the community feed when nothing published.
//   useMagazineIssues() — the accumulating archive (covers) for the selector.
//   fetchMagazineIssue(number) — one edition (posts + cover) for opening it.
const MAGAZINE_API =
  process.env.NEXT_PUBLIC_MAGAZINE_API || "https://skatehive.reelflip.com";

type PortalPost = {
  author: string;
  permlink: string;
  title: string;
  body: string;
  created: string;
  payout?: number;
  thumbnail?: string | null;
};

export type MagazineIssueSummary = {
  number: number;
  title: string;
  coverUrl: string | null;
  publishedAt: string | null;
  postCount: number;
  active: boolean;
};

/** Map the portal feed → the Discussion shape the flipbook renders. */
function mapPortalPosts(raw: unknown): Discussion[] {
  const posts = Array.isArray(raw) ? (raw as PortalPost[]) : [];
  return posts.map(
    (p) =>
      ({
        author: p.author,
        permlink: p.permlink,
        title: p.title,
        body: p.body,
        created: p.created,
        pending_payout_value: `${(p.payout ?? 0).toFixed(3)} HBD`,
        json_metadata: JSON.stringify({ image: p.thumbnail ? [p.thumbnail] : [] }),
      }) as unknown as Discussion,
  );
}

export function useCuratedMagazine(enabled: boolean = true): { curated: Discussion[] | null; coverUrl: string | null; loaded: boolean } {
  const [curated, setCurated] = useState<Discussion[] | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
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
        const mapped = mapPortalPosts(data?.posts);
        if (mapped.length > 0) {
          setCurated(mapped);
          setCoverUrl(data?.issue?.coverUrl ?? null);
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

  return { curated, coverUrl, loaded };
}

/** The accumulating published-edition archive (newest first) for the cover selector. */
export function useMagazineIssues(): { issues: MagazineIssueSummary[]; loaded: boolean } {
  const [issues, setIssues] = useState<MagazineIssueSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${MAGAZINE_API}/api/magazine/issues?project=skatehive`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!live) return;
        if (Array.isArray(data?.issues)) setIssues(data.issues as MagazineIssueSummary[]);
        setLoaded(true);
      })
      .catch(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return { issues, loaded };
}

/** Posts + cover of a specific published edition (for opening a chosen cover). */
export async function fetchMagazineIssue(number: number): Promise<{ posts: Discussion[]; coverUrl: string | null }> {
  try {
    const r = await fetch(`${MAGAZINE_API}/api/magazine/issue?project=skatehive&number=${number}`);
    if (!r.ok) return { posts: [], coverUrl: null };
    const data = await r.json();
    return { posts: mapPortalPosts(data?.posts), coverUrl: data?.issue?.coverUrl ?? null };
  } catch {
    return { posts: [], coverUrl: null };
  }
}
