"use client";

import { Box, Grid, Image, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { postHref, type StripCard } from "@/types/homepage-config";
import { P, MONO } from "./palette";

export function FeaturedStrip({ cards }: { cards: StripCard[] }) {
  const router = useRouter();
  if (cards.length === 0) return null;
  return (
    <Grid templateColumns={{ base: "repeat(2,1fr)", md: "repeat(4,1fr)" }} gap="2px" mx="32px" mt="2px" bg={P.card} fontFamily={MONO}>
      {cards.map((c) => {
        const href = postHref(c.postRef);
        return (
          <Box key={c.id} bg={P.bg} cursor={href ? "pointer" : "default"} onClick={() => href && router.push(href)}>
            <Box position="relative" style={{ aspectRatio: "4 / 3" }} overflow="hidden">
              <Image src={c.image} alt="" w="100%" h="100%" objectFit="cover" filter="grayscale(10%)" />
              <Box position="absolute" inset={0} bg="linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.85) 100%)" />
              <Text position="absolute" left="12px" bottom="12px" right="12px" fontSize="14px" fontWeight={700} color="#f0f0f0" lineHeight="1.3">
                {c.title}
              </Text>
            </Box>
          </Box>
        );
      })}
    </Grid>
  );
}
