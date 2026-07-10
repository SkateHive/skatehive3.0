"use client";

import { Box, Flex, Image, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { useMagazineIssues } from "@/hooks/useCuratedMagazine";
import { MONO, P } from "./palette";

/**
 * Floating "latest magazine cover" card that lives in the bottom-right of
 * the viewport on /home — the Thrasher "GET THE MAG" pattern, minus the
 * layout hijack. Uses `position: fixed` so the main content column keeps
 * its full width instead of being squeezed to make room for a sidebar.
 *
 * Sources the newest issue via useMagazineIssues() (portal archive,
 * newest first). Prefers the currently-active issue. Hidden below lg —
 * there's no room on narrower screens without covering something
 * important.
 */
export function MagazineRail() {
  const { issues, loaded } = useMagazineIssues();

  if (!loaded) return null;
  const issue = issues.find((i) => i.active) ?? issues[0];
  if (!issue || !issue.coverUrl) return null;

  const label = `Issue #${issue.number}`;

  return (
    <Box
      as="aside"
      display={{ base: "none", lg: "block" }}
      position="fixed"
      right={{ lg: "20px", xl: "32px" }}
      bottom={{ lg: "20px", xl: "28px" }}
      w={{ lg: "160px", xl: "180px" }}
      zIndex={40}
      fontFamily={MONO}
    >
      <Box
        as={NextLink}
        href="/magazine"
        display="block"
        cursor="pointer"
        transition="transform 0.25s ease, box-shadow 0.25s ease"
        _hover={{ transform: "translateY(-3px)" }}
        aria-label={`Open the latest Skatehive magazine (${label})`}
        sx={{ "&, &:hover, &:focus": { textDecoration: "none" } }}
      >
        <Text
          color={P.accent}
          fontSize="9px"
          fontWeight={800}
          letterSpacing="3px"
          textTransform="uppercase"
          borderBottom={`2px solid ${P.accent}`}
          pb="4px"
          mb="8px"
          display="inline-block"
        >
          Latest
        </Text>

        <Box
          position="relative"
          w="100%"
          overflow="hidden"
          border={`2px solid ${P.accent}`}
          bg={P.card}
          boxShadow="0 12px 30px rgba(0,0,0,0.7), 0 0 18px rgba(203,255,62,0.15)"
          sx={{ aspectRatio: "3 / 4" }}
        >
          <Image
            src={issue.coverUrl}
            alt={`${label} cover`}
            w="100%"
            h="100%"
            objectFit="cover"
            loading="lazy"
          />
          <Box
            position="absolute"
            left={0}
            right={0}
            bottom={0}
            h="42%"
            bg="linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.9) 100%)"
            pointerEvents="none"
          />
          <Box position="absolute" left="8px" right="8px" bottom="8px">
            <Text
              color={P.headline}
              fontSize="13px"
              fontWeight={900}
              letterSpacing="-0.3px"
              lineHeight="1"
              textShadow="0 2px 6px rgba(0,0,0,0.75)"
            >
              {label}
            </Text>
          </Box>
        </Box>

        <Flex mt="6px" align="baseline" justify="space-between">
          <Text color={P.headline} fontSize="10px" fontWeight={800} letterSpacing="1.2px" textTransform="uppercase">
            Read →
          </Text>
          <Text color={P.ui} fontSize="9px" letterSpacing="1px">
            {issue.postCount}p
          </Text>
        </Flex>
      </Box>
    </Box>
  );
}
