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
}

export default function MapPageShell({ activeTab, children }: MapPageShellProps) {
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
        bg="background"
        backdropFilter={{ base: "none", md: "blur(10px)" }}
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
      >
        <Box textAlign="center" p={{ base: 3, md: 4 }} pb={2}>
          <Heading
            as="h1"
            className="fretqwik-title"
            fontSize={{ base: "3xl", sm: "4xl", md: "5xl" }}
            fontWeight="extrabold"
            color="primary"
            letterSpacing={{ base: "wide", md: "wider" }}
            mb={1}
          >
            {t("title")}
          </Heading>
          <Text color="gray.400" fontSize={{ base: "xs", md: "sm" }} mb={3}>
            Find skateparks, street spots &amp; DIY spots worldwide — built by skaters, for skaters
          </Text>

          <Flex justify="center" mb={3}>
            <MapTabs active={activeTab} />
          </Flex>

          <Flex justify="center" gap={3} align="center" flexWrap="wrap">
            <Button
              size="sm"
              bg="transparent"
              color="primary"
              border="1px solid"
              borderColor="primary"
              borderRadius="md"
              px={4}
              fontWeight="bold"
              fontSize="sm"
              _hover={{ bg: "primary", color: "background" }}
              onClick={onComposerOpen}
            >
              + {t("addASpot")}
            </Button>
          </Flex>
        </Box>
      </Box>

      {/* Map view (per-tab) */}
      <Box p={{ base: 2, md: 4 }} pt={2} w="100%" mx="auto">
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

      {/* Spot List */}
      <Box p={4} pt={0}>
        {error && (
          <Box textAlign="center" my={4} p={4} bg="red.50" border="1px solid" borderColor="red.200">
            <Text color="red.600" fontWeight="bold">
              {t("errorLoadingSpots")}
            </Text>
            <Text color="red.500">{error}</Text>
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
    </Box>
  );
}
