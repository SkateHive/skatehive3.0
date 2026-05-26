"use client";

import React from "react";
import NextLink from "next/link";
import { HStack, Box, Text } from "@chakra-ui/react";
import { FaGlobe, FaMap, FaMapMarkedAlt } from "react-icons/fa";

export type MapTabKey = "map" | "globe" | "google";

interface TabDef {
  key: MapTabKey;
  href: string;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { key: "map", href: "/map", label: "Map", icon: <FaMap /> },
  { key: "globe", href: "/map/globe", label: "Globe", icon: <FaGlobe /> },
  { key: "google", href: "/map/google", label: "Google Map", icon: <FaMapMarkedAlt /> },
];

export default function MapTabs({ active }: { active: MapTabKey }) {
  return (
    <HStack
      role="tablist"
      aria-label="Map views"
      spacing={1}
      bg="rgba(0,0,0,0.35)"
      border="1px solid"
      borderColor="whiteAlpha.200"
      borderRadius="full"
      p={1}
      mx="auto"
      width="fit-content"
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
            px={4}
            py={2}
            borderRadius="full"
            bg={isActive ? "primary" : "transparent"}
            color={isActive ? "background" : "gray.300"}
            fontWeight="bold"
            fontSize="sm"
            display="inline-flex"
            alignItems="center"
            gap={2}
            transition="background 0.15s, color 0.15s"
            _hover={!isActive ? { bg: "whiteAlpha.100", color: "primary" } : undefined}
            prefetch={false}
          >
            {tab.icon}
            <Text as="span">{tab.label}</Text>
          </Box>
        );
      })}
    </HStack>
  );
}
