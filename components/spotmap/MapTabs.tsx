"use client";

import React from "react";
import NextLink from "next/link";
import { Box, HStack, Text } from "@chakra-ui/react";
import { FaMap, FaMapMarkedAlt } from "react-icons/fa";

export type MapTabKey = "map" | "google";

interface TabDef {
  key: MapTabKey;
  href: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { key: "map", href: "/map", label: "Map", icon: <FaMap /> },
  { key: "google", href: "/map/google", label: "Google Map", icon: <FaMapMarkedAlt /> },
];

/**
 * Segmented-control style tabs for the /map header.
 *
 * Notes for future-me:
 *   - Several site themes set a global `a { color: ... }` (e.g. hackerPlus
 *     paints links yellow). That was clobbering the tab text color and
 *     showing through as a yellow underline. The `sx` block below pins
 *     the color and kills text-decoration for every link state with the
 *     specificity needed to beat those globals — no `!important` required
 *     since the `&[role="tab"]` selector wins on specificity.
 *   - Active tab uses `background` (theme token, dark) on `primary` (green)
 *     for AA contrast. The icon picks up the same color via `currentColor`.
 */
export default function MapTabs({ active }: { active: MapTabKey }) {
  return (
    <HStack
      role="tablist"
      aria-label="Map views"
      spacing={1}
      bg="rgba(10, 10, 10, 0.7)"
      border="1px solid"
      borderColor="whiteAlpha.200"
      borderRadius="full"
      p="4px"
      backdropFilter="blur(8px)"
      width="fit-content"
      boxShadow="inset 0 0 0 1px rgba(0,0,0,0.4)"
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Box
            key={tab.key}
            as={NextLink}
            href={tab.href}
            role="tab"
            aria-selected={isActive}
            aria-current={isActive ? "page" : undefined}
            prefetch={false}
            display="inline-flex"
            alignItems="center"
            gap={2}
            px={{ base: 4, md: 5 }}
            py={2}
            borderRadius="full"
            bg={isActive ? "primary" : "transparent"}
            transition="background 0.18s ease, color 0.18s ease, transform 0.15s ease"
            transform={isActive ? "translateY(0)" : "translateY(0)"}
            sx={{
              // Pin color + remove decoration for every link state. Selectors
              // are scoped to this element (&[role="tab"]) so they outrank
              // any global `a { ... }` rule the active theme might define.
              "&[role='tab'], &[role='tab']:hover, &[role='tab']:focus, &[role='tab']:active, &[role='tab']:visited":
                {
                  textDecoration: "none",
                  color: isActive ? "background" : "gray.300",
                },
              ...(isActive
                ? {
                    "&[role='tab']:hover": {
                      color: "background",
                      bg: "accent",
                    },
                  }
                : {
                    "&[role='tab']:hover": {
                      color: "primary",
                      bg: "whiteAlpha.100",
                    },
                  }),
              "&[role='tab']:focus-visible": {
                outline: "none",
                boxShadow: "0 0 0 2px var(--chakra-colors-primary)",
              },
            }}
          >
            <Box
              as="span"
              display="inline-flex"
              fontSize="md"
              // Inherits color from the link via currentColor, so the icon
              // always matches the label color.
              color="inherit"
              aria-hidden="true"
            >
              {tab.icon}
            </Box>
            <Text
              as="span"
              fontWeight={isActive ? "800" : "600"}
              fontSize="sm"
              letterSpacing="0.03em"
              lineHeight="1"
              color="inherit"
            >
              {tab.label}
            </Text>
          </Box>
        );
      })}
    </HStack>
  );
}
