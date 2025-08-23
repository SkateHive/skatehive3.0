"use client";
import React, { memo, useMemo, useCallback } from "react";
import { Tabs, TabList, Tab, Box, ß } from "@chakra-ui/react";
import {
  FaTh,
  FaBars,
  FaBookOpen,
  FaVideo,
  FaCamera,
  FaFileAlt,
} from "react-icons/fa";

interface ViewModeSelectorProps {
  viewMode: "grid" | "list" | "magazine" | "videoparts" | "snaps";
  onViewModeChange: (
    mode: "grid" | "list" | "magazine" | "videoparts" | "snaps"
  ) => void;
  isMobile: boolean;
}

const getMainTabs = (isMobile: boolean) =>
  [
    { key: "snaps", label: "Snaps", icon: FaCamera },
    { key: "posts", label: "Pages", icon: FaFileAlt },
    {
      key: "videoparts",
      label: isMobile ? "Parts" : "VideoParts",
      icon: FaVideo,
    },
  ] as const;

const postViewModes = [
  { key: "grid", label: "Grid", icon: FaTh },
  { key: "list", label: "List", icon: FaBars },
  { key: "magazine", label: "Magazine", icon: FaBookOpen },
] as const;

const ViewModeSelector = memo(function ViewModeSelector({
  viewMode,
  onViewModeChange,
  isMobile,
}: ViewModeSelectorProps) {
  // Get main tabs based on mobile state
  const mainTabs = useMemo(() => getMainTabs(isMobile), [isMobile]);

  // Determine which main tab is currently active
  const currentMainTab = useMemo(() => {
    if (["grid", "list", "magazine"].includes(viewMode)) {
      return "posts";
    }
    return viewMode;
  }, [viewMode]);

  // Determine current post view mode (for sub-selector)
  const currentPostViewMode = useMemo(() => {
    if (["grid", "list", "magazine"].includes(viewMode)) {
      return viewMode;
    }
    return "grid"; // default
  }, [viewMode]);

  // Filter post view modes based on mobile state
  const availablePostViewModes = useMemo(
    () =>
      isMobile
        ? postViewModes.filter((mode) => mode.key !== "magazine")
        : postViewModes,
    [isMobile]
  );

  // Get current main tab index
  const currentMainTabIndex = useMemo(
    () => mainTabs.findIndex((tab) => tab.key === currentMainTab),
    [currentMainTab]
  );

  const handleMainTabChange = useCallback(
    (index: number) => {
      const selectedTab = mainTabs[index];
      if (selectedTab.key === "posts") {
        // If switching to posts tab, use the current post view mode or default to grid
        const postMode = ["grid", "list", "magazine"].includes(viewMode)
          ? viewMode
          : "grid";
        onViewModeChange(postMode as "grid" | "list" | "magazine");
      } else {
        onViewModeChange(selectedTab.key as "snaps" | "videoparts");
      }
    },
    [viewMode, onViewModeChange]
  );

  const handlePostViewModeChange = useCallback(
    (postMode: "grid" | "list" | "magazine") => {
      onViewModeChange(postMode);
    },
    [onViewModeChange]
  );

  return (
    <Box my={4}>
      <Tabs
        index={currentMainTabIndex}
        onChange={handleMainTabChange}
        variant="enclosed"
        colorScheme="green"
        size="sm"
        isFitted={true}
      >
        <TabList>
          {mainTabs.map((tab) => {
            const IconComponent = tab.icon;
            return (
              <Tab
                key={tab.key}
                _selected={{
                  color: "primary",
                  bg: "muted",
                }}
                _hover={{
                  bg: "muted.100",
                  transform: "translateY(-1px)",
                }}
                transition="all 0.2s"
                display="flex"
                alignItems="center"
                gap={2}
                px={isMobile ? 2 : 4}
                minW={isMobile ? "auto" : "80px"}
              >
                <IconComponent size={14} />
                {tab.label}
              </Tab>
            );
          })}
        </TabList>
      </Tabs>

      {/* Sub-selector for Posts view modes */}
      {currentMainTab === "posts" && (
        <Box mt={2} mb={2}>
          <Tabs
            index={availablePostViewModes.findIndex(
              (mode) => mode.key === currentPostViewMode
            )}
            onChange={(index) =>
              handlePostViewModeChange(availablePostViewModes[index].key)
            }
            variant="enclosed"
            colorScheme="green"
            size="sm"
            isFitted={true}
          >
            <TabList
              bg="transparent"
              border="1px solid"
              borderColor="gray.600"
              borderRadius="md"
            >
              {availablePostViewModes.map((mode) => {
                const IconComponent = mode.icon;
                return (
                  <Tab
                    key={mode.key}
                    _selected={{
                      color: "primary",
                      bg: "muted",
                    }}
                    _hover={{
                      bg: "muted.100",
                      transform: "translateY(-1px)",
                    }}
                    transition="all 0.2s"
                    display="flex"
                    alignItems="center"
                    gap={2}
                    px={isMobile ? 2 : 4}
                    minW={isMobile ? "auto" : "60px"}
                    fontSize="xs"
                    border="none"
                  >
                    <IconComponent size={12} />
                    {mode.label}
                  </Tab>
                );
              })}
            </TabList>
          </Tabs>
        </Box>
      )}
    </Box>
  );
});

export default ViewModeSelector;
