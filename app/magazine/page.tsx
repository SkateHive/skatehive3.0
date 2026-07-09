"use client";
import { useEffect, useState } from "react";
import { Discussion } from "@hiveio/dhive";
import Magazine from "@/components/shared/Magazine";
import TopBar from "@/components/blog/TopBar";
import { Box } from "@chakra-ui/react";
import { HIVE_CONFIG } from "@/config/app.config";

// The ops portal curates the magazine (which posts + order) and serves the
// published issue here. Falls back to the community feed if none is published.
const MAGAZINE_API =
  process.env.NEXT_PUBLIC_MAGAZINE_API || "https://skatehive.reelflip.com";

export default function MagazinePage() {
  // Fallback: latest community posts (the original behavior).
  const communityTag = HIVE_CONFIG.COMMUNITY_TAG;
  const tag = [{ tag: communityTag, limit: 20 }]; // Bridge API max limit is 20
  const query = "created";

  const [curated, setCurated] = useState<Discussion[] | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`${MAGAZINE_API}/api/magazine/current?project=skatehive`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!live) return;
        const posts = Array.isArray(data?.posts) ? data.posts : [];
        if (posts.length > 0) {
          // Map the portal feed → the Discussion shape the flipbook renders.
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
                  json_metadata: JSON.stringify({
                    image: p.thumbnail ? [p.thumbnail] : [],
                  }),
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
  }, []);

  return (
    <Box
      id="scrollableDiv"
      maxW="container.lg"
      mx="auto"
      maxH="100vh"
      overflowY="auto"
      p={0}
      sx={{
        "&::-webkit-scrollbar": { display: "none" },
        scrollbarWidth: "none",
      }}
    >
      <TopBar viewMode="magazine" setViewMode={() => {}} setQuery={() => {}} />
      {loaded && curated && curated.length > 0 ? (
        <Magazine posts={curated} preserveOrder />
      ) : (
        <Magazine tag={tag} query={query} />
      )}
    </Box>
  );
}
