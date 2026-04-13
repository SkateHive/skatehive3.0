"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import {
  VStack,
  Box,
} from "@chakra-ui/react";
import { FaSearch, FaUser, FaHome, FaTrophy, FaGift, FaBolt } from "react-icons/fa";
import { useRouter, usePathname } from "next/navigation";
import { useSoundSettings } from "@/contexts/SoundSettingsContext";

// Import smaller components
import SearchInput from "./search/SearchInput";
import LoadingState from "./search/LoadingState";
import SkaterResult from "./search/SkaterResult";
import PageResult from "./search/PageResult";
import SectionHeader from "./search/SectionHeader";
import SearchTips from "./search/SearchTips";
import NoResults from "./search/NoResults";
import SkateModal from "./SkateModal";
import { useTranslations } from "@/contexts/LocaleContext";

// Import types and constants
import {
  PageResult as PageResultType,
  SearchOverlayProps,
} from "./search/types";
import {
  STATIC_PAGES,
  COMMAND_PAGES,
  getPopularPages,
  getPopularCommands,
} from "./search/constants";
import { SkaterData } from "@/types/leaderboard";

export default function SearchOverlay({
  isOpen,
  onClose,
  onOpenAirdrop,
  onOpenReport,
}: SearchOverlayProps) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [skaters, setSkaters] = useState<SkaterData[]>([]);
  const [filteredPages, setFilteredPages] = useState<PageResultType[]>([]);
  const [filteredCommands, setFilteredCommands] = useState<PageResultType[]>([]);
  const [filteredSkaters, setFilteredSkaters] = useState<SkaterData[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isLoadingTopSkaters, setIsLoadingTopSkaters] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { soundEnabled } = useSoundSettings();
  const hoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const prevHighlightedIndexRef = useRef<number>(-1);

  // Initialize hover sound
  useEffect(() => {
    hoverAudioRef.current = new Audio('/hoversfx.mp3');
    hoverAudioRef.current.volume = 0.2;
  }, []);

  // Play hover sound when highlighted index changes via keyboard
  useEffect(() => {
    if (highlightedIndex !== prevHighlightedIndexRef.current && highlightedIndex >= 0) {
      if (soundEnabled && hoverAudioRef.current) {
        hoverAudioRef.current.currentTime = 0;
        hoverAudioRef.current.play().catch(() => {});
      }
    }
    prevHighlightedIndexRef.current = highlightedIndex;
  }, [highlightedIndex, soundEnabled]);

  // Callback for mouse hover on items
  const playHoverSound = useCallback(() => {
    if (soundEnabled && hoverAudioRef.current) {
      hoverAudioRef.current.currentTime = 0;
      hoverAudioRef.current.play().catch(() => {});
    }
  }, [soundEnabled]);

  // Get popular pages
  const popularPages = useMemo(() => {
    return getPopularPages().filter((page) => page.path !== pathname);
  }, [pathname]);

  // Get popular commands
  const popularCommands = useMemo(() => getPopularCommands(), []);

  // Fetch top skaters
  useEffect(() => {
    const fetchTopSkaters = async () => {
      setIsLoadingTopSkaters(true);
      try {
        const response = await fetch("https://api.skatehive.app/api/v2/leaderboard");
        if (!response.ok) {
          throw new Error(`Failed to fetch leaderboard: ${response.status}`);
        }
        const data: SkaterData[] = await response.json();
        // Sort by points descending and take top 50 for search
        const topSkaters = Array.isArray(data) 
          ? data.sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 50)
          : [];
        setSkaters(topSkaters);
      } catch (error) {
        console.error("Failed to fetch top skaters:", error);
        setSkaters([]);
      } finally {
        setIsLoadingTopSkaters(false);
      }
    };

    if (isOpen) {
      fetchTopSkaters();
    }
  }, [isOpen]);

  // Filter results based on query
  useEffect(() => {
    if (!query.trim()) {
      setFilteredPages([]);
      setFilteredCommands([]);
      setFilteredSkaters([]);
      setHighlightedIndex(-1);
      return;
    }

    const searchTerm = query.toLowerCase().trim();

    // Filter pages
    const filteredStaticPages = STATIC_PAGES.filter((page) =>
      page.title.toLowerCase().includes(searchTerm) ||
      page.description.toLowerCase().includes(searchTerm)
    );

    const filteredCommandPages = COMMAND_PAGES.filter((page) =>
      page.title.toLowerCase().includes(searchTerm) ||
      page.description.toLowerCase().includes(searchTerm)
    );

    setFilteredPages(filteredStaticPages);
    setFilteredCommands(filteredCommandPages);

    // Filter skaters
    const filteredSkaterResults = skaters.filter((skater) =>
      skater.hive_author.toLowerCase().includes(searchTerm)
    );
    setFilteredSkaters(filteredSkaterResults);

    setHighlightedIndex(-1);
  }, [query, skaters]);

  // Handle result selection
  const handleSelect = useCallback((result: any) => {
    if ("path" in result) {
      // Page or command result
      if (result.path.startsWith("command:")) {
        // Command
        onClose();
        if (result.path === "command:airdrop") {
          onOpenAirdrop?.();
        }
        if (result.path === "command:report") {
          onOpenReport?.();
        }

      } else {
        // Regular page
        router.push(result.path);
        onClose();
      }
    } else {
      // Skater result
      router.push(`/@${result.hive_author}`);
      onClose();
    }
  }, [onClose, onOpenAirdrop, onOpenReport, router]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    const allResults = query
      ? [
          ...filteredSkaters,
          ...filteredCommands,
          ...filteredPages,
        ]
      : [
          ...popularPages,
          ...popularCommands,
        ];

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < allResults.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && allResults[highlightedIndex]) {
          handleSelect(allResults[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }, [isOpen, query, filteredPages, filteredCommands, filteredSkaters, popularPages, highlightedIndex, handleSelect, onClose]);

  // Keyboard event listeners
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      searchInputRef.current?.focus();
    }

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <SkateModal
      isOpen={isOpen}
      onClose={onClose}
      title="global-search"
      size="xl"
      blockScrollOnMount={false}
      resizable
      preciseResize
    >
      <Box p={0}>
        <VStack spacing={0} align="stretch">
          {/* Search Input */}
          <SearchInput
            query={query}
            onQueryChange={setQuery}
            inputRef={searchInputRef}
            isLoading={isLoadingTopSkaters}
          />

          {/* Results Area */}
          {query || popularPages.length > 0 || popularCommands.length > 0 || isLoadingTopSkaters ? (
            <Box
              flex="1"
              overflowY="auto"
              maxH="100%"
              css={{
                "&::-webkit-scrollbar": {
                  width: "6px",
                },
                "&::-webkit-scrollbar-track": {
                  bg: "transparent",
                },
                "&::-webkit-scrollbar-thumb": {
                  bg: "muted",
                  borderRadius: "2px",
                },
              }}
            >
              <VStack spacing={0} align="stretch">
                {/* Results Header */}
                <SectionHeader
                  icon={
                    query
                      ? query.startsWith("/")
                        ? FaSearch
                        : filteredCommands.length > 0 &&
                          filteredSkaters.length === 0
                        ? FaGift
                        : FaUser
                      : FaHome
                  }
                  title={
                    query
                      ? query.startsWith("/")
                        ? "Pages & Features"
                        : filteredCommands.length > 0 &&
                          filteredSkaters.length === 0
                        ? "Commands"
                        : filteredCommands.length > 0
                        ? "Users & Commands"
                        : "Skatehive Users"
                      : "Popular Pages"
                  }
                />

                {/* Results */}
                {filteredSkaters.length > 0 && (
                  <>
                    {filteredSkaters.map((skater, index) => (
                      <SkaterResult
                        key={`skater-${skater.hive_author}`}
                        skater={skater}
                        index={index}
                        highlightedIndex={highlightedIndex}
                        onSelect={handleSelect}
                        onHover={playHoverSound}
                      />
                    ))}
                  </>
                )}

                {filteredCommands.length > 0 && (
                  <>
                    {filteredCommands.map((command, index) => (
                      <PageResult
                        key={`command-${command.path}`}
                        page={command}
                        index={filteredSkaters.length + index}
                        highlightedIndex={highlightedIndex}
                        onSelect={handleSelect}
                        onHover={playHoverSound}
                      />
                    ))}
                  </>
                )}

                {filteredPages.length > 0 && (
                  <>
                    {filteredPages.map((page, index) => (
                      <PageResult
                        key={`page-${page.path}`}
                        page={page}
                        index={filteredSkaters.length + filteredCommands.length + index}
                        highlightedIndex={highlightedIndex}
                        onSelect={handleSelect}
                        onHover={playHoverSound}
                      />
                    ))}
                  </>
                )}

                {/* Show popular pages when no query */}
                {!query && popularPages.length > 0 && (
                  <>
                    {popularPages.map((page, index) => (
                      <PageResult
                        key={`popular-${page.path}`}
                        page={page}
                        index={index}
                        highlightedIndex={highlightedIndex}
                        onSelect={handleSelect}
                        onHover={playHoverSound}
                      />
                    ))}
                  </>
                )}

                {/* Show popular commands when no query */}
                {!query && popularCommands.length > 0 && (
                  <>
                    <SectionHeader icon={FaBolt} title={t("searchOverlay.popularCommands")} />
                    {popularCommands.map((command, index) => (
                      <PageResult
                        key={`popular-command-${command.path}`}
                        page={command}
                        index={popularPages.length + index}
                        highlightedIndex={highlightedIndex}
                        onSelect={handleSelect}
                        onHover={playHoverSound}
                      />
                    ))}
                  </>
                )}

                <NoResults
                  query={query}
                  hasPages={filteredPages.length > 0}
                  hasSkaters={
                    filteredSkaters.length > 0 ||
                    filteredCommands.length > 0
                  }
                />
              </VStack>
            </Box>
          ) : (
            <VStack spacing={0} align="stretch">
              {/* Search Tips */}
              <SearchTips
                show={!query && popularPages.length === 0 && !isLoadingTopSkaters}
              />
            </VStack>
          )}
        </VStack>
      </Box>
    </SkateModal>
  );
}