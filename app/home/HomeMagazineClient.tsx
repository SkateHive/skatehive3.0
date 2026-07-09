"use client";

import { useRef } from "react";
import { Box, Flex, Spinner } from "@chakra-ui/react";
import { useHomepageConfig } from "@/hooks/useHomepageConfig";
import type { HomepageConfigDoc } from "@/types/homepage-config";
import { P, MONO } from "@/components/home-magazine/palette";
import { TopNav } from "@/components/home-magazine/TopNav";
import { HeroCarousel } from "@/components/home-magazine/HeroCarousel";
import { FeaturedStrip } from "@/components/home-magazine/FeaturedStrip";
import { JunkAndVideo } from "@/components/home-magazine/JunkAndVideo";
import { SpotAndRewards } from "@/components/home-magazine/SpotAndRewards";
import { CommunityBanner, MagFooter, PreviewRibbon } from "@/components/home-magazine/BannerAndFooter";

// The media-magazine homepage shell. Owns its OWN scroll container
// (overflowY:auto; height:100vh) because sk3's globals force
// html,body{overflow:hidden} on desktop — anchor nav scrolls within THIS box,
// not the window. RootLayoutClient renders /home full-bleed (no sidebar/tabbar).
export default function HomeMagazineClient({
  initialConfig,
  previewToken,
}: {
  initialConfig: HomepageConfigDoc | null;
  previewToken: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { config, loaded, preview } = useHomepageConfig(previewToken, initialConfig);

  const navigate = (anchor: string) => {
    const root = scrollRef.current;
    if (!root) return;
    if (anchor === "top") {
      root.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const el = root.querySelector(`#${anchor}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Box ref={scrollRef} bg={P.bg} color={P.body} fontFamily={MONO} h="100vh" overflowY="auto" overflowX="hidden" sx={{ scrollbarWidth: "thin" }}>
      {preview && <PreviewRibbon label="Preview — rascunho (não publicado)" />}
      {/* no-referrer so the ?preview=<token> never leaks to image/API hosts */}
      {preview && <meta name="referrer" content="no-referrer" />}

      <TopNav onNavigate={navigate} />

      {!config && !loaded && (
        <Flex align="center" justify="center" h="60vh"><Spinner color={P.accent} /></Flex>
      )}

      {config && (
        <>
          <HeroCarousel slides={config.heroSlides} />
          <FeaturedStrip cards={config.strip} />
          <JunkAndVideo items={config.junkDrawer} video={config.featuredVideo} />
          <SpotAndRewards spot={config.spot} bounties={config.bounties} />
          <CommunityBanner headline={config.banner.headline} subtext={config.banner.subtext} ctaLabel={config.banner.ctaLabel} />
          <MagFooter tagline={config.footer.tagline} />
          <Box h="40px" />
        </>
      )}
    </Box>
  );
}
