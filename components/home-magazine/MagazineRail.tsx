"use client";

import { Box, Flex, Image, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { useMagazineIssues } from "@/hooks/useCuratedMagazine";
import { MONO, P } from "./palette";

/**
 * Sticky "latest magazine cover" rail that follows the scroll on the /home
 * route — the same idea Thrasher uses to keep the current issue visible on
 * the right side while you browse the front page.
 *
 * Sources the newest issue from useMagazineIssues() (returns the portal's
 * accumulating archive newest-first). Hidden below lg because the main
 * column is already narrow at those breakpoints — the rail lives to
 * decorate desktop, not squeeze mobile.
 */
export function MagazineRail() {
  const { issues, loaded } = useMagazineIssues();

  if (!loaded) return <RailSkeleton />;

  // Prefer the currently-active issue (the one the ops portal marks live),
  // fall back to the newest published cover.
  const issue = issues.find((i) => i.active) ?? issues[0];
  if (!issue || !issue.coverUrl) return null;

  const label = `Issue #${issue.number}`;
  const postsSuffix = `${issue.postCount} post${issue.postCount === 1 ? "" : "s"}`;

  return (
    <Box
      as="aside"
      display={{ base: "none", lg: "block" }}
      position="sticky"
      top="24px"
      w="280px"
      flexShrink={0}
      alignSelf="flex-start"
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
          fontSize="11px"
          fontWeight={800}
          letterSpacing="3px"
          textTransform="uppercase"
          borderBottom={`2px solid ${P.accent}`}
          pb="6px"
          mb="14px"
          display="inline-block"
        >
          Latest issue
        </Text>

        <Box
          position="relative"
          w="100%"
          overflow="hidden"
          border={`2px solid ${P.accent}`}
          bg={P.card}
          boxShadow="0 14px 40px rgba(0,0,0,0.65), 0 0 24px rgba(203,255,62,0.14)"
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
          {/* Bottom-edge gradient so the label overlay never gets eaten by
              a light cover art. */}
          <Box
            position="absolute"
            left={0}
            right={0}
            bottom={0}
            h="45%"
            bg="linear-gradient(180deg, transparent 0%, rgba(10,10,10,0.85) 100%)"
            pointerEvents="none"
          />
          <Box position="absolute" left="12px" right="12px" bottom="12px">
            <Text
              color={P.accent}
              fontSize="10px"
              fontWeight={700}
              letterSpacing="2px"
              textTransform="uppercase"
              mb="2px"
            >
              Skatehive
            </Text>
            <Text
              color={P.headline}
              fontSize="18px"
              fontWeight={900}
              letterSpacing="-0.5px"
              lineHeight="1"
              textShadow="0 2px 8px rgba(0,0,0,0.75)"
            >
              {label}
            </Text>
          </Box>
        </Box>

        <Flex mt="12px" align="baseline" justify="space-between">
          <Text
            color={P.headline}
            fontSize="13px"
            fontWeight={800}
            letterSpacing="1px"
            textTransform="uppercase"
          >
            Read now →
          </Text>
          <Text color={P.ui} fontSize="11px" letterSpacing="1px">
            {postsSuffix}
          </Text>
        </Flex>
      </Box>
    </Box>
  );
}

function RailSkeleton() {
  return (
    <Box
      display={{ base: "none", lg: "block" }}
      position="sticky"
      top="24px"
      w="280px"
      flexShrink={0}
      alignSelf="flex-start"
    >
      <Box w="100%" sx={{ aspectRatio: "3 / 4" }} bg="rgba(255,255,255,0.04)" />
    </Box>
  );
}
