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
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  Spinner,
  Heading,
  Badge,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
} from "@chakra-ui/react";
import NextLink from "next/link";

import {
  FaPlay,
  FaStepForward,
  FaStepBackward,
  FaRandom,
  FaExternalLinkAlt,
  FaFilm,
  FaChevronLeft,
  FaChevronRight,
  FaSearch,
  FaTimes,
} from "react-icons/fa";
import { SiOdysee, SiYoutube } from "react-icons/si";
import cinemaData from "@/public/data/cinema.json";
import { getFeature } from "@/lib/features";
import dynamic from "next/dynamic";

const VirtualCinemaPlaylist = dynamic(() => import("./VirtualCinemaPlaylist"), { ssr: false });

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
  soundtrack?: { part: string; song: string }[];
  skaters?: string[];
  cast?: string[];
  dataSource?: string;
  svsSlug?: string;
}

const VIDEOS_PER_PAGE = 15;

// Priority brands shown first, then rest by frequency
const PRIORITY_BRANDS = ["Girl", "Zero", "Huflez", "éS"];
const TOP_BRANDS = [
  ...PRIORITY_BRANDS.filter((b) => cinemaData.brands.includes(b)),
  ...cinemaData.brands.filter((b) => !PRIORITY_BRANDS.includes(b)),
].slice(0, 25);

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
    <VStack spacing={0} align="stretch">
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


    </VStack>
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
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [playingSong, setPlayingSong] = useState<number | null>(null);
  const [loadingSong, setLoadingSong] = useState<number | null>(null);
  const [videoIds, setVideoIds] = useState<Record<number, string>>({});

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return videos.filter((v) => {
      if (selectedBrand && v.brand !== selectedBrand) return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.brand.toLowerCase().includes(q) ||
        v.channel.toLowerCase().includes(q) ||
        (v.year != null && String(v.year).includes(q)) ||
        (v.skaters?.some((s) => s.toLowerCase().includes(q)) ?? false) ||
        (v.cast?.some((c) => c.toLowerCase().includes(q)) ?? false)
      );
    });
  }, [videos, selectedBrand, searchQuery]);

  const totalPages = Math.ceil(filteredVideos.length / VIDEOS_PER_PAGE);
  const paginatedVideos = useMemo(() => {
    const start = currentPage * VIDEOS_PER_PAGE;
    return filteredVideos.slice(start, start + VIDEOS_PER_PAGE);
  }, [filteredVideos, currentPage]);

  const activeVideo = paginatedVideos[activeIndex] || null;

  // Reset when filter/page/search changes
  useEffect(() => { setActiveIndex(0); }, [currentPage, selectedBrand, searchQuery]);

  const handlePlaySong = useCallback(async (index: number, song: string) => {
    if (playingSong === index) {
      setPlayingSong(null);
      return;
    }

    if (videoIds[index]) {
      setPlayingSong(index);
      return;
    }

    setLoadingSong(index);
    try {
      const res = await fetch(`/api/search-music?q=${encodeURIComponent(song)}`);
      const data = await res.json();
      
      if (data.videoId) {
        setVideoIds({ ...videoIds, [index]: data.videoId });
        setPlayingSong(index);
      }
    } catch (error) {
      console.error("Failed to load song:", error);
    } finally {
      setLoadingSong(null);
    }
  }, [playingSong, videoIds]);

  const goTo = useCallback((index: number) => {
    if (index >= 0 && index < paginatedVideos.length) {
      setActiveIndex(index);
      const video = paginatedVideos[index];
      if (video && typeof window !== "undefined") {
        window.history.pushState({}, "", `/cinema/${video.slug}`);
      }
      setTimeout(() => {
        document.getElementById(`cinema-item-${index}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 50);
    }
  }, [paginatedVideos]);

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
  const currentGlobalIndex = currentPage * VIDEOS_PER_PAGE + activeIndex; // Zero-indexed for Pretext

  return (
    <Box minH="100vh">
      <Container maxW="container.xl" px={{ base: 2, md: 4 }}>
        <VStack spacing={3} mb={6} mt={4} align={{ base: "center", md: "start" }}>
          <HStack spacing={3} align="center">
            <Icon as={FaFilm} boxSize={{ base: 6, md: 8 }} color="yellow.400" />
            <Heading
              as="h1"
              className="fretqwik-title"
              fontSize={{ base: "4xl", md: "6xl" }}
              fontWeight="extrabold"
              color="primary"
              letterSpacing="wider"
            >
              Cinema
            </Heading>
          </HStack>
          <Text fontSize={{ base: "sm", md: "md" }} color="gray.400" maxW="2xl">
            Full-length skate videos from legendary brands. Browse by brand, watch classics and new releases.
          </Text>
          <HStack spacing={3} flexWrap="wrap">
            <Badge colorScheme="yellow" fontSize="sm" px={3} py={1}>
              {videos.length} Films
            </Badge>
            <Badge colorScheme="green" fontSize="sm" px={3} py={1}>
              {cinemaData.brands.length} Brands
            </Badge>
          </HStack>
        </VStack>
        {/* Search + Brand Filter Bar */}
        <Flex mb={4} gap={3} align="center">
          {/* Search Input */}
          <InputGroup size="sm" w={{ base: "140px", md: "220px" }} flexShrink={0}>
            <InputLeftElement pointerEvents="none">
              <Icon as={FaSearch} color="gray.500" boxSize={3} />
            </InputLeftElement>
            <Input
              placeholder="Search..."
              fontFamily="mono"
              fontSize="xs"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearchQuery(e.target.value); setCurrentPage(0); }}
              bg="transparent"
              border="1px solid"
              borderColor="whiteAlpha.200"
              borderRadius="sm"
              color="text"
              _placeholder={{ color: "gray.600" }}
              _hover={{ borderColor: "whiteAlpha.300" }}
              _focus={{ borderColor: "primary", boxShadow: "none" }}
            />
            {searchQuery && (
              <InputRightElement>
                <IconButton
                  aria-label="Clear search"
                  icon={<Icon as={FaTimes} boxSize={3} />}
                  size="xs"
                  variant="ghost"
                  color="gray.500"
                  _hover={{ color: "primary" }}
                  onClick={() => setSearchQuery("")}
                />
              </InputRightElement>
            )}
          </InputGroup>

          {/* Brand Badges */}
          <Box position="relative" flex={1} minW={0}>
            <IconButton
              aria-label="Scroll left"
              icon={<Icon as={FaChevronLeft} />}
              size="sm"
              variant="ghost"
              color="gray.400"
              position="absolute"
              left={0}
              top="50%"
              transform="translateY(-50%)"
              zIndex={2}
              bg="blackAlpha.800"
              borderRadius="full"
              _hover={{ bg: "blackAlpha.900", color: "primary" }}
              onClick={() => {
                const container = document.getElementById("brand-scroll-container");
                if (container) container.scrollBy({ left: -250, behavior: "smooth" });
              }}
            />
            <Box id="brand-scroll-container" overflowX="auto" px={10}
              css={{ "&::-webkit-scrollbar": { display: "none" }, scrollbarWidth: "none" }}>
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
                          h="16px"
                          w="auto"
                          maxW="40px"
                          objectFit="contain"
                          filter={isActive ? "none" : "grayscale(100%) brightness(0.8)"}
                          opacity={isActive ? 1 : 0.7}
                        />
                      )}
                      {brand} ({count})
                    </Button>
                  );
                })}
              </HStack>
            </Box>
            <IconButton
              aria-label="Scroll right"
              icon={<Icon as={FaChevronRight} />}
              size="sm"
              variant="ghost"
              color="gray.400"
              position="absolute"
              right={0}
              top="50%"
              transform="translateY(-50%)"
              zIndex={2}
              bg="blackAlpha.800"
              borderRadius="full"
              _hover={{ bg: "blackAlpha.900", color: "primary" }}
              onClick={() => {
                const container = document.getElementById("brand-scroll-container");
                if (container) container.scrollBy({ left: 250, behavior: "smooth" });
              }}
            />
          </Box>
        </Flex>

        {/* Cinema Layout */}
        <Flex direction={{ base: "column", lg: "row" }} gap={0}
          border="1px solid" borderColor="whiteAlpha.100" borderRadius="md" overflow="hidden" bg="background">

          {/* ── Main Player ── */}
          <Box flex={1} minW={0} overflowY={{ base: "visible", lg: "auto" }} maxH={{ base: "none", lg: "calc(100vh - 160px)" }}
            sx={{
              "&::-webkit-scrollbar": { width: "8px" },
              "&::-webkit-scrollbar-track": { bg: "transparent" },
              "&::-webkit-scrollbar-thumb": { bg: "transparent", borderRadius: "md" },
              "&:hover::-webkit-scrollbar-thumb": { bg: "whiteAlpha.300" },
              "&:hover::-webkit-scrollbar-thumb:hover": { bg: "whiteAlpha.400" },
              scrollbarWidth: "thin",
              scrollbarColor: "transparent transparent",
              "&:hover": { scrollbarColor: "rgba(255,255,255,0.3) transparent" }
            }}>
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
                  {activeVideo?.embedUrl?.includes("youtube") ? (
                    <><Icon as={SiYoutube} boxSize={3} color="red.500" /><Text fontFamily="mono" fontSize="2xs" color="gray.400">YouTube</Text></>
                  ) : (
                    <><Icon as={SiOdysee} boxSize={3} color="pink.400" /><Text fontFamily="mono" fontSize="2xs" color="gray.400">Odysee</Text></>
                  )}
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
                    <Tooltip label={activeVideo?.link?.includes("youtube") ? "Watch on YouTube" : "Watch on Odysee"} hasArrow>
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

              {/* Soundtrack (collapsed) */}
              {activeVideo?.soundtrack && activeVideo.soundtrack.length > 0 && (
                <Box mt={3}>
                  <Accordion allowToggle>
                    <AccordionItem border="none">
                      <AccordionButton px={0} py={1} _hover={{ bg: "transparent" }}>
                        <Text fontFamily="mono" fontSize="xs" color="primary" flex={1} textAlign="left">
                          🎵 Soundtrack ({activeVideo.soundtrack.length} songs)
                        </Text>
                        <AccordionIcon />
                      </AccordionButton>
                      <AccordionPanel px={0} py={2} maxH="300px" overflowY="auto"
                        sx={{
                          "&::-webkit-scrollbar": { width: "6px" },
                          "&::-webkit-scrollbar-track": { bg: "transparent" },
                          "&::-webkit-scrollbar-thumb": { bg: "transparent", borderRadius: "md" },
                          "&:hover::-webkit-scrollbar-thumb": { bg: "whiteAlpha.300" },
                          scrollbarWidth: "thin",
                          scrollbarColor: "transparent transparent",
                          "&:hover": { scrollbarColor: "rgba(255,255,255,0.3) transparent" }
                        }}>
                        <VStack align="stretch" spacing={1}>
                          {activeVideo.soundtrack.map((track, i) => (
                            <Box key={i}>
                              <HStack spacing={3} align="center" justify="space-between" p={2} borderRadius="sm"
                                bg={playingSong === i ? "whiteAlpha.100" : "transparent"} _hover={{ bg: "whiteAlpha.50" }}>
                                <HStack spacing={2} align="start" flex={1}>
                                  <Text fontFamily="mono" fontSize="2xs" color="gray.600" flexShrink={0}>
                                    {i + 1}.
                                  </Text>
                                  <VStack align="start" spacing={0} flex={1}>
                                    <Text fontFamily="mono" fontSize="2xs" color="text">{track.song}</Text>
                                    {track.part && (
                                      <Text fontFamily="mono" fontSize="2xs" color="gray.500" fontStyle="italic">
                                        {track.part}
                                      </Text>
                                    )}
                                  </VStack>
                                </HStack>
                                <IconButton
                                  aria-label="Play song"
                                  icon={loadingSong === i ? <Spinner size="xs" /> : <Icon as={FaPlay} boxSize={3} />}
                                  size="xs"
                                  variant="ghost"
                                  color={playingSong === i ? "primary" : "gray.400"}
                                  onClick={() => handlePlaySong(i, track.song)}
                                  _hover={{ color: "primary" }}
                                  isDisabled={loadingSong === i}
                                />
                              </HStack>
                              {playingSong === i && videoIds[i] && (
                                <Box mt={1} ml={6} p={2} bg="blackAlpha.400" borderRadius="sm">
                                  <iframe
                                    width="100%"
                                    height="80"
                                    src={`https://www.youtube.com/embed/${videoIds[i]}?autoplay=1&controls=1&modestbranding=1&rel=0`}
                                    allow="autoplay; encrypted-media"
                                    style={{ border: 0, borderRadius: "4px" }}
                                  />
                                </Box>
                              )}
                            </Box>
                          ))}
                        </VStack>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                </Box>
              )}
            </Box>
          </Box>

          {/* ── Playlist Sidebar ── */}
          <Box w={{ base: "100%", lg: "420px" }} flexShrink={0} bg="background"
            borderLeft={{ base: "none", lg: "1px solid" }} borderTop={{ base: "1px solid", lg: "none" }}
            borderColor="whiteAlpha.100" display="flex" flexDirection="column"
            maxH={{ base: "50vh", lg: "calc(100vh - 160px)" }} overflowY={{ base: "auto", lg: "hidden" }}
            sx={{
              "&::-webkit-scrollbar": { width: "8px" },
              "&::-webkit-scrollbar-track": { bg: "transparent" },
              "&::-webkit-scrollbar-thumb": { bg: "transparent", borderRadius: "md" },
              "&:hover::-webkit-scrollbar-thumb": { bg: "whiteAlpha.300" },
              "&:hover::-webkit-scrollbar-thumb:hover": { bg: "whiteAlpha.400" },
              scrollbarWidth: "thin",
              scrollbarColor: "transparent transparent",
              "&:hover": { scrollbarColor: "rgba(255,255,255,0.3) transparent" }
            }}>

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
            {getFeature('PRETEXT_VIRTUAL_SCROLL') ? (
              <VirtualCinemaPlaylist
                videos={filteredVideos}
                currentIndex={currentGlobalIndex}
                onVideoClick={(index) => {
                  const page = Math.floor(index / VIDEOS_PER_PAGE);
                  const indexInPage = index % VIDEOS_PER_PAGE;
                  setCurrentPage(page);
                  setActiveIndex(indexInPage);
                }}
                containerHeight={600}
              />
            ) : (
              <Box flex={1} overflowY="auto" py={1}
                sx={{
                  "&::-webkit-scrollbar": { width: "8px" },
                  "&::-webkit-scrollbar-track": { bg: "transparent" },
                  "&::-webkit-scrollbar-thumb": { bg: "transparent", borderRadius: "md" },
                  "&:hover::-webkit-scrollbar-thumb": { bg: "whiteAlpha.300" },
                  "&:hover::-webkit-scrollbar-thumb:hover": { bg: "whiteAlpha.400" },
                  scrollbarWidth: "thin",
                  scrollbarColor: "transparent transparent",
                  "&:hover": { scrollbarColor: "rgba(255,255,255,0.3) transparent" }
                }}>
                {paginatedVideos.map((video, i) => (
                  <Box key={video.slug} id={`cinema-item-${i}`}>
                    <PlaylistItem video={video} isActive={i === activeIndex} index={currentPage * VIDEOS_PER_PAGE + i} onClick={() => goTo(i)} />
                  </Box>
                ))}
              </Box>
            )}

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
