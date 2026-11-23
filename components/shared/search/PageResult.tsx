"use client";

import React from "react";
import { Box, HStack, VStack, Text, Icon } from "@chakra-ui/react";
import { searchOptionId } from "./a11y";

import { type PageResult } from "./types";

interface PageResultProps {
  page: PageResult;
  index: number;
  highlightedIndex: number;
  onSelect: (page: PageResult) => void;
  onHover?: () => void;
}

export default function PageResult({
  page,
  index,
  highlightedIndex,
  onSelect,
  onHover,
}: PageResultProps) {
  return (
    <Box
      px={4}
      py={3}
      cursor="pointer"
      bg={highlightedIndex === index ? "muted" : "transparent"}
      color={highlightedIndex === index ? "primary" : "primary"}
      transition="all 0.2s ease"
      _hover={{ bg: "muted", color: "primary" }}
      onClick={() => onSelect(page)}
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
          bg={highlightedIndex === index ? "primary" : "accent"}
          color={highlightedIndex === index ? "muted" : "background"}
        >
          <Icon as={page.icon} boxSize={4} />
        </Box>
        <VStack align="start" spacing={0} flex={1}>
          <Text fontWeight="medium" fontSize="md">
            {page.title}
          </Text>
          <Text fontSize="sm" opacity={0.7}>
            {page.description}
          </Text>
        </VStack>
      </HStack>
    </Box>
  );
}
