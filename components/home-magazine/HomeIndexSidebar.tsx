"use client";

import { useState } from "react";
import { Box, Button, Flex, Image, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { useCommunityRewards } from "@/hooks/useCommunityRewards";
import { useHomepageConfig } from "@/hooks/useHomepageConfig";
import { P, MONO } from "./palette";

// The app's Sidebar renders THIS on /home (see components/layout/Sidebar.tsx) —
// the magazine index rail becomes the sidebar itself (one rail, matching the
// design), replacing the normal app nav on that route only. Logo + vertical
// section nav (anchor-scrolls the content) + live "paid to skaters" + Community
// CTA + socials. Full-height, dark terminal palette, hidden on mobile.
const NAV = [
  { label: "Featured", id: "featured" },
  { label: "Videos", id: "videos" },
  { label: "Spots", id: "spots" },
  { label: "Leaderboard", id: "rewards" },
];

export function HomeIndexSidebar() {
  const router = useRouter();
  const [active, setActive] = useState("featured");
  const { totalUsd, loading } = useCommunityRewards();
  const { config } = useHomepageConfig(); // published config → open-bounty count
  const bountyCount = config?.bounties.length ?? 0;

  const go = (id: string) => {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Flex
      as="nav"
      direction="column"
      display={{ base: "none", md: "flex" }}
      w="240px"
      flexShrink={0}
      h="100vh"
      bg={P.bg}
      borderRight={`2px solid ${P.card}`}
      fontFamily={MONO}
      py="20px"
    >
      <Flex align="center" gap="12px" px="20px" pb="20px" cursor="pointer" onClick={() => go("featured")}>
        <Image src="/SKATE_HIVE_VECTOR_FIN.svg" alt="Skatehive" boxSize="44px" objectFit="contain" />
        <Text fontSize="11px" color={P.faint} letterSpacing="2px" textTransform="uppercase" lineHeight="1.3">
          Skateboard<br />Media
        </Text>
      </Flex>

      <Flex direction="column" mt="6px">
        {NAV.map((n) => {
          const on = active === n.id;
          return (
            <Box
              key={n.id}
              as="button"
              onClick={() => go(n.id)}
              textAlign="left"
              px="20px"
              py="12px"
              fontSize="14px"
              fontWeight={700}
              letterSpacing="1px"
              textTransform="uppercase"
              color={on ? P.headline : P.ui}
              bg={on ? P.navTint : "transparent"}
              borderLeft={`3px solid ${on ? P.accent : "transparent"}`}
              _hover={{ color: P.accentHover }}
            >
              {n.label}
            </Box>
          );
        })}
      </Flex>

      <Box mx="20px" mt="24px" p="16px" border={`1px solid ${P.card}`}>
        <Text fontSize="10px" color={P.ui} letterSpacing="1px" textTransform="uppercase" mb="6px">Paid to skaters</Text>
        <Text fontWeight={800} fontSize="24px" color={P.accent} lineHeight="1.1">
          {loading ? "—" : `$${Math.round(totalUsd).toLocaleString("en-US")}`}
        </Text>
        {bountyCount > 0 && <Text fontSize="11px" color={P.faint} mt="4px">{bountyCount} open {bountyCount === 1 ? "bounty" : "bounties"}</Text>}
      </Box>

      <Box flex={1} />

      <Box px="20px">
        <Button
          onClick={() => router.push("/")}
          w="100%"
          bg={P.accent}
          color={P.onAccent}
          borderRadius={0}
          fontFamily={MONO}
          fontWeight={800}
          fontSize="14px"
          letterSpacing="1.5px"
          textTransform="uppercase"
          py="12px"
          h="auto"
          _hover={{ bg: P.accentHover }}
        >
          Community
        </Button>
        <Flex gap="14px" mt="14px" fontSize="11px" color={P.ui} letterSpacing="1px">
          <Box as="a" href="https://instagram.com/skatehive" target="_blank" rel="noopener" _hover={{ color: P.accentHover }}>IG</Box>
          <Box as="a" href="https://youtube.com/@skatehive" target="_blank" rel="noopener" _hover={{ color: P.accentHover }}>YT</Box>
          <Box as="a" href="https://discord.gg/skatehive" target="_blank" rel="noopener" _hover={{ color: P.accentHover }}>DISCORD</Box>
        </Flex>
      </Box>
    </Flex>
  );
}
