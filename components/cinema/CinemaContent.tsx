"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Container,
  Text,
  Center,
  Button,
  VStack,
  HStack,
  Image,
  Link as ChakraLink,
  Flex,
  Icon,
  IconButton,
  Tooltip,
} from "@chakra-ui/react";
import NextLink from "next/link";
import HubNavigation from "@/components/shared/HubNavigation";
import {
  FaPlay,
  FaStepForward,
  FaStepBackward,
  FaRandom,
  FaExternalLinkAlt,
  FaFilm,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { SiOdysee } from "react-icons/si";
import cinemaData from "@/public/data/cinema.json";

// ─── Types ───────────────────────────────────────────────

interface CinemaVideo {
  slug: string;
  title: string;
  brand: string;
  year: number | null;
  embedUrl: string;
  thumbnail: string;
  description: string;
  channel: string;
  link: string;
}

const VIDEOS_PER_PAGE = 15;

// Top brands for the filter bar (by frequency in the catalog)
const TOP_BRANDS = cinemaData.brands.slice(0, 20);

// Brand name → logo filename mapping
const BRAND_LOGOS: Record<string, string> = {
  "Real": "real.jpg",
  "Zero": "zero.png",
  "Cliché": "cliche.svg",
  "CKY": "cky.png",
  "Circa": "circa.png",
  "Girl": "girl.png",
  "Emerica": "emerica.png",
  "Element": "element.png",
  "DC Shoes": "dc.png",
  "Mystery": "mystery.svg",
  "FKD": "fkd.png",
  "Enjoi": "enjoi.png",
  "Darkstar": "darkstar.jpg",
  "Baker": "baker.png",
  "Almost": "almost.png",
  "Deathwish": "deathwish.png",
  "Habitat": "habitat.png",
  "Globe": "globe.png",
  "Volcom": "volcom.png",
  "Etnies": "etnies.png",
  "Adio": "adio.svg",
  "Shorty's": "shortys.svg",
  "éS": "es.png",
  "Vox": "vox.png",
  "TransWorld": "transworld.png",
  "411VM": "411vm.png",
  "Blind": "blind.png",
  "Chocolate": "chocolate.png",
  "Anti Hero": "antihero.svg",
  "Alien Workshop": "alienworkshop.png",
  "Birdhouse": "birdhouse.png",
  "DVS": "dvs.png",
  "Foundation": "foundation.png",
  "Krooked": "krooked.png",
  "Lakai": "lakai.png",
  "Plan B": "planb.png",
  "Santa Cruz": "santacruz.png",
  "Toy Machine": "toymachine.png",
};

function getBrandLogo(brand: string): string | null {
  const file = BRAND_LOGOS[brand];
  return file ? `/logos/brands/${file}` : null;
}

// ─── Playlist Item ───────────────────────────────────────

const PlaylistItem = React.memo(function PlaylistItem({
  video,
  isActive,
  index,
  onClick,
}: {
  video: CinemaVideo;
  isActive: boolean;
  index: number;
  onClick: () => void;
}) {
  return (
    <HStack
      spacing={3} p={2} py={3} cursor="pointer" onClick={onClick}
      bg={isActive ? "whiteAlpha.100" : "transparent"}
      borderLeft="3px solid" borderColor={isActive ? "primary" : "transparent"}
      _hover={{ bg: "whiteAlpha.50" }} transition="all 0.15s" borderRadius="sm"
    >
      <Text fontFamily="mono" fontSize="xs" color="gray.600" w="20px" textAlign="center" flexShrink={0}>
        {isActive ? <Icon as={FaPlay} boxSize={2.5} color="primary" /> : index + 1}
      </Text>
      <Box position="relative" w="120px" h="68px" flexShrink={0} borderRadius="sm" overflow="hidden" bg="background">
        <Image src={video.thumbnail} alt={video.title} w="100%" h="100%" objectFit="cover" />
        {video.year && (
          <Text position="absolute" bottom={0} right={0} fontFamily="mono" fontSize="2xs"
            bg="blackAlpha.800" color="white" px={1}>{video.year}</Text>
        )}
      </Box>
      <VStack align="start" spacing={0.5} flex={1} minW={0}>
        <ChakraLink as={NextLink} href={`/cinema/${video.slug}`} _hover={{ textDecoration: "none" }} onClick={(e: React.MouseEvent) => e.stopPropagation()}>
          <Text fontFamily="mono" fontSize="xs" color={isActive ? "primary" : "text"} noOfLines={2}
            lineHeight="1.4" fontWeight={isActive ? "bold" : "normal"} _hover={{ color: "primary" }}>
            {video.title}
          </Text>
        </ChakraLink>
        <HStack spacing={1}>
          <Text fontFamily="mono" fontSize="2xs" color="gray.500">{video.brand}</Text>
          <Text fontFamily="mono" fontSize="2xs" color="gray.700">· {video.channel}</Text>
        </HStack>
      </VStack>
    </HStack>
  );
});

// ─── Main Component ──────────────────────────────────────

function brandToSlug(brand: string): string {
  return brand.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export default function CinemaContent({ initialBrand }: { initialBrand?: string }) {
  const router = useRouter();
  const videos = cinemaData.videos as CinemaVideo[];
  const [selectedBrand, setSelectedBrand] = useState<string | null>(initialBrand || null);
  const [currentPage, setCurrentPage] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);

  const filteredVideos = useMemo(() => {
    if (!selectedBrand) return videos;
    return videos.filter((v) => v.brand === selectedBrand);
  }, [videos, selectedBrand]);

  const totalPages = Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE);
  const paginatedVideos = useMemo(() => {
    const start = currentPage * VIDEOS_PER_PAGE;
    return filteredVideos.slice(start, start + VIDEOS_PER_PAGE);
  }, [filteredVideos, currentPage]);

  const activeVideo = paginatedVideos[activeIndex] || null;

  // Reset when filter/page changes
  useEffect(() => { setActiveIndex(0); }, [currentPage, selectedBrand]);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < paginatedVideos.length) {
      setActiveIndex(index);
      setTimeout(() => {
        document.getElementById(`cinema-item-${index}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    }
  }, [paginatedVideos.length]);

  const goNext = useCallback(() => {
    if (shuffle) {
      setActiveIndex(Math.floor(Math.random() * paginatedVideos.length));
      return;
    }
    if (activeIndex < paginatedVideos.length - 1) {
      setActiveIndex(activeIndex + 1);
    } else if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
      // activeIndex resets to 0 via the useEffect above
    } else {
      setActiveIndex(0);
    }
  }, [activeIndex, paginatedVideos.length, shuffle, currentPage, totalPages]);

  const goPrev = useCallback(() => {
    if (activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    } else if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
      // Will reset to 0 via useEffect, then we set to last item
      setTimeout(() => setActiveIndex(VIDEOS_PER_PAGE - 1), 0);
    } else {
      setActiveIndex(paginatedVideos.length - 1);
    }
  }, [activeIndex, paginatedVideos.length, currentPage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "n" || e.key === "N") goNext();
      if (e.key === "p" || e.key === "P") goPrev();
      if (e.key === "s" || e.key === "S") setShuffle((s) => !s);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const globalIndex = currentPage * VIDEOS_PER_PAGE + activeIndex + 1;

  return (
    <Box minH="100vh">
      <Container maxW="container.xl" px={{ base: 2, md: 4 }}>
        <HubNavigation />

        {/* Brand Filter Bar */}
        <Box overflowX="auto" mb={4} css={{ "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
          <HStack spacing={2} py={2} minW="max-content">
            <Button
              size="xs" fontFamily="mono" fontSize="xs" h="28px"
              variant={!selectedBrand ? "solid" : "outline"}
              bg={!selectedBrand ? "primary" : "transparent"}
              color={!selectedBrand ? "background" : "gray.400"}
              borderColor="whiteAlpha.200" borderRadius="sm"
              onClick={() => { setSelectedBrand(null); setCurrentPage(0); router.push("/cinema", { scroll: false }); }}
              _hover={{ borderColor: "primary", color: !selectedBrand ? "background" : "primary" }}
              px={3}
            >
              All ({videos.length})
            </Button>
            {TOP_BRANDS.map((brand) => {
              const count = videos.filter((v) => v.brand === brand).length;
              const isActive = selectedBrand === brand;
              const logo = getBrandLogo(brand);
              return (
                <Button
                  key={brand} size="xs" fontFamily="mono" fontSize="xs" h="32px"
                  variant={isActive ? "solid" : "outline"}
                  bg={isActive ? "primary" : "transparent"}
                  color={isActive ? "background" : "gray.400"}
                  borderColor={isActive ? "primary" : "whiteAlpha.200"} borderRadius="sm"
                  onClick={() => { setSelectedBrand(brand); setCurrentPage(0); router.push(`/cinema/${brandToSlug(brand)}`, { scroll: false }); }}
                  _hover={{ borderColor: "primary", color: isActive ? "background" : "primary" }}
                  px={3} gap={1.5}
                >
                  {logo && (
                    <Image
                      src={logo}
                      alt={brand}
                      h="14px"
                      w="auto"
                      maxW="32px"
                      objectFit="contain"
                      filter={isActive ? "brightness(0)" : "brightness(0) invert(1)"}
                      opacity={isActive ? 1 : 0.7}
                    />
                  )}
                  {brand} ({count})
                </Button>
              );
            })}
          </HStack>
        </Box>

        {/* Cinema Layout */}
        <Flex direction={{ base: "column", lg: "row" }} gap={0}
          border="1px solid" borderColor="whiteAlpha.100" borderRadius="md" overflow="hidden" bg="background">

          {/* ── Main Player ── */}
          <Box flex={1} minW={0} overflowY={{ base: "visible", lg: "auto" }} maxH={{ base: "none", lg: "calc(100vh - 160px)" }}>
            {/* Video frame */}
            <Box w="100%" sx={{ aspectRatio: "16 / 9" }} bg="background" position="relative" overflow="hidden">
              {activeVideo && (
                <iframe
                  key={activeVideo.slug}
                  src={activeVideo.embedUrl}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              )}
            </Box>

            {/* Now Playing */}
            <Box p={4} bg="background" borderTop="1px solid" borderColor="whiteAlpha.100">
              <HStack spacing={1} mb={3}>
                <Tooltip label="Previous (P)" hasArrow>
                  <IconButton aria-label="Previous" icon={<FaStepBackward />} size="xs" variant="ghost" color="gray.400" onClick={goPrev} _hover={{ color: "primary" }} />
                </Tooltip>
                <Tooltip label="Next (N)" hasArrow>
                  <IconButton aria-label="Next" icon={<FaStepForward />} size="xs" variant="ghost" color="gray.400" onClick={goNext} _hover={{ color: "primary" }} />
                </Tooltip>
                <Tooltip label={`Shuffle ${shuffle ? "on" : "off"} (S)`} hasArrow>
                  <IconButton aria-label="Shuffle" icon={<FaRandom />} size="xs" variant="ghost" color={shuffle ? "primary" : "gray.400"} onClick={() => setShuffle((s) => !s)} _hover={{ color: "primary" }} />
                </Tooltip>
                <Box flex={1} />
                <HStack spacing={1} px={2} py={0.5} bg="whiteAlpha.50" borderRadius="sm">
                  <Icon as={SiOdysee} boxSize={3} color="pink.400" />
                  <Text fontFamily="mono" fontSize="2xs" color="gray.400">Odysee</Text>
                </HStack>
                <Text fontFamily="mono" fontSize="2xs" color="gray.600">{globalIndex} / {filteredVideos.length}</Text>
              </HStack>

              <ChakraLink as={NextLink} href={activeVideo ? `/cinema/${activeVideo.slug}` : "#"} _hover={{ textDecoration: "none" }}>
                <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color="text" mb={2} noOfLines={2} _hover={{ color: "primary" }}>
                  {activeVideo?.title || "Select a video"}
                </Text>
              </ChakraLink>

              <HStack justify="space-between" align="center">
                <HStack spacing={2}>
                  <Icon as={FaFilm} boxSize={4} color="yellow.400" />
                  <Text fontFamily="mono" fontSize="xs" color="gray.400">{activeVideo?.brand}</Text>
                  {activeVideo?.year && <Text fontFamily="mono" fontSize="2xs" color="gray.600">({activeVideo.year})</Text>}
                  <Text fontFamily="mono" fontSize="2xs" color="gray.700">· {activeVideo?.channel}</Text>
                </HStack>
                {activeVideo?.link && (
                  <ChakraLink href={activeVideo.link} isExternal _hover={{ textDecoration: "none" }}>
                    <Tooltip label="Watch on Odysee" hasArrow>
                      <span><Icon as={FaExternalLinkAlt} boxSize={3} color="gray.500" _hover={{ color: "primary" }} cursor="pointer" /></span>
                    </Tooltip>
                  </ChakraLink>
                )}
              </HStack>

              {activeVideo?.description && (
                <Text fontFamily="mono" fontSize="xs" color="gray.500" mt={3} noOfLines={3}>
                  {activeVideo.description}
                </Text>
              )}
            </Box>
          </Box>

          {/* ── Playlist Sidebar ── */}
          <Box w={{ base: "100%", lg: "420px" }} flexShrink={0} bg="background"
            borderLeft={{ base: "none", lg: "1px solid" }} borderTop={{ base: "1px solid", lg: "none" }}
            borderColor="whiteAlpha.100" display="flex" flexDirection="column"
            maxH={{ base: "50vh", lg: "calc(100vh - 160px)" }} overflowY={{ base: "auto", lg: "hidden" }}>

            {/* Header */}
            <Box px={4} py={3} borderBottom="1px solid" borderColor="whiteAlpha.100">
              <HStack justify="space-between" align="center">
                <HStack spacing={2}>
                  <Icon as={FaFilm} boxSize={4} color="yellow.400" />
                  <Text fontFamily="mono" fontSize="sm" fontWeight="bold" color="text">cinema</Text>
                </HStack>
                <Text fontFamily="mono" fontSize="xs" color="gray.500">
                  {filteredVideos.length} films
                </Text>
              </HStack>
            </Box>

            {/* Playlist */}
            <Box flex={1} overflowY="auto" py={1}>
              {paginatedVideos.map((video, i) => (
                <Box key={video.slug} id={`cinema-item-${i}`}>
                  <PlaylistItem video={video} isActive={i === activeIndex} index={currentPage * VIDEOS_PER_PAGE + i} onClick={() => goTo(i)} />
                </Box>
              ))}
            </Box>

            {/* Pagination */}
            {totalPages > 1 && (
              <HStack px={4} py={2} justify="center" spacing={2} borderTop="1px solid" borderColor="whiteAlpha.100">
                <IconButton aria-label="Previous page" icon={<FaChevronLeft />} size="xs" variant="ghost"
                  color="gray.400" onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  isDisabled={currentPage === 0} _hover={{ color: "primary" }} />
                <Text fontFamily="mono" fontSize="xs" color="gray.500">
                  {currentPage + 1} / {totalPages}
                </Text>
                <IconButton aria-label="Next page" icon={<FaChevronRight />} size="xs" variant="ghost"
                  color="gray.400" onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                  isDisabled={currentPage === totalPages - 1} _hover={{ color: "primary" }} />
              </HStack>
            )}
          </Box>
        </Flex>
      </Container>
    </Box>
  );
}
