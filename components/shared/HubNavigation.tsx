"use client";

import React from "react";
import { Box, Flex, Link as ChakraLink, Text } from "@chakra-ui/react";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { trackInternalLinkClick } from "@/lib/analytics/events";

const HUB_LINKS = [
  { href: "/map", label: "🗺️ Map", keywords: "spots, skateparks" },
  { href: "/tricks", label: "🛹 Tricks", keywords: "kickflip, ollie, grind" },
  { href: "/skateshops", label: "🛍️ Shops", keywords: "gear, decks" },
  { href: "/videos", label: "🎥 Videos", keywords: "clips, edits" },
];

export default function HubNavigation() {
  const pathname = usePathname();

  const handleHubClick = (targetHref: string) => {
    trackInternalLinkClick({
      linkType: 'hub_nav',
      sourceUrl: pathname || '',
      targetUrl: targetHref,
    });
  };

  return (
    <Box
      bg="rgba(20,20,20,0.6)"
      backdropFilter="blur(10px)"
      border="1px solid"
      borderColor="whiteAlpha.200"
      borderRadius="lg"
      p={3}
      mb={6}
    >
      <Text fontSize="xs" color="gray.500" mb={2} textAlign="center">
        Explore Skatehive
      </Text>
      <Flex
        gap={{ base: 2, md: 3 }}
        justify="center"
        flexWrap="wrap"
      >
        {HUB_LINKS.map((link) => {
          const isActive = pathname?.startsWith(link.href);
          return (
            <NextLink key={link.href} href={link.href} passHref legacyBehavior>
              <ChakraLink
                onClick={() => handleHubClick(link.href)}
                px={{ base: 3, md: 4 }}
                py={2}
                fontSize={{ base: "xs", md: "sm" }}
                fontWeight="bold"
                bg={isActive ? "primary" : "rgba(0,0,0,0.3)"}
                color={isActive ? "background" : "white"}
                border="1px solid"
                borderColor={isActive ? "primary" : "whiteAlpha.300"}
                borderRadius="md"
                transition="all 0.3s"
                _hover={{
                  bg: isActive ? "accent" : "primary",
                  color: "background",
                  borderColor: "primary",
                  textDecoration: "none",
                }}
                whiteSpace="nowrap"
                title={link.keywords}
              >
                {link.label}
              </ChakraLink>
            </NextLink>
          );
        })}
      </Flex>
    </Box>
  );
}
