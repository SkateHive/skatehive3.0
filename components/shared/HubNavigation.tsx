"use client";

import React from "react";
import { HStack, Link as ChakraLink } from "@chakra-ui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { trackInternalLinkClick } from "@/lib/analytics/events";

const HUB_LINKS = [
  { href: "/map", label: "Map", emoji: "🗺️", keywords: "spots, skateparks" },
  { href: "/tricks", label: "Tricks", emoji: "🛹", keywords: "kickflip, ollie, grind" },
  { href: "/skateshops", label: "Shops", emoji: "🛍️", keywords: "gear, decks" },
  { href: "/videos", label: "Videos", emoji: "🎥", keywords: "clips, edits" },
  { href: "/cinema", label: "Cinema", emoji: "🎬", keywords: "classic, full length, brands" },
  { href: "/skaters", label: "Skaters", emoji: "👥", keywords: "community, profiles" },
];

export default function HubNavigation() {
  const pathname = usePathname();

  const handleHubClick = (targetHref: string) => {
    trackInternalLinkClick({
      linkType: "hub_nav",
      sourceUrl: pathname || "",
      targetUrl: targetHref,
    });
  };

  return (
    <HStack
      spacing={2}
      justify="center"
      flexWrap="wrap"
      py={3}
      mb={4}
    >
      {HUB_LINKS.map((link) => {
        const isActive = pathname?.startsWith(link.href);
        return (
          <ChakraLink
            key={link.href}
            as={NextLink}
            href={link.href}
            onClick={() => handleHubClick(link.href)}
            px={4}
            py={1.5}
            fontFamily="mono"
            fontSize="xs"
            fontWeight={isActive ? "bold" : "normal"}
            bg="transparent"
            color={isActive ? "primary" : "gray.400"}
            border="1px solid"
            borderColor={isActive ? "primary" : "whiteAlpha.100"}
            borderRadius="sm"
            transition="all 0.15s"
            _hover={{
              color: "primary",
              borderColor: "primary",
              textDecoration: "none",
            }}
            whiteSpace="nowrap"
            title={link.keywords}
          >
            {link.emoji} {link.label}
          </ChakraLink>
        );
      })}
    </HStack>
  );
}
