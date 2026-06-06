"use client";

import React, { useEffect, useState } from "react";
import {
  Box,
  HStack,
  IconButton,
  Text,
  useBreakpointValue,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalBody,
  ModalCloseButton,
} from "@chakra-ui/react";
import { MdAdd, MdRemove, MdFullscreen, MdOpenInNew } from "react-icons/md";

const MAP_MID = "1iiXzotKL-uJ3l7USddpTDvadGII";
const DEFAULT_LAT = 29.208380630280647;
const DEFAULT_LNG = -100.5437214508988;
const DEFAULT_ZOOM = 4;

function buildEmbedSrc(lat: number, lng: number, zoom: number): string {
  return `https://www.google.com/maps/d/u/1/embed?mid=${MAP_MID}&hl=en&ll=${lat}%2C${lng}&z=${zoom}`;
}

function buildViewerUrl(lat: number, lng: number, zoom: number): string {
  return `https://www.google.com/maps/d/u/1/viewer?mid=${MAP_MID}&hl=en&ll=${lat}%2C${lng}&z=${zoom}`;
}

export default function GoogleMyMapsView() {
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [center, setCenter] = useState({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [src, setSrc] = useState(buildEmbedSrc(DEFAULT_LAT, DEFAULT_LNG, DEFAULT_ZOOM));
  const [interactive, setInteractive] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();

  useEffect(() => {
    setSrc(buildEmbedSrc(center.lat, center.lng, zoom));
  }, [center.lat, center.lng, zoom]);

  const zoomIn = () => setZoom((z) => Math.min(18, z + 1));
  const zoomOut = () => setZoom((z) => Math.max(2, z - 1));
  const openInNewTab = () => {
    if (typeof window === "undefined") return;
    window.open(buildViewerUrl(center.lat, center.lng, zoom), "_blank");
  };

  return (
    <Box>
      <Box
        w="100%"
        height={{ base: "65vh", md: "75vh" }}
        borderRadius="lg"
        overflow="hidden"
        position="relative"
        border="2px solid"
        borderColor="primary"
        boxShadow="0 0 20px rgba(167, 255, 0, 0.15)"
        onMouseLeave={() => setInteractive(false)}
      >
        <HStack
          position="absolute"
          top={3}
          right={3}
          zIndex={5}
          spacing={2}
          bg="rgba(0,0,0,0.35)"
          backdropFilter="blur(6px)"
          border="1px solid"
          borderColor="whiteAlpha.200"
          borderRadius="lg"
          p={2}
        >
          <IconButton
            aria-label="Zoom in"
            icon={<MdAdd />}
            size="sm"
            variant="ghost"
            color="primary"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={zoomIn}
          />
          <IconButton
            aria-label="Zoom out"
            icon={<MdRemove />}
            size="sm"
            variant="ghost"
            color="primary"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={zoomOut}
          />
          <IconButton
            aria-label="Fullscreen"
            icon={<MdFullscreen />}
            size="sm"
            variant="ghost"
            color="primary"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={onOpen}
          />
          <IconButton
            aria-label="Open in new tab"
            icon={<MdOpenInNew />}
            size="sm"
            variant="ghost"
            color="primary"
            _hover={{ bg: "whiteAlpha.200" }}
            onClick={openInNewTab}
          />
        </HStack>

        {isMobile && (
          <Box
            position="absolute"
            bottom={3}
            left="50%"
            transform="translateX(-50%)"
            zIndex={5}
            px={3}
            py={1}
            bg="rgba(0,0,0,0.35)"
            backdropFilter="blur(6px)"
            borderRadius="full"
            border="1px solid"
            borderColor="whiteAlpha.200"
          >
            <Text fontSize="xs" color="gray.200">
              Tip: use + / - or fullscreen to zoom
            </Text>
          </Box>
        )}

        {/* Scroll-capture overlay — keeps the embed from stealing page scroll
            until the user explicitly clicks into the map. */}
        {!interactive && (
          <Box
            position="absolute"
            inset={0}
            zIndex={4}
            cursor="pointer"
            onClick={() => setInteractive(true)}
            display="flex"
            alignItems="flex-end"
            justifyContent="center"
            pb={10}
          >
            <Box
              bg="rgba(0,0,0,0.55)"
              color="white"
              px={3}
              py={1}
              borderRadius="full"
              fontSize="xs"
              pointerEvents="none"
            >
              Click to interact with map
            </Box>
          </Box>
        )}

        <iframe
          src={src}
          style={{
            border: "none",
            width: "100%",
            height: "100%",
            display: "block",
            pointerEvents: interactive ? "auto" : "none",
          }}
          allowFullScreen
          title="Skatehive Skate Spot Map (Google)"
        />
      </Box>

      <Text fontSize="xs" color="gray.500" mt={2} textAlign="center">
        Curated Google My Maps dataset · maintained by the Skatehive crew
      </Text>

      <Modal isOpen={isOpen} onClose={onClose} size="full" isCentered motionPreset="none">
        <ModalOverlay bg="rgba(0,0,0,0.8)" backdropFilter="blur(6px)" />
        <ModalContent bg="background" m={0} maxW="100vw" maxH="100vh" h="100vh" w="100vw" overflow="hidden">
          <ModalCloseButton
            size="lg"
            color="white"
            bg="red.600"
            _hover={{ bg: "red.500" }}
            _active={{ bg: "red.700" }}
            borderRadius="lg"
            zIndex={10001}
            top={4}
            right={4}
            position="fixed"
            title="Close"
            boxShadow="xl"
          />
          <ModalBody p={0} h="100vh" w="100vw" position="relative" overflow="hidden">
            <Box
              key={src}
              as="iframe"
              src={src}
              w="100%"
              h="100%"
              border="none"
              title="Skatehive Skate Spot Map (Fullscreen)"
              allow="fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
