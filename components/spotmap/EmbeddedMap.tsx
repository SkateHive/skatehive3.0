"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  useBreakpointValue,
} from "@chakra-ui/react";
import { Global } from "@emotion/react";
import SpotSnapComposer from "@/components/spotmap/SpotSnapComposer";
import SpotList from "@/components/spotmap/SpotList";
import { useSnaps } from "@/hooks/useSnaps";
import { useComments } from "@/hooks/useComments";
import { Discussion } from "@hiveio/dhive";
import { useAioha } from "@aioha/react-ui";

const mapSrc =
  "https://www.google.com/maps/d/u/1/embed?mid=1iiXzotKL-uJ3l7USddpTDvadGII&hl=en&ll=29.208380630280647%2C-100.5437214508988&z=4";

export default function EmbeddedMap() {
  const boxWidth = useBreakpointValue({
    base: "90%",
    sm: "80%",
    md: "75%",
    lg: "100%",
  });
  const paddingX = useBreakpointValue({ base: 2, sm: 4, md: 6 });
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [newSpot, setNewSpot] = useState(null);
  const [composerKey, setComposerKey] = useState<number>(0);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { user } = useAioha();

  const { comments: mainSnaps, isLoading, hasMore, loadNextPage } = useSnaps();
  // Only show snaps from the main container with BOTH skatespot and hive-173115 tags
  const allSpots = mainSnaps
    .filter(snap => {
      try {
        const tags = JSON.parse(snap.json_metadata || "{}" ).tags || [];
        return tags.includes("skatespot") && tags.includes("hive-173115");
      } catch {
        return false;
      }
    })
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

  // Handler to accept Partial<Discussion> and cast to Discussion
  const handleNewSpot = (newComment: Partial<Discussion>) => {
    setNewSpot(newComment as any); // Optimistic update, safe for UI
  };

  const handleClose = () => {
    setComposerKey((k: number) => k + 1); // force reset by changing key
  };

  // Only redirect scroll on desktop
  const handleMapSideWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      // Only apply on md and up
      if (window.innerWidth < 768) return;
      // If the event is from the iframe, do nothing
      if (
        e.target instanceof HTMLIFrameElement ||
        (e.target as HTMLElement)?.closest("iframe")
      ) {
        return;
      }
      // Prevent default scroll on map side
      e.preventDefault();
      // Scroll the sidebar
      if (sidebarRef.current) {
        sidebarRef.current.scrollTop += e.deltaY;
      }
    },
    []
  );

  return (
    <>
      <Global
        styles={`
          @keyframes float {
            0% { transform: translateY(0); }
            50% { transform: translateY(5px); }
            100% { transform: translateY(0); }
          }
          @keyframes glow {
            0% { text-shadow: 0 0 5px var(--chakra-colors-background), 0 0 10px var(--chakra-colors-background), 0 0 15px var(--chakra-colors-background), 0 0 20px var(--chakra-colors-background), 0 0 25px var(--chakra-colors-background); color: var(--chakra-colors-text); }
            50% { text-shadow: 0 0 10px var(--chakra-colors-text), 0 0 20px var(--chakra-colors-text), 0 0 30px var(--chakra-colors-text), 0 0 40px var(--chakra-colors-text), 0 0 50px var(--chakra-colors-text); color: var(--chakra-colors-background); }
            100% { text-shadow: 0 0 5px var(--chakra-colors-background), 0 0 10px var(--chakra-colors-background), 0 0 15px var(--chakra-colors-background), 0 0 20px var(--chakra-colors-background), 0 0 25px var(--chakra-colors-background); color: var(--chakra-colors-text); }
          }
        `}
      />
      <Box
        height="auto"
        overflow="visible"
      >
        {/* Header Section */}
        <Box p={{ base: 2, md: 4 }} pt={0} pb={0}>
          <Text
            className="fretqwik-title"
            fontSize={{ base: "6xl", md: "7xl" }}
            fontWeight="extrabold"
            color="primary"
            letterSpacing="widest"
            textAlign="center"
            mt={{ base: -2, md: -4 }}
            style={{ lineHeight: 1.1, maxWidth: "100%", whiteSpace: "nowrap" }}
          >
            skate spot map
          </Text>
        </Box>

        {/* Add Spot Button Section */}
        {user && (
          <Box p={{ base: 2, md: 4 }} pt={{ base: 4, md: 6 }} pb={{ base: 2, md: 2 }} textAlign="center">
            <Button
              bg="background"
              color="primary"
              borderRadius="md"
              px={4}
              py={2}
              fontWeight="bold"
              fontSize="md"
              boxShadow="md"
              _hover={{ bg: "primary", color: "background" }}
              onClick={() => {
                const el = document.getElementById("spot-name-field");
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                  el.focus();
                }
              }}
            >
              Add A Spot
            </Button>
          </Box>
        )}

        {/* Main Content Section */}
        <Flex
          height={{ base: 'auto', md: '600px' }}
          flexDirection={{ base: "column", md: "row" }}
          align="flex-start"
          justifyContent="center"
          p={4}
          pt={0}
          w="100%"
          mx="auto"
          gap={0}
        >
          {/* Map Section */}
          <Box
            flex="2"
            minW={0}
            w={{ base: "100%", md: "65%" }}
            height={{ base: "300px", md: "100%" }}
            overflow="visible"
            borderRadius="10px"
            width="100%"
            mx="auto"
            mb={{ base: 2, md: 6 }}
            onWheel={isMobile ? undefined : handleMapSideWheel}
          >
            <Box
              p={{ base: 2, md: 4 }}
              pt={0}
              textAlign="center"
              width="100%"
              height="100%"
            >
              <iframe
                src={mapSrc}
                style={{
                  border: "5px solid var(--chakra-colors-primary, black)",
                  width: "100%",
                  height: "100%",
                  padding: 0,
                  margin: "auto",
                  boxShadow: "0px 4px 10px var(--chakra-colors-muted, rgba(0, 0, 0, 0.5))",
                  display: "block",
                }}
                allowFullScreen
              ></iframe>
            </Box>
          </Box>

          {/* Sidebar Section - Only Composer */}
          <Box
            flex="1"
            minW={{ md: "340px" }}
            maxW={{ md: "420px" }}
            w={{ base: "100%", md: "35%" }}
            ml={{ base: 0, md: 8 }}
            mt={{ base: 0, md: 0 }}
            mb={{ base: 0, md: 8 }}
            mx={{ base: "auto", md: 0 }}
            display={{ base: "block", md: "block" }}
            height={{ base: "auto", md: "100%" }}
            overflowY="visible"
          >
            <SpotSnapComposer onNewComment={handleNewSpot} onClose={handleClose} />
          </Box>
        </Flex>

        {/* Spot List Section - 3 Column Grid */}
        <Box p={4} pt={0}>
          <SpotList 
            spots={allSpots} 
            newSpot={newSpot} 
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={loadNextPage}
          />
        </Box>
      </Box>
    </>
  );
} 