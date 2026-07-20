"use client";

import { Box, Flex, Grid, Image, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { postHref, type StripCard } from "@/types/homepage-config";
import { P, MONO } from "./palette";

// FEATURED section for the sidebar-index layout: a 2-column grid of
// thumbnail + title items (was a full-bleed 4-up image strip).
export function FeaturedGrid({ cards }: { cards: StripCard[] }) {
  const router = useRouter();
  if (cards.length === 0) return null;
  return (
    <Box id="featured-grid" mt="40px" fontFamily={MONO}>
      <Text fontWeight={800} fontSize="13px" letterSpacing="2px" textTransform="uppercase" color={P.accent} mb="18px">
        Featured
      </Text>
      <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} columnGap={{ base: "16px", md: "32px" }} rowGap="24px">
        {cards.map((c) => {
          const href = postHref(c.postRef);
          return (
            <Flex key={c.id} className={href ? "cursor-target" : undefined} gap={{ base: "12px", md: "16px" }} cursor={href ? "pointer" : "default"} onClick={() => href && router.push(href)} align="flex-start">
              <Image src={c.image} alt="" w={{ base: "90px", md: "120px" }} h={{ base: "68px", md: "90px" }} objectFit="cover" flexShrink={0} filter="grayscale(10%)" />
              <Box minW={0}>
                {c.category && (
                  <Text fontSize="11px" fontWeight={800} letterSpacing="1.5px" textTransform="uppercase" color={P.accent} mb="4px">
                    {c.category}
                  </Text>
                )}
                <Text fontWeight={700} fontSize={{ base: "14px", md: "16px" }} color={P.body} lineHeight="1.3" _hover={{ color: P.headline }}>
                  {c.title}
                </Text>
              </Box>
            </Flex>
          );
        })}
      </Grid>
    </Box>
  );
}
