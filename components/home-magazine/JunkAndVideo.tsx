"use client";

import { Box, Flex, Grid, Image, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { postHref, type FeaturedVideo, type JunkItem } from "@/types/homepage-config";
import { P, MONO } from "./palette";

export function JunkAndVideo({ items, video }: { items: JunkItem[]; video: FeaturedVideo | null }) {
  const router = useRouter();
  if (items.length === 0 && !video) return null;
  return (
    <Grid id="videos" templateColumns={{ base: "1fr", md: "1fr 1.3fr" }} gap="24px" mt="40px" fontFamily={MONO}>
      <Box>
        <Text fontWeight={800} fontSize={{ base: "20px", md: "26px" }} letterSpacing="1px" textTransform="uppercase" color={P.accent} mb="18px">
          Junk Drawer
        </Text>
        {items.map((j) => {
          const href = postHref(j.postRef);
          return (
            <Flex key={j.id} className={href ? "cursor-target" : undefined} gap={{ base: "12px", md: "16px" }} py="16px" borderTop={`1px solid ${P.card}`} cursor={href ? "pointer" : "default"} onClick={() => href && router.push(href)}>
              <Image src={j.thumb} alt="" w={{ base: "80px", md: "100px" }} h={{ base: "60px", md: "75px" }} objectFit="cover" flexShrink={0} filter="grayscale(15%)" />
              <Box minW={0}>
                <Text fontWeight={700} fontSize={{ base: "14px", md: "16px" }} color={P.body} mb="6px">{j.title}</Text>
                <Text fontSize={{ base: "12px", md: "13px" }} color={P.ui} lineHeight="1.5">{j.blurb}</Text>
              </Box>
            </Flex>
          );
        })}
      </Box>

      {video && (
        <Box
          className={postHref(video.postRef) ? "cursor-target" : undefined}
          cursor={postHref(video.postRef) ? "pointer" : "default"}
          onClick={() => {
            const h = postHref(video.postRef);
            if (h) router.push(h);
          }}
          display="flex"
          flexDirection="column"
          gap="20px"
        >
          {/* TV cabinet — dark padded gradient shell around the tube.
              tv-overlay.png is a tight crop (content edge-to-edge, no
              transparent margins) so the tube canNOT have border-radius
              or the PNG's rounded TV corners get sliced. Symmetric
              padding (15px all four sides) keeps the shell centered
              on the image vertically and horizontally. */}
          <Box
            width="100%"
            p="15px"
            borderRadius="22px"
            background="linear-gradient(150deg, #2c2b25 0%, #17170f 60%, #0f0f0a 100%)"
            boxShadow="inset 0 2px 3px rgba(255,255,255,0.07), inset 0 -4px 10px rgba(0,0,0,0.55), 0 10px 24px rgba(0,0,0,0.35)"
          >
            <Box
              position="relative"
              width="100%"
              overflow="hidden"
              sx={{ aspectRatio: "622 / 350" }}
            >
              {/* Screen hole — coords come from measuring the transparent
                  window of tv-overlay.png. Any content the viewer should
                  see "through the tube" goes inside this box. */}
              <Box
                position="absolute"
                left="6.11%"
                top="3.14%"
                width="70.10%"
                height="94.29%"
                overflow="hidden"
                bg="#0a0b09"
              >
                <Image
                  src={video.cover}
                  alt=""
                  position="absolute"
                  inset={0}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  objectPosition="center 40%"
                />
                {/* Faint green tube tint. */}
                <Box
                  position="absolute"
                  inset={0}
                  bg="rgba(70,90,20,0.14)"
                  mixBlendMode="screen"
                  pointerEvents="none"
                />
                {/* Horizontal scanlines. */}
                <Box
                  position="absolute"
                  inset={0}
                  pointerEvents="none"
                  background="repeating-linear-gradient(to bottom, rgba(0,0,0,0.28) 0px, rgba(0,0,0,0.28) 1px, rgba(0,0,0,0) 3px, rgba(0,0,0,0) 4px)"
                />
                {/* Rolling refresh bar — the CRT "sync" wobble. */}
                <Box
                  position="absolute"
                  left={0}
                  right={0}
                  height="40%"
                  pointerEvents="none"
                  background="linear-gradient(to bottom, rgba(255,255,255,0.09), rgba(255,255,255,0))"
                  sx={{
                    animation: "crtRoll 7s linear infinite",
                    "@keyframes crtRoll": {
                      "0%": { transform: "translateY(-100%)" },
                      "100%": { transform: "translateY(100%)" },
                    },
                  }}
                />
                {/* Corner vignette — dropped bottom weight so the lower
                    half of the display reads as clearly as the top. */}
                <Box
                  position="absolute"
                  inset={0}
                  pointerEvents="none"
                  background="radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 65%, rgba(0,0,0,0.22) 100%)"
                />
                {/* Play button — centered in the tube. */}
                <Flex
                  position="absolute"
                  inset={0}
                  align="center"
                  justify="center"
                >
                  <Flex
                    w={{ base: "56px", md: "66px" }}
                    h={{ base: "56px", md: "66px" }}
                    borderRadius="50%"
                    bg={P.accent}
                    color={P.onAccent}
                    align="center"
                    justify="center"
                    boxShadow="0 6px 26px rgba(198,238,26,0.4)"
                    transition="transform 0.15s ease, background 0.15s ease"
                    _hover={{ bg: P.accentHover, transform: "scale(1.06)" }}
                    fontSize={{ base: "22px", md: "28px" }}
                  >
                    &#9654;
                  </Flex>
                </Flex>
              </Box>
              {/* PNG bezel — the actual TV photo, screen keyed to
                  transparent. Sits above everything so the tube shows
                  through the alpha window. */}
              <Image
                src="/tv-overlay.png"
                alt=""
                position="absolute"
                inset={0}
                w="100%"
                h="100%"
                pointerEvents="none"
              />
            </Box>
          </Box>
          {/* Title below the set — the design intentionally puts it
              outside the tube (no gradient scrim covering the video). */}
          <Text
            fontWeight={800}
            fontSize={{ base: "18px", md: "24px" }}
            color={P.accent}
            textTransform="uppercase"
            letterSpacing="0.02em"
            lineHeight="1.3"
          >
            {video.title}
          </Text>
          {video.caption && (
            <Text fontSize="13px" color={P.bodyMuted} mt="-8px">
              {video.caption}
            </Text>
          )}
        </Box>
      )}
    </Grid>
  );
}
