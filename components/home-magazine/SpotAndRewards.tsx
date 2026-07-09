"use client";

import { useState } from "react";
import { Box, Button, Flex, Grid, Image, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import type { BountyRef, SpotPick } from "@/types/homepage-config";
import { useCommunityRewards } from "@/hooks/useCommunityRewards";
import { P, MONO } from "./palette";

type LiveSpot = { id: string; name: string; image: string | null; coords: string | null };

export function SpotAndRewards({ spot, bounties }: { spot: SpotPick | null; bounties: BountyRef[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState<LiveSpot | null>(
    spot ? { id: spot.id, name: spot.name, image: spot.image || null, coords: spot.coords } : null,
  );
  const [loadingSpot, setLoadingSpot] = useState(false);
  const { totalUsd, loading: rewardsLoading } = useCommunityRewards();

  async function another() {
    setLoadingSpot(true);
    try {
      const ex = current?.id ? `?exclude=${encodeURIComponent(current.id)}` : "";
      const res = await fetch(`/api/spotmap/featured${ex}`, { cache: "no-store" });
      const data = await res.json();
      const s = data?.spot;
      if (s) setCurrent({ id: String(s.id), name: s.name, image: s.thumbnail ?? null, coords: s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : null });
    } catch {
      /* keep current */
    } finally {
      setLoadingSpot(false);
    }
  }

  const rewardsStr = rewardsLoading ? "—" : `$${Math.round(totalUsd).toLocaleString("en-US")}`;

  return (
    <Grid id="spots" templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap="24px" mx="32px" mt="48px" fontFamily={MONO}>
      {/* Discover a Spot */}
      <Box border={`2px solid ${P.card}`} p="24px">
        <Flex align="center" justify="space-between" mb="16px">
          <Text fontWeight={800} fontSize="18px" color={P.accent} textTransform="uppercase">Discover a Spot &#128757;</Text>
          <Button onClick={() => router.push("/map")} bg="none" border={`2px solid ${P.ghost}`} borderRadius={0} color={P.ui} fontFamily={MONO} fontSize="11px" fontWeight={700} letterSpacing="1px" px="14px" py="8px" h="auto" _hover={{ color: P.body, borderColor: P.faint }}>
            VIEW MORE
          </Button>
        </Flex>
        <Box position="relative">
          {current?.image ? (
            <Image src={current.image} alt="" w="100%" h="220px" objectFit="cover" display="block" opacity={loadingSpot ? 0.5 : 1} transition="opacity 0.2s" />
          ) : (
            <Flex w="100%" h="220px" align="center" justify="center" bg={P.card} color={P.faint} fontSize="13px">sem spot</Flex>
          )}
          {current?.coords && (
            <Box position="absolute" left="10px" top="10px" bg="rgba(10,10,10,0.8)" border={`1px solid ${P.accent}`} color={P.accent} fontSize="12px" px="8px" py="4px">
              &#128205; {current.coords}
            </Box>
          )}
        </Box>
        <Text fontSize="15px" color={P.body} my="14px" mb="16px">{current?.name ?? "—"}</Text>
        <Flex gap="12px">
          <Button flex={1} onClick={another} isDisabled={loadingSpot} bg="none" border={`2px solid ${P.accent}`} borderRadius={0} color={P.accent} fontFamily={MONO} fontWeight={700} letterSpacing="1px" py="12px" h="auto" _hover={{ bg: P.navTint }}>
            ANOTHER
          </Button>
          <Button flex={1} onClick={() => router.push("/map")} bg="none" border={`2px solid ${P.ghost}`} borderRadius={0} color={P.ui} fontFamily={MONO} fontWeight={700} letterSpacing="1px" py="12px" h="auto" _hover={{ color: P.body }}>
            VIEW ALL SPOTS
          </Button>
        </Flex>
      </Box>

      {/* Community Rewards */}
      <Flex id="rewards" direction="column" justify="space-between" border={`2px solid ${P.card}`} p="24px">
        <Box>
          <Text fontWeight={800} fontSize="18px" color={P.accent} textTransform="uppercase" mb="10px">Community Rewards</Text>
          <Text fontWeight={800} fontSize="44px" color={P.headline}>{rewardsStr} <Box as="span" fontSize="20px" color={P.ui}>USD</Box></Text>
          <Text fontSize="12px" color={P.ui} letterSpacing="1px" textTransform="uppercase" mt="4px">Paid out to skaters</Text>
        </Box>
        {bounties.length > 0 && (
          <Box mt="22px">
            <Text fontSize="11px" color={P.ui} letterSpacing="1px" textTransform="uppercase" mb="6px">Open Bounties &#127919;</Text>
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
        )}
        <Button onClick={() => router.push("/bounties")} mt="18px" bg={P.accent} border="none" borderRadius={0} color={P.onAccent} fontFamily={MONO} fontWeight={800} letterSpacing="1px" py="14px" h="auto" _hover={{ bg: P.accentHover }}>
          VIEW ALL BOUNTIES
        </Button>
      </Flex>
    </Grid>
  );
}
