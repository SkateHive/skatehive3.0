"use client";
import Magazine from "@/components/shared/Magazine";
import TopBar from "@/components/blog/TopBar";
import { Box } from "@chakra-ui/react";
import { HIVE_CONFIG } from "@/config/app.config";
import { useCuratedMagazine } from "@/hooks/useCuratedMagazine";

// The ops portal curates the magazine (which posts + order); this page shows the
// published edition and falls back to the community feed when none is published.
export default function MagazinePage() {
  const communityTag = HIVE_CONFIG.COMMUNITY_TAG;
  const tag = [{ tag: communityTag, limit: 20 }]; // Bridge API max limit is 20
  const query = "created";

  const { curated, loaded } = useCuratedMagazine(true);

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
