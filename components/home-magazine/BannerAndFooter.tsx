"use client";

import { Box, Button, Flex, Text } from "@chakra-ui/react";
import { useRouter } from "next/navigation";
import { P, MONO } from "./palette";

export function CommunityBanner({ headline, subtext, ctaLabel }: { headline: string; subtext: string; ctaLabel: string }) {
  const router = useRouter();
  return (
    <Flex mt="56px" bg={P.accent} px="44px" py="48px" align="center" justify="space-between" gap="32px" wrap="wrap" fontFamily={MONO}>
      <Box maxW="640px">
        <Text fontWeight={800} fontSize="32px" color={P.onAccent} textTransform="uppercase" lineHeight="1.15">{headline}</Text>
        {subtext && <Text fontSize="15px" color={P.onAccentSoft} mt="12px">{subtext}</Text>}
      </Box>
      <Button className="cursor-target" onClick={() => router.push("/")} bg={P.onAccent} color={P.accent} border="none" borderRadius={0} fontFamily={MONO} fontWeight={800} fontSize="16px" letterSpacing="1px" px="32px" py="18px" h="auto" whiteSpace="nowrap" _hover={{ opacity: 0.9 }}>
        {ctaLabel || "ENTER COMMUNITY"} &#8594;
      </Button>
    </Flex>
  );
}

export function MagFooter({ tagline }: { tagline: string }) {
  return (
    <Flex mx="32px" mt="56px" py="28px" borderTop={`2px solid ${P.card}`} align="center" justify="space-between" wrap="wrap" gap="12px" fontFamily={MONO}>
      <Text fontSize="12px" color={P.faint} letterSpacing="1px">{tagline}</Text>
      <Flex gap="20px" fontSize="12px" color={P.ui} letterSpacing="1px">
        <Box as="a" href="https://instagram.com/skatehive" target="_blank" rel="noopener" color={P.ui} _hover={{ color: P.accentHover }}>INSTAGRAM</Box>
        <Box as="a" href="https://youtube.com/@skatehive" target="_blank" rel="noopener" color={P.ui} _hover={{ color: P.accentHover }}>YOUTUBE</Box>
        <Box as="a" href="https://discord.gg/skatehive" target="_blank" rel="noopener" color={P.ui} _hover={{ color: P.accentHover }}>DISCORD</Box>
      </Flex>
    </Flex>
  );
}

export function PreviewRibbon({ label }: { label: string }) {
  return (
    <Box position="sticky" top={0} zIndex={60} bg={P.accent} color={P.onAccent} fontFamily={MONO} fontWeight={800} fontSize="12px" letterSpacing="2px" textAlign="center" py="6px" textTransform="uppercase">
      {label}
    </Box>
  );
}
