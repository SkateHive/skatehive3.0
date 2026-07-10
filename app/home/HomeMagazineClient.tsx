"use client";

import { Box, Flex, Spinner } from "@chakra-ui/react";
import { useHomepageConfig } from "@/hooks/useHomepageConfig";
import type { HomepageConfigDoc } from "@/types/homepage-config";
import { P, MONO } from "@/components/home-magazine/palette";
import { HeroCarousel } from "@/components/home-magazine/HeroCarousel";
import { FeaturedGrid } from "@/components/home-magazine/FeaturedGrid";
import { JunkAndVideo } from "@/components/home-magazine/JunkAndVideo";
import { SpotAndRewards } from "@/components/home-magazine/SpotAndRewards";
import { CommunityBanner, PreviewRibbon } from "@/components/home-magazine/BannerAndFooter";

// Magazine content column. The magazine INDEX rail is the app's own Sidebar on
// /home (see components/layout/Sidebar.tsx → HomeIndexSidebar), so here we only
// render the content — it flows inside the app's scroll container, beside that
// rail. The rail's nav anchor-scrolls to the section ids below.
export default function HomeMagazineClient({
  initialConfig,
  previewToken,
}: {
  initialConfig: HomepageConfigDoc | null;
  previewToken: string | null;
}) {
  const { config, loaded, preview } = useHomepageConfig(previewToken, initialConfig);

  return (
    <Box bg={P.bg} color={P.body} fontFamily={MONO} minH="100%" px={{ base: "16px", md: "40px" }} pt="24px" pb="56px">
      {preview && <PreviewRibbon label="Preview — rascunho (não publicado)" />}
      {preview && <meta name="referrer" content="no-referrer" />}

      {!config && !loaded && (
        <Flex align="center" justify="center" h="60vh"><Spinner color={P.accent} /></Flex>
      )}
      {config && (
        <>
          <HeroCarousel slides={config.heroSlides} />
          <FeaturedGrid cards={config.strip} />
          <JunkAndVideo items={config.junkDrawer} video={config.featuredVideo} />
          <SpotAndRewards spot={config.spot} bounties={config.bounties} />
          <CommunityBanner headline={config.banner.headline} subtext={config.banner.subtext} ctaLabel={config.banner.ctaLabel} />
        </>
      )}
    </Box>
  );
}
