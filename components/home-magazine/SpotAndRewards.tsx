"use client";

import { Box, Button, Flex, Grid, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import type { BountyRef } from "@/types/homepage-config";
import type { FeaturedSpot } from "@/lib/spotmap/featured";
import SpotNearYou from "@/components/homepage/SpotNearYou";
import { P, MONO } from "./palette";

export function SpotAndRewards({ initialFeaturedSpot, bounties }: { initialFeaturedSpot: FeaturedSpot | null; bounties: BountyRef[] }) {
  const router = useRouter();

  return (
    <Grid id="spots" templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="24px" mt="48px" fontFamily={MONO}>
      {/* Discover a Spot — the SAME location-based widget as the homepage. */}
      <Box>
        <SpotNearYou initialSpot={initialFeaturedSpot} />
      </Box>

      {/* Open Bounties (the rewards total lives in the index rail now) */}
      <Flex id="rewards" direction="column" justify="space-between" border={`2px solid ${P.card}`} p="24px">
        <Box>
          <Text fontWeight={800} fontSize="18px" color={P.accent} textTransform="uppercase" mb="10px">Open Bounties &#127919;</Text>
          <Box>
            {bounties.length === 0 && <Text fontSize="13px" color={P.faint}>Sem bounties abertos.</Text>}
            {bounties.map((b, i) => {
              const title = b.source === "poidh" ? b.name || `Bounty ${b.id}` : b.title;
              const sponsor = b.source === "poidh" ? `@${b.issuer?.slice(0, 8) ?? ""}` : b.sponsor;
              return (
                <Flex key={i} align="center" justify="space-between" py="10px" borderTop={`1px solid ${P.card}`} fontSize="14px">
                  <Flex align="center" gap="10px" minW={0}>
                    <Box w="8px" h="8px" bg={P.accent} flexShrink={0} />
                    <Box minW={0}>
                      <Text fontWeight={700} color={P.body} isTruncated>{title}</Text>
                      {sponsor && <Text fontSize="11px" color={P.faint} isTruncated>{sponsor}</Text>}
                    </Box>
                  </Flex>
                </Flex>
              );
            })}
          </Box>
        </Box>
        <Button onClick={() => router.push("/bounties")} mt="18px" bg={P.accent} border="none" borderRadius={0} color={P.onAccent} fontFamily={MONO} fontWeight={800} letterSpacing="1px" py="14px" h="auto" _hover={{ bg: P.accentHover }}>
          VIEW ALL BOUNTIES
        </Button>
      </Flex>
    </Grid>
  );
}
