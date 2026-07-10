"use client";

import { Box, Flex, Spinner } from "@chakra-ui/react";
import { useHomepageConfig } from "@/hooks/useHomepageConfig";
import type { HomepageConfigDoc } from "@/types/homepage-config";
import type { FeaturedSpot } from "@/lib/spotmap/featured";
import { MONO } from "@/components/home-magazine/palette";
import { HeroCarousel } from "@/components/home-magazine/HeroCarousel";
import { FeaturedGrid } from "@/components/home-magazine/FeaturedGrid";
import { JunkAndVideo } from "@/components/home-magazine/JunkAndVideo";
import { SpotAndRewards } from "@/components/home-magazine/SpotAndRewards";
import { CommunityBanner, PreviewRibbon } from "@/components/home-magazine/BannerAndFooter";
import { MagazineRail } from "@/components/home-magazine/MagazineRail";

// Magazine content. /home uses the SAME chrome as every other page — the normal
// Skatehive sidebar/navbar, the theme `background`, and the app's Container
// proportions (RootLayoutClient). This just renders the curated sections inside
// the standard content area, so /home reads as part of the app, not a bespoke
// full-bleed page.
export default function HomeMagazineClient({
  initialConfig,
  previewToken,
  initialFeaturedSpot = null,
}: {
  initialConfig: HomepageConfigDoc | null;
  previewToken: string | null;
  initialFeaturedSpot?: FeaturedSpot | null;
}) {
  const { config, loaded, preview } = useHomepageConfig(previewToken, initialConfig);

  return (
    <Box bg="background" fontFamily={MONO} minH="100%" px={{ base: "16px", md: "32px" }} pt="20px" pb="48px">
      {preview && <PreviewRibbon label="Preview — rascunho (não publicado)" />}
      {preview && <meta name="referrer" content="no-referrer" />}

      {!config && !loaded && (
        <Flex align="center" justify="center" h="60vh"><Spinner color="primary" /></Flex>
      )}
      {config && (
        // Two-column flex on lg+: main content + sticky magazine cover rail.
        // Below lg the rail hides itself (display: none) and the main column
        // takes the whole width, so this compiles to the original layout on
        // narrow screens.
        <Flex align="flex-start" gap={{ base: 0, lg: "32px", xl: "40px" }}>
          <Box flex="1" minW={0}>
            <HeroCarousel slides={config.heroSlides} />
            <FeaturedGrid cards={config.strip} />
            <JunkAndVideo items={config.junkDrawer} video={config.featuredVideo} />
            <SpotAndRewards initialFeaturedSpot={initialFeaturedSpot} bounties={config.bounties} />
            <CommunityBanner headline={config.banner.headline} subtext={config.banner.subtext} ctaLabel={config.banner.ctaLabel} />
          </Box>
          <MagazineRail />
        </Flex>
      )}
    </Box>
  );
}
