"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Discussion } from "@hiveio/dhive";
import { Box, Flex, Image, Spinner, Text } from "@chakra-ui/react";
import { fetchMagazineIssue, useMagazineIssues } from "@/hooks/useCuratedMagazine";
import { MONO, P } from "./palette";

// MagazineModal pulls in the flipbook + PDF stack — big bundle. Only load
// it when someone actually clicks "Read", not on every /home visit.
const MagazineModal = dynamic(() => import("@/components/shared/MagazineModal"), {
  ssr: false,
});

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
  const [openPosts, setOpenPosts] = useState<Discussion[] | null>(null);
  const [openCover, setOpenCover] = useState<string | null>(null);
  const [loadingIssue, setLoadingIssue] = useState(false);

  if (!loaded) return null;
  const issue = issues.find((i) => i.active) ?? issues[0];
  if (!issue || !issue.coverUrl) return null;

  const label = `Issue #${issue.number}`;

  async function open() {
    if (!issue || loadingIssue) return;
    setLoadingIssue(true);
    const { posts, coverUrl } = await fetchMagazineIssue(issue.number);
    setLoadingIssue(false);
    if (posts.length > 0) {
      setOpenCover(coverUrl);
      setOpenPosts(posts);
    }
  }

  return (
    <>
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
          as="button"
          type="button"
          className="cursor-target"
          onClick={open}
          disabled={loadingIssue}
          display="block"
          cursor="pointer"
          width="100%"
          textAlign="left"
          background="transparent"
          transition="transform 0.25s ease, box-shadow 0.25s ease"
          _hover={{ transform: "translateY(-3px)" }}
          aria-label={`Read the latest Skatehive magazine (${label})`}
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
            {/* Spinner overlay while fetching the issue payload — the
                MagazineModal chunk is lazy-loaded so the click-to-open
                round-trip can be ~500ms on first use. */}
            {loadingIssue && (
              <Box
                position="absolute"
                inset={0}
                bg="rgba(10,10,10,0.7)"
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Spinner size="sm" color={P.accent} />
              </Box>
            )}
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

      {openPosts && (
        <MagazineModal
          isOpen
          onClose={() => setOpenPosts(null)}
          posts={openPosts}
          preserveOrder
          zineCover={openCover ?? undefined}
        />
      )}
    </>
  );
}
