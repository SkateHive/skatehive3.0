"use client";

import React, { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Keyboard } from "swiper/modules";
import {
  Box,
  IconButton,
  Image,
  Modal,
  ModalBody,
  ModalContent,
  ModalOverlay,
  ModalCloseButton,
  Text,
} from "@chakra-ui/react";
import { LuExpand } from "react-icons/lu";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

export interface SpotImage {
  url: string;
  caption: string;
}

interface SpotImageCarouselProps {
  images: SpotImage[];
  alt: string;
  /** Height of the carousel container. Defaults to ~500px on desktop. */
  height?: { base: string; md: string } | string;
}

/**
 * Swiper-based image carousel for the spot page. Keyboard arrows + drag,
 * a slide counter pill in the corner, and click-to-expand into a
 * fullscreen lightbox. Matches the dark/primary-green theme.
 */
export default function SpotImageCarousel({
  images,
  alt,
  height = { base: "55vh", md: "560px" },
}: SpotImageCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (images.length === 0) return null;

  const current = images[activeIndex] ?? images[0];

  return (
    <Box position="relative" width="100%">
      <Box
        position="relative"
        h={height}
        borderRadius="lg"
        overflow="hidden"
        border="1px solid"
        borderColor="whiteAlpha.200"
        bg="#0a0a0a"
        sx={{
          // Themed Swiper internals — keep these scoped so other Swipers
          // in the app aren't affected.
          ".swiper, .swiper-wrapper, .swiper-slide": { height: "100%" },
          ".swiper-button-prev, .swiper-button-next": {
            color: "var(--chakra-colors-primary)",
            background: "rgba(10, 10, 10, 0.55)",
            border: "1px solid rgba(167, 255, 0, 0.35)",
            backdropFilter: "blur(6px)",
            width: "38px",
            height: "38px",
            borderRadius: "999px",
          },
          ".swiper-button-prev::after, .swiper-button-next::after": {
            fontSize: "16px",
            fontWeight: "900",
          },
          ".swiper-button-disabled": { opacity: 0.3, cursor: "default" },
          ".swiper-pagination-bullet": {
            background: "rgba(255,255,255,0.5)",
            opacity: 1,
          },
          ".swiper-pagination-bullet-active": {
            background: "var(--chakra-colors-primary)",
          },
        }}
      >
        <Swiper
          modules={[Navigation, Pagination, Keyboard]}
          navigation={images.length > 1}
          pagination={images.length > 1 ? { clickable: true, dynamicBullets: true } : false}
          keyboard={{ enabled: true }}
          loop={images.length > 2}
          onSlideChange={(s) => setActiveIndex(s.realIndex)}
          spaceBetween={0}
        >
          {images.map((img, i) => (
            <SwiperSlide key={`${img.url}-${i}`}>
              <Box
                position="relative"
                w="100%"
                h="100%"
                display="flex"
                alignItems="center"
                justifyContent="center"
                cursor="zoom-in"
                onClick={() => setLightboxUrl(img.url)}
              >
                <Image
                  src={img.url}
                  alt={img.caption || alt}
                  w="100%"
                  h="100%"
                  objectFit="cover"
                  loading={i === 0 ? "eager" : "lazy"}
                />
              </Box>
            </SwiperSlide>
          ))}
        </Swiper>

        {/* Slide counter pill */}
        {images.length > 1 && (
          <Box
            position="absolute"
            top={3}
            left={3}
            zIndex={5}
            bg="rgba(10,10,10,0.7)"
            color="primary"
            px={2.5}
            py={1}
            borderRadius="full"
            border="1px solid"
            borderColor="rgba(167,255,0,0.35)"
            fontSize="xs"
            fontWeight="700"
            fontFamily="ui-monospace, monospace"
            pointerEvents="none"
          >
            {activeIndex + 1} / {images.length}
          </Box>
        )}

        {/* Expand button */}
        <IconButton
          position="absolute"
          top={3}
          right={3}
          zIndex={5}
          aria-label="Expand image"
          icon={<LuExpand />}
          size="sm"
          bg="rgba(10,10,10,0.7)"
          color="primary"
          border="1px solid"
          borderColor="rgba(167,255,0,0.35)"
          backdropFilter="blur(6px)"
          _hover={{ bg: "primary", color: "background" }}
          onClick={() => setLightboxUrl(current.url)}
        />

        {/* Current-slide caption ribbon */}
        {current.caption && (
          <Box
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            bg="linear-gradient(to top, rgba(0,0,0,0.85), transparent)"
            px={4}
            py={3}
            pointerEvents="none"
          >
            <Text fontSize="sm" color="gray.100" noOfLines={2}>
              {current.caption}
            </Text>
          </Box>
        )}
      </Box>

      {/* Thumbnail strip — only render if there's more than one image. */}
      {images.length > 1 && (
        <Box mt={3} display="flex" gap={2} overflowX="auto" pb={1} sx={{
          "::-webkit-scrollbar": { height: "6px" },
          "::-webkit-scrollbar-thumb": { background: "rgba(167,255,0,0.25)", borderRadius: "3px" },
        }}>
          {images.map((img, i) => (
            <Box
              key={`thumb-${img.url}-${i}`}
              as="button"
              aria-label={`Show image ${i + 1}`}
              flexShrink={0}
              w="72px"
              h="56px"
              borderRadius="md"
              overflow="hidden"
              border="2px solid"
              borderColor={i === activeIndex ? "primary" : "transparent"}
              opacity={i === activeIndex ? 1 : 0.6}
              transition="all 0.15s"
              _hover={{ opacity: 1, borderColor: "primary" }}
              onClick={() => {
                // Find the Swiper instance through the live DOM — simpler than
                // wiring a ref through React for a feature this small.
                const swiper =
                  document.querySelector(".swiper")?.["swiper" as unknown as keyof Element];
                if (swiper && typeof (swiper as { slideToLoop?: (i: number) => void }).slideToLoop === "function") {
                  (swiper as { slideToLoop: (i: number) => void }).slideToLoop(i);
                } else {
                  setActiveIndex(i);
                }
              }}
            >
              <Image
                src={img.url}
                alt=""
                w="100%"
                h="100%"
                objectFit="cover"
                loading="lazy"
              />
            </Box>
          ))}
        </Box>
      )}

      {/* Lightbox */}
      <Modal isOpen={!!lightboxUrl} onClose={() => setLightboxUrl(null)} size="full" isCentered>
        <ModalOverlay bg="rgba(0,0,0,0.95)" />
        <ModalContent bg="transparent" boxShadow="none" m={0} maxW="100vw" maxH="100vh">
          <ModalCloseButton color="white" size="lg" top={4} right={4} zIndex={10} />
          <ModalBody
            p={0}
            display="flex"
            alignItems="center"
            justifyContent="center"
            onClick={() => setLightboxUrl(null)}
          >
            {lightboxUrl && (
              <Image
                src={lightboxUrl}
                alt={alt}
                maxW="100vw"
                maxH="100vh"
                objectFit="contain"
              />
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </Box>
  );
}
