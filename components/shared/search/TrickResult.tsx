"use client";

import React from "react";
import { Box, HStack, VStack, Text, Icon } from "@chakra-ui/react";
import { searchOptionId } from "./a11y";
import { FaBolt } from "react-icons/fa";
import type { TrickSearchResult } from "@/lib/tricks/catalog";

interface TrickResultProps {
  trick: TrickSearchResult;
  index: number;
  highlightedIndex: number;
  onSelect: (trick: TrickSearchResult) => void;
  onHover?: () => void;
}

export default function TrickResult({
  trick,
  index,
  highlightedIndex,
  onSelect,
  onHover,
}: TrickResultProps) {
  const isHighlighted = highlightedIndex === index;

  return (
    <Box
      px={4}
      py={3}
      cursor="pointer"
      bg={isHighlighted ? "muted" : "transparent"}
      color="primary"
      transition="all 0.2s ease"
      _hover={{ bg: "muted", color: "primary" }}
      onClick={() => onSelect(trick)}
      onMouseEnter={onHover}
      data-index={index}
      id={searchOptionId(index)}
      role="option"
      aria-selected={highlightedIndex === index}
    >
      <HStack spacing={3}>
        <Box
          p={2}
          borderRadius="none"
          bg={isHighlighted ? "primary" : "accent"}
          color={isHighlighted ? "muted" : "background"}
        >
          <Icon as={FaBolt} boxSize={4} />
        </Box>
        <VStack align="start" spacing={0} flex={1}>
          <Text fontWeight="medium" fontSize="md">
            {trick.name}
          </Text>
          <Text fontSize="sm" opacity={0.7}>
            {trick.category}
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
}
