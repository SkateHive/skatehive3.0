"use client";
import React, { memo, useMemo, useCallback } from "react";
import { Tabs, TabList, Tab, Box } from "@chakra-ui/react";
import {
  FaTh,
  FaBars,
  FaBookOpen,
  FaVideo,
  FaCamera,
  FaFileAlt,
  FaCoins,
  FaComment,
} from "react-icons/fa";

interface ViewModeSelectorProps {
  viewMode: "grid" | "list" | "magazine" | "videoparts" | "snaps" | "tokens" | "casts";
  onViewModeChange: (
    mode: "grid" | "list" | "magazine" | "videoparts" | "snaps" | "tokens" | "casts"
  ) => void;
  isMobile: boolean;
  hasEthereumAddress?: boolean;
  hasHiveProfile?: boolean;
  hasFarcasterProfile?: boolean;
}

const getMainTabs = (
  isMobile: boolean,
  hasEthereumAddress: boolean,
  hasHiveProfile: boolean,
  hasFarcasterProfile: boolean
) => {
  const baseTabs: Array<{ key: string; label: string; icon: any }> = hasHiveProfile
    ? [
        { key: "snaps", label: "Snaps", icon: FaCamera },
        { key: "posts", label: "Pages", icon: FaFileAlt },
        {
          key: "videoparts",
          label: isMobile ? "Parts" : "VideoParts",
          icon: FaVideo,
        },
      ]
    : [{ key: "posts", label: "Pages", icon: FaFileAlt }];

  const tabsWithExtras = [...baseTabs];

  // Add tokens tab if user has an Ethereum address
  if (hasEthereumAddress) {
    tabsWithExtras.push({ key: "tokens", label: "Tokens", icon: FaCoins });
  }

  // Add casts tab if user has a Farcaster profile
  if (hasFarcasterProfile) {
    tabsWithExtras.push({ key: "casts", label: "Casts", icon: FaComment });
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
  hasEthereumAddress = false,
  hasHiveProfile = true,
  hasFarcasterProfile = false,
}: ViewModeSelectorProps) {
  // Get main tabs based on mobile state and ethereum address
  const mainTabs = useMemo(
    () => getMainTabs(isMobile, hasEthereumAddress, hasHiveProfile, hasFarcasterProfile),
    [isMobile, hasEthereumAddress, hasHiveProfile, hasFarcasterProfile]
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
        onViewModeChange(selectedTab.key as "snaps" | "videoparts" | "tokens" | "casts");
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
      {/* Main tabs with terminal-style border */}
      <Box
        border="2px solid"
        borderColor="border"
        borderTop="none"
        bg="background"
      >
        <Tabs
          index={currentMainTabIndex}
          onChange={handleMainTabChange}
          variant="unstyled"
          size="sm"
          isFitted={true}
        >
          <TabList>
            {mainTabs.map((tab, index) => {
              const IconComponent = tab.icon;
              const isSelected = currentMainTabIndex === index;
              return (
                <Tab
                  key={tab.key}
                  color={isSelected ? "primary" : "text"}
                  bg={isSelected ? "muted" : "transparent"}
                  borderRight={index < mainTabs.length - 1 ? "1px solid" : "none"}
                  borderColor="border"
                  _hover={{
                    bg: "muted",
                    color: "primary",
                  }}
                  _selected={{
                    color: "primary",
                    bg: "muted",
                  }}
                  transition="all 0.2s"
                  display="flex"
                  alignItems="center"
                  gap={2}
                  px={isMobile ? 2 : 4}
                  py={3}
                  minW={isMobile ? "auto" : "80px"}
                  fontFamily="mono"
                  fontSize="sm"
                  borderRadius="none"
                >
                  <IconComponent size={14} />
                  {tab.label}
                </Tab>
              );
            })}
          </TabList>
        </Tabs>
      </Box>

      {/* Sub-selector for Posts view modes */}
      {currentMainTab === "posts" && (
        <Box
          border="2px solid"
          borderColor="border"
          borderTop="none"
          bg="background"
        >
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
            <TabList>
              {availablePostViewModes.map((mode, index) => {
                const IconComponent = mode.icon;
                const isSelected = availablePostViewModes.findIndex(
                  (m) => m.key === currentPostViewMode
                ) === index;
                return (
                  <Tab
                    key={mode.key}
                    color={isSelected ? "primary" : "dim"}
                    bg={isSelected ? "muted" : "transparent"}
                    borderRight={index < availablePostViewModes.length - 1 ? "1px solid" : "none"}
                    borderColor="border"
                    _hover={{
                      bg: "muted",
                      color: "primary",
                    }}
                    _selected={{
                      color: "primary",
                      bg: "muted",
                    }}
                    transition="all 0.2s"
                    display="flex"
                    alignItems="center"
                    gap={2}
                    px={isMobile ? 2 : 4}
                    py={2}
                    minW={isMobile ? "auto" : "60px"}
                    fontSize="xs"
                    fontFamily="mono"
                    borderRadius="none"
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
