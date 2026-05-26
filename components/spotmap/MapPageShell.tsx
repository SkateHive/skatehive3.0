"use client";

import React, { useState } from "react";
import {
  Box,
  Button,
  Flex,
  Heading,
  Text,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  useDisclosure,
} from "@chakra-ui/react";
import { useTranslations } from "@/contexts/LocaleContext";
import { Discussion } from "@hiveio/dhive";
import MapTabs, { MapTabKey } from "./MapTabs";
import SpotSnapComposer from "./SpotSnapComposer";
import SpotList from "./SpotList";
import { useSkatespots } from "@/hooks/useSkatespots";

interface MapPageShellProps {
  activeTab: MapTabKey;
  children: React.ReactNode;
  /**
   * Hide the "Recent spots" grid that normally renders under the children.
   * The Airbnb-style /map view ships its own card rail beside the map, so
   * a second list below would be redundant.
   */
  suppressSpotList?: boolean;
}

export default function MapPageShell({
  activeTab,
  children,
  suppressSpotList = false,
}: MapPageShellProps) {
  const t = useTranslations("map");
  const [newSpot, setNewSpot] = useState<Discussion | null>(null);
  const [composerKey, setComposerKey] = useState(0);
  const {
    isOpen: isComposerOpen,
    onOpen: onComposerOpen,
    onClose: onComposerClose,
  } = useDisclosure();
  const { spots, isLoading, hasMore, loadNextPage, error, refresh } = useSkatespots();

  const handleNewSpot = (newComment: Partial<Discussion>) => {
    setNewSpot(newComment as Discussion);
    setTimeout(() => refresh(), 6000);
  };

  const handleClose = () => {
    setComposerKey((k) => k + 1);
    onComposerClose();
  };

  return (
    <Box height="auto" overflow="visible">
      {/* Header */}
      <Box
        position={{ base: "relative", md: "sticky" }}
        top={{ base: "auto", md: 0 }}
        zIndex={10}
        bg="rgba(10,10,10,0.85)"
        backdropFilter="blur(10px)"
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
      >
        <Box maxW="7xl" mx="auto" px={{ base: 3, md: 6 }} py={{ base: 3, md: 4 }}>
          {/* Top row: title + add button. On mobile they stack. */}
          <Flex
            align={{ base: "stretch", md: "center" }}
            justify="space-between"
            direction={{ base: "column", md: "row" }}
            gap={{ base: 2, md: 4 }}
            mb={{ base: 3, md: 4 }}
          >
            <Box textAlign={{ base: "center", md: "left" }}>
              <Heading
                as="h1"
                className="fretqwik-title"
                fontSize={{ base: "3xl", sm: "4xl", md: "5xl" }}
                fontWeight="extrabold"
                color="primary"
                letterSpacing={{ base: "wide", md: "wider" }}
                lineHeight="1"
              >
                {t("title")}
              </Heading>
              <Text
                color="gray.400"
                fontSize={{ base: "xs", md: "sm" }}
                mt={1}
                display={{ base: "none", md: "block" }}
              >
                Find skateparks, street spots &amp; DIY spots worldwide — built by skaters,
                for skaters
              </Text>
            </Box>
            <Button
              size="sm"
              bg="primary"
              color="background"
              border="1px solid"
              borderColor="primary"
              borderRadius="md"
              px={5}
              fontWeight="800"
              fontSize="sm"
              flexShrink={0}
              alignSelf={{ base: "center", md: "auto" }}
              _hover={{ bg: "accent", color: "text" }}
              onClick={onComposerOpen}
            >
              + {t("addASpot")}
            </Button>
          </Flex>

          {/* Tab row */}
          <Flex justify={{ base: "center", md: "flex-start" }}>
            <MapTabs active={activeTab} />
          </Flex>
        </Box>
      </Box>

      {/* Map view (per-tab) */}
      <Box maxW="7xl" mx="auto" px={{ base: 2, md: 6 }} pt={{ base: 3, md: 4 }} w="100%">
        {children}
      </Box>

      {/* Add Spot Dialog */}
      <Modal isOpen={isComposerOpen} onClose={onComposerClose} size="lg" isCentered>
        <ModalOverlay bg="rgba(0,0,0,0.7)" backdropFilter="blur(4px)" />
        <ModalContent
          bg="background"
          border="1px solid"
          borderColor="primary"
          borderRadius="xl"
          mx={4}
          maxH="85vh"
          overflowY="auto"
          onDragOver={(e) => e.preventDefault()}
        >
          <ModalHeader color="primary" fontWeight="bold" fontSize="xl" pb={0}>
            📍 {t("addASpot")}
          </ModalHeader>
          <ModalCloseButton color="gray.400" />
          <ModalBody pb={6}>
            <SpotSnapComposer
              key={composerKey}
              onNewComment={handleNewSpot}
              onClose={handleClose}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Spot List (suppressed when the children own the list, e.g. the
          Airbnb-style /map tab has its own side rail). */}
      {!suppressSpotList && (
        <Box maxW="7xl" mx="auto" px={{ base: 3, md: 6 }} pt={0} pb={6} w="100%">
          {error && (
            <Box
              textAlign="center"
              my={4}
              p={4}
              bg="rgba(255, 80, 80, 0.08)"
              border="1px solid"
              borderColor="red.400"
              borderRadius="md"
            >
              <Text color="red.300" fontWeight="bold">
                {t("errorLoadingSpots")}
              </Text>
              <Text color="red.200" fontSize="sm">
                {error}
              </Text>
            </Box>
          )}
          <SpotList
            spots={spots}
            newSpot={newSpot}
            isLoading={isLoading}
            hasMore={hasMore}
            onLoadMore={loadNextPage}
          />
        </Box>
      )}
    </Box>
  );
}
