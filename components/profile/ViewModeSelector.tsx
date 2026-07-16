"use client";
import React, { memo, useMemo, useCallback } from "react";
import { Tabs, TabList, Tab, Box } from "@chakra-ui/react";
import { useProfileDebug } from "@/lib/utils/profileDebug";
import {
  FaTh,
  FaBars,
  FaBookOpen,
  FaVideo,
  FaCamera,
  FaFileAlt,
} from "react-icons/fa";
import { SiFarcaster } from "react-icons/si";

interface ViewModeSelectorProps {
  viewMode: "grid" | "list" | "magazine" | "videoparts" | "snaps" | "casts";
  onViewModeChange: (
    mode: "grid" | "list" | "magazine" | "videoparts" | "snaps" | "casts"
  ) => void;
  isMobile: boolean;
  hasHiveProfile?: boolean;
  hasFarcasterProfile?: boolean;
  hasVideoParts?: boolean;
}

const getMainTabs = (
  isMobile: boolean,
  hasHiveProfile: boolean,
  hasFarcasterProfile: boolean,
  hasVideoParts: boolean
) => {
  const baseTabs: Array<{ key: string; label: string; icon: any }> = hasHiveProfile
    ? [
        { key: "snaps", label: "Snaps", icon: FaCamera },
        { key: "posts", label: "Pages", icon: FaFileAlt },
        ...(hasVideoParts
          ? [{
              key: "videoparts",
              label: isMobile ? "Parts" : "VideoParts",
              icon: FaVideo,
            }]
          : []),
      ]
    : [{ key: "posts", label: "Pages", icon: FaFileAlt }];

  const tabsWithExtras = [...baseTabs];

  // Add casts tab if user has a Farcaster profile
  if (hasFarcasterProfile) {
    tabsWithExtras.push({ key: "casts", label: "Casts", icon: SiFarcaster });
  }

  return tabsWithExtras;
};

const postViewModes = [
  { key: "grid", label: "Grid", icon: FaTh },
  { key: "list", label: "List", icon: FaBars },
  { key: "magazine", label: "Magazine", icon: FaBookOpen },
] as const;

const ViewModeSelector = memo(function ViewModeSelector({
  viewMode,
  onViewModeChange,
  isMobile,
  hasHiveProfile = true,
  hasFarcasterProfile = false,
  hasVideoParts = false,
}: ViewModeSelectorProps) {
  useProfileDebug("ViewModeSelector");
  const mainTabs = useMemo(
    () => getMainTabs(isMobile, hasHiveProfile, hasFarcasterProfile, hasVideoParts),
    [isMobile, hasHiveProfile, hasFarcasterProfile, hasVideoParts]
  );

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
    () => {
      const index = mainTabs.findIndex((tab) => tab.key === currentMainTab);
      return index === -1 ? 0 : index;
    },
    [currentMainTab, mainTabs]
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
        onViewModeChange(selectedTab.key as "snaps" | "videoparts" | "casts");
      }
    },
    [viewMode, onViewModeChange, mainTabs]
  );

  const handlePostViewModeChange = useCallback(
    (postMode: "grid" | "list" | "magazine") => {
      onViewModeChange(postMode);
    },
    [onViewModeChange]
  );

  return (
    <Box>
      {/* Main tabs — sleek terminal style */}
      <Box borderBottom="1px solid" borderColor="border" bg="background">
        <Tabs
          index={currentMainTabIndex}
          onChange={handleMainTabChange}
          variant="unstyled"
          size="sm"
          isFitted={true}
        >
          <TabList border="none">
            {mainTabs.map((tab, index) => {
              const IconComponent = tab.icon;
              const isSelected = currentMainTabIndex === index;
              return (
                <Tab
                  key={tab.key}
                  color={isSelected ? "primary" : "dim"}
                  bg="transparent"
                  borderBottom="2px solid"
                  borderColor={isSelected ? "primary" : "transparent"}
                  mb="-1px"
                  _hover={{ color: "primary" }}
                  _selected={{ color: "primary" }}
                  transition="color 0.15s, border-color 0.15s"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  gap={1.5}
                  px={isMobile ? 1 : 3}
                  py={2}
                  minW="auto"
                  fontFamily="mono"
                  fontSize="xs"
                  fontWeight={isSelected ? "bold" : "normal"}
                  textTransform="lowercase"
                  borderRadius="none"
                >
                  <IconComponent size={12} />
                  {tab.label}
                </Tab>
              );
            })}
          </TabList>
        </Tabs>
      </Box>

      {/* Sub-selector for Posts view modes */}
      {currentMainTab === "posts" && (
        <Box borderBottom="1px solid" borderColor="border" bg="background">
          <Tabs
            index={availablePostViewModes.findIndex(
              (mode) => mode.key === currentPostViewMode
            )}
            onChange={(index) =>
              handlePostViewModeChange(availablePostViewModes[index].key)
            }
            variant="unstyled"
            size="sm"
            isFitted={true}
          >
            <TabList border="none">
              {availablePostViewModes.map((mode, index) => {
                const IconComponent = mode.icon;
                const isSelected = availablePostViewModes.findIndex(
                  (m) => m.key === currentPostViewMode
                ) === index;
                return (
                  <Tab
                    key={mode.key}
                    color={isSelected ? "primary" : "dim"}
                    bg="transparent"
                    borderBottom="2px solid"
                    borderColor={isSelected ? "primary" : "transparent"}
                    mb="-1px"
                    _hover={{ color: "primary" }}
                    _selected={{ color: "primary" }}
                    transition="color 0.15s, border-color 0.15s"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                    gap={1.5}
                    px={isMobile ? 1 : 3}
                    py={1.5}
                    minW="auto"
                    fontSize="xs"
                    fontFamily="mono"
                    fontWeight={isSelected ? "bold" : "normal"}
                    textTransform="lowercase"
                    borderRadius="none"
                  >
                    <IconComponent size={11} />
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
