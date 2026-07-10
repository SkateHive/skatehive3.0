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
        <Text fontWeight={800} fontSize="26px" letterSpacing="1px" textTransform="uppercase" color={P.accent} mb="18px">
          Junk Drawer
        </Text>
        {items.map((j) => {
          const href = postHref(j.postRef);
          return (
            <Flex key={j.id} gap="16px" py="16px" borderTop={`1px solid ${P.card}`} cursor={href ? "pointer" : "default"} onClick={() => href && router.push(href)}>
              <Image src={j.thumb} alt="" w="100px" h="75px" objectFit="cover" flexShrink={0} filter="grayscale(15%)" />
              <Box>
                <Text fontWeight={700} fontSize="16px" color={P.body} mb="6px">{j.title}</Text>
                <Text fontSize="13px" color={P.ui} lineHeight="1.5">{j.blurb}</Text>
              </Box>
            </Flex>
          );
        })}
      </Box>

      {video && (
        <Box position="relative" border={`2px solid ${P.card}`} cursor={postHref(video.postRef) ? "pointer" : "default"} onClick={() => { const h = postHref(video.postRef); if (h) router.push(h); }}>
          <Image src={video.cover} alt="" w="100%" h="100%" objectFit="cover" display="block" minH="420px" />
          <Box position="absolute" inset={0} bg="linear-gradient(180deg, rgba(10,10,10,0) 55%, rgba(10,10,10,0.92) 100%)" />
          <Flex position="absolute" top="50%" left="50%" transform="translate(-50%,-50%)" w="74px" h="74px" borderRadius="50%" bg={P.accent} align="center" justify="center" color={P.onAccent} fontSize="28px">
            &#9654;
          </Flex>
          <Box position="absolute" left="24px" right="24px" bottom="22px">
            <Text fontWeight={800} fontSize="22px" color={P.headline} textTransform="uppercase">{video.title}</Text>
            {video.caption && <Text fontSize="13px" color="#a8a8a8" mt="6px">{video.caption}</Text>}
          </Box>
        </Box>
      )}
    </Grid>
  );
}
