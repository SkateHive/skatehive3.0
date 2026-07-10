"use client";

import { Box, Flex, Spinner } from "@chakra-ui/react";
import { useHomepageConfig } from "@/hooks/useHomepageConfig";
import type { HomepageConfigDoc } from "@/types/homepage-config";
import { P, MONO } from "@/components/home-magazine/palette";
import { SideIndex } from "@/components/home-magazine/SideIndex";
import { HeroCarousel } from "@/components/home-magazine/HeroCarousel";
import { FeaturedGrid } from "@/components/home-magazine/FeaturedGrid";
import { JunkAndVideo } from "@/components/home-magazine/JunkAndVideo";
import { SpotAndRewards } from "@/components/home-magazine/SpotAndRewards";
import { CommunityBanner, PreviewRibbon } from "@/components/home-magazine/BannerAndFooter";

// Sidebar-index layout: the magazine keeps the app's original Skatehive sidebar
// (rendered by RootLayoutClient) and, to its right, a fixed 240px index rail +
// a content column. This flows INSIDE the app's scroll container (no own
// 100vh/overflow), so the rail sticks and the app chrome stays intact.
export default function HomeMagazineClient({
  initialConfig,
  previewToken,
}: {
  initialConfig: HomepageConfigDoc | null;
  previewToken: string | null;
}) {
  const { config, loaded, preview } = useHomepageConfig(previewToken, initialConfig);

  return (
    <Box bg={P.bg} color={P.body} fontFamily={MONO} minH="100%">
      {preview && <PreviewRibbon label="Preview — rascunho (não publicado)" />}
      {preview && <meta name="referrer" content="no-referrer" />}

      <Flex align="flex-start">
        <SideIndex bountyCount={config?.bounties.length ?? 0} />

        <Box flex="1" minW={0} px={{ base: "16px", md: "40px" }} pt="24px" pb="56px">
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
      </Flex>
    </Box>
  );
}
