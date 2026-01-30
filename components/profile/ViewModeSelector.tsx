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
  const baseTabs = hasHiveProfile
    ? ([
        { key: "snaps", label: "Snaps", icon: FaCamera },
        { key: "posts", label: "Pages", icon: FaFileAlt },
        {
          key: "videoparts",
          label: isMobile ? "Parts" : "VideoParts",
          icon: FaVideo,
        },
      ] as const)
    : ([{ key: "posts", label: "Pages", icon: FaFileAlt }] as const);

  const tabsWithExtras = [...baseTabs];

  // Add tokens tab if user has an Ethereum address
  if (hasEthereumAddress) {
    tabsWithExtras.push({ key: "tokens", label: "Tokens", icon: FaCoins } as const);
  }

  // Add casts tab if user has a Farcaster profile
  if (hasFarcasterProfile) {
    tabsWithExtras.push({ key: "casts", label: "Casts", icon: FaComment } as const);
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
              borderRadius="none"
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
